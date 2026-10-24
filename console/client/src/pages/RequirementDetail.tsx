// ── 需求详情（05-B4/F2 列表后进入：阶段轨在上（冻结链 chips）+ 副轨五类有数据才出 + 左条目右正文；TOC/全屏/预览能力保留） ──
// 迁移自 claude-board WorkflowDetail；B3/F04~F07/F09 能力保留：工作区树 + 三分支预览 + TOC + 全屏 + sessions inline
// 03 §F2：正文高度改 flex 填满（替代 calc(100vh-280px)）；空产物两态（当前节点=下一手文案/未到=没到文案）
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAPI } from '../hooks/useAPI';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { MarkdownPreview, defaultSlugify } from '../components/MarkdownPreview';
import { CodePreview, codeLangOf } from '../components/CodePreview';
import { ArtifactPreview } from '../components/ArtifactPreview';
import { WorkspaceTree } from '../components/WorkspaceTree';
import { TocOverlay } from '../components/TocOverlay';
import { SessionInline } from '../components/SessionInline';
import { DevEntryDrawer } from '../components/DevEntryDrawer';
import type { ReqLinks } from '../components/DevEntryDrawer';
import type { PipelinePhase, RequirementSummary, WorkspaceGroup, WorkspaceNode, LinkedSession } from '../utils/workflow';
import { formatSize, formatStamp, parseDecisions, parseTOC, jumpToHeading, pad2 } from '../utils/workflow';

type TabKind = 'artifacts' | 'decisions' | 'history' | 'sessions' | 'others';
type PhaseSelection = PipelinePhase | 'others';

interface HistoryVersion {
  file: string;         // 既有字段（H04）
  mtime: string;        // 既有字段（H04）
  size: number;         // 既有字段（H04）
  filename: string;     // B2 增量
  version: number;      // B2 增量
  modified: string;     // B2 增量（client 消费）
}

const TEXT_PREVIEW_EXT = new Set([
  '.txt', '.sql', '.json', '.yaml', '.yml', '.xml', '.log', '.csv',
  '.js', '.mjs', '.ts', '.tsx', '.jsx', '.vue', '.java', '.proto', '.properties',
  '.sh', '.py', '.css',
]);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);
const FRAME_EXT = new Set(['.pdf', '.html', '.htm']);

function extOf(path: string): string {
  const i = path.lastIndexOf('.');
  return i >= 0 ? path.slice(i).toLowerCase() : '';
}

interface Detail extends RequirementSummary {
  services?: { name: string; role?: string; appid?: string; local_path?: string }[];
  stages?: string[];
  artifacts?: string[];
  links?: ReqLinks;  // F09/D003-v3：研发入口（_state/links.yaml，缺失=undefined 全待办）
}

export function RequirementDetail() {
  const navigate = useNavigate();
  const { name = '' } = useParams();
  const base = `/requirements/${encodeURIComponent(name)}`;

  const { data: requirement, loading } = useAPI<Detail>(base);
  const { data: workspace } = useAPI<{ groups: WorkspaceGroup[] }>(`${base}/workspace`);

  const [tab, setTab] = useState<TabKind>('artifacts');
  // 06 G1：进入 other 前的阶段选中记忆，切回「产物」时恢复
  const stageBeforeOthers = useRef<PhaseSelection | null>(null);
  // 04 S3：文件族门闩（左栏/取数/预览/全屏）原绑死 artifacts，须同时接受 others
  const fileTab = tab === 'artifacts' || tab === 'others';
  const [selection, setSelection] = useState<PhaseSelection | null>(null);
  const [selectedFile, setSelectedFile] = useState<WorkspaceNode | null>(null);
  const [selectedHistoryFile, setSelectedHistoryFile] = useState<string | null>(null);
  const [inlineSessionId, setInlineSessionId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // F09/D003-v3：研发入口抽屉（默认收起；详情数据直传）
  const [devEntryOpen, setDevEntryOpen] = useState(false);
  const phaseRailRef = useRef<HTMLDivElement>(null);

  // Esc 退出全屏
  useEffect(() => {
    if (!isFullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsFullscreen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    setIsFullscreen(false);
  }, [selection, tab, selectedFile, selectedHistoryFile]);

  // 默认选中：当前阶段（若无则第一个未完成阶段，再若无则最后一个阶段）
  useEffect(() => {
    if (!requirement || selection) return;
    const current = requirement.pipelinePhases.find((p) => p.name === requirement.phase);
    const firstIncomplete = requirement.pipelinePhases.find((p) => !p.completed);
    setSelection(current ?? firstIncomplete ?? requirement.pipelinePhases[requirement.pipelinePhases.length - 1] ?? null);
  }, [requirement, selection]);

  useEffect(() => {
    setSelectedFile(null);
  }, [selection]);

  // 长链（java-business 12 段）超出视口时在轨内横滑；打开时把当前节点滚进可视区，不带动整页
  useEffect(() => {
    const rail = phaseRailRef.current;
    if (!rail || !requirement) return;
    const current = rail.querySelector<HTMLElement>('[data-current="true"]');
    if (!current) return;
    const railBox = rail.getBoundingClientRect();
    const chipBox = current.getBoundingClientRect();
    const delta = chipBox.left - railBox.left - (railBox.width - chipBox.width) / 2;
    rail.scrollLeft += delta;
  }, [requirement]);

  const groups = workspace?.groups ?? [];
  const knownKeys = useMemo(
    () => new Set((requirement?.pipelinePhases ?? []).map((p) => pad2(p.order))),
    [requirement],
  );

  const othersEntries = useMemo(
    () => groups.filter((g) => g.key === 'others' || !knownKeys.has(g.key)).flatMap((g) => g.entries),
    [groups, knownKeys],
  );

  const selectedEntries = useMemo(() => {
    if (selection === 'others') return othersEntries;
    if (selection) {
      return groups.find((g) => g.key === pad2(selection.order))?.entries ?? [];
    }
    return [];
  }, [groups, selection, othersEntries]);

  // ── 各副轨数据（05-B4：三端点常载——副轨 pill 按 count>0 条件渲染，需先知有无数据） ──
  const { data: decisionsData } = useAPI<{ content: string; modified: string }>(`${base}/decisions/raw`);
  const decisionEntries = useMemo(() => parseDecisions(decisionsData?.content), [decisionsData?.content]);

  const { data: historyVersions } = useAPI<HistoryVersion[]>(`${base}/history`);

  const historyFilePath = tab === 'history' && selectedHistoryFile
    ? `${base}/history/${encodeURIComponent(selectedHistoryFile)}`
    : '';
  const { data: historyFileContent } = useAPI<{ content: string }>(historyFilePath);

  const { data: linkedSessions } = useAPI<LinkedSession[]>(`${base}/sessions`);

  // 产物预览（文本类通过 file 接口取内容）
  const selectedExt = selectedFile ? extOf(selectedFile.path) : '';
  const isTextPreview = Boolean(selectedFile) && (selectedExt === '.md' || TEXT_PREVIEW_EXT.has(selectedExt));
  const fileContentPath = fileTab && selectedFile && isTextPreview
    ? `${base}/file?path=${encodeURIComponent(selectedFile.path)}`
    : '';
  const { data: fileContent } = useAPI<{ content: string }>(fileContentPath);

  // BUG-002：useAPI 在 path 变空时保留上次 data——仅在「当前有选中文本文件」时取值，
  // 否则切换到无产物阶段时 previewContent 残留上一份，空态两分支进不去
  const previewContent = fileTab
    ? (selectedFile && isTextPreview ? fileContent?.content : undefined)
    : tab === 'decisions' ? decisionsData?.content
    : tab === 'history' ? historyFileContent?.content
    : undefined;

  const tocEntries = useMemo(() => parseTOC(previewContent), [previewContent]);

  function selectedFileLabel(): string {
    if (tab === 'decisions') return 'decisions.md';
    if (tab === 'history') return selectedHistoryFile ?? '';
    if (fileTab && selectedFile) return selectedFile.path;
    return '';
  }

  const codeLang = selectedExt === '.sql' ? 'sql' : (selectedExt === '.yaml' || selectedExt === '.yml') ? 'yaml' : codeLangOf(selectedExt);
  const isSheet = selectedExt === '.xlsx';
  const isFrame = FRAME_EXT.has(selectedExt);
  const rawUrl = fileTab && selectedFile && (IMAGE_EXT.has(selectedExt) || isFrame)
    ? `/api${base}/raw?path=${encodeURIComponent(selectedFile.path)}`
    : '';
  const sheetUrl = fileTab && selectedFile && isSheet
    ? `${base}/sheet?path=${encodeURIComponent(selectedFile.path)}`
    : '';

  // md 内相对路径图片 → raw 端点（相对 md 文件所在目录解析）
  function resolveImage(src: string): string {
    if (!src || /^https?:\/\//.test(src)) return src;
    const dir = selectedFile ? selectedFile.path.substring(0, selectedFile.path.lastIndexOf('/')) : '';
    const rel = dir ? `${dir}/${src}` : src;
    return `/api${base}/raw?path=${encodeURIComponent(rel)}`;
  }

  const hasFullscreenContent = tab !== 'sessions' && Boolean(
    (fileTab && selectedFile && (IMAGE_EXT.has(selectedExt) || isFrame || isSheet || isTextPreview)) || previewContent,
  );

  if (loading) return <LoadingSkeleton count={4} />;
  if (!requirement) {
    return <div className="text-sm text-red-400">工作空间不存在或加载失败：{name}</div>;
  }

  if (requirement.format === 'error') {
    return (
      <div className="space-y-3">
        <button onClick={() => navigate('/')} className="text-xs skin-primary hover:underline">
          ← 返回工作空间列表
        </button>
        <div className="p-4 rounded-lg border border-red-300 dark:border-red-800/60 bg-red-50/60 dark:bg-red-950/20">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">状态文件解析失败</p>
          <p className="text-xs text-red-600 dark:text-red-400/80 font-mono mt-1">{requirement.parseError}</p>
          <p className="text-[10px] skin-text-muted mt-2 font-mono">workspace/{name}/_state/current.md</p>
        </div>
      </div>
    );
  }

  function handlePhaseClick(phase: PipelinePhase) {
    setSelection(phase);
    setTab('artifacts');
  }

  function handleTabClick(kind: TabKind) {
    if (kind === 'others') {
      if (selection && selection !== 'others') stageBeforeOthers.current = selection;
      setSelection('others');
    } else if (kind === 'artifacts' && selection === 'others') {
      const restore = stageBeforeOthers.current;
      if (restore && restore !== 'others') setSelection(restore);
      else setSelection(null); // 无记忆 → 默认选中 effect 回当前阶段
    }
    setTab(kind);
  }

  // 副轨 pill 集：产物恒在；决策/历史/会话/未归类仅 count>0 渲染（有数据才出内容）
  const railPills: { kind: TabKind; label: string; visible: boolean }[] = [
    { kind: 'artifacts', label: '本阶段产物', visible: true },
    { kind: 'decisions', label: `决策 ${decisionEntries.length}`, visible: decisionEntries.length > 0 },
    { kind: 'history', label: `历史 ${historyVersions?.length ?? 0}`, visible: (historyVersions?.length ?? 0) > 0 },
    { kind: 'sessions', label: `会话 ${linkedSessions?.length ?? 0}`, visible: (linkedSessions?.length ?? 0) > 0 },
    { kind: 'others', label: `未归类 ${othersEntries.length}`, visible: othersEntries.length > 0 },
  ];

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-3rem)] min-w-0">
      <DevEntryDrawer
        reqName={name}
        open={devEntryOpen}
        onClose={() => setDevEntryOpen(false)}
        detail={requirement}
      />
      {/* 顶部：返回 + 需求信息 + TAPD 入口 + 冻结链轨（H7：轨=current.md phases 快照） */}
      <div className="shrink-0 min-w-0 p-3 skin-bg-card rounded-lg border skin-border">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <button
              onClick={() => navigate('/')}
              className="shrink-0 text-xs skin-primary hover:underline"
            >
              ← 返回列表
            </button>
            <span className="text-sm font-medium skin-text truncate">{requirement.name}</span>
            {requirement.profile && (
              <span className="px-1.5 py-0.5 rounded border text-[10px] font-mono shrink-0 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 skin-text-secondary" title={`绑定流程 profile：${requirement.profile}`}>
                {requirement.profile}
              </span>
            )}
            {requirement.tapdUrl && (
              <a
                href={requirement.tapdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-mono
                  bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/60
                  text-amber-600 dark:text-amber-400
                  hover:border-amber-400 dark:hover:border-amber-600 hover:underline transition-colors"
                title="新窗口打开 TAPD 故事"
              >
                TAPD ↗
              </a>
            )}
            <button
              onClick={() => setDevEntryOpen(true)}
              className="shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-mono
                bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700
                skin-text-secondary
                hover:border-[rgb(var(--skin-primary))] hover:underline transition-colors"
              title="打开研发入口抽屉（TAPD/研发计划/环境集群/流水线/SQL/Saturn/Apollo/监控）"
            >
              研发入口
            </button>
          </div>
          <span className="text-xs skin-text-muted font-mono shrink-0">
            {requirement.completedPhases}/{requirement.totalPhases} · {requirement.terminal ? '流程结束' : requirement.phase} · {formatStamp(requirement.updated_at)}
          </span>
        </div>
        <p className="text-xs mb-2 truncate">
          <span className="skin-text-muted">下一手 </span>
          <span className={requirement.terminal ? 'skin-text-secondary' : 'skin-primary'}>
            {requirement.next
              ? `${requirement.next.agent} · ${requirement.next.action}`
              : requirement.blockers.length
                ? `阻塞：${requirement.blockers.join('；')}`
                : '—'}
          </span>
        </p>
        {/* 冻结链轨：外层限宽出横滑，内层 w-max 按内容排开；虚线=未到，选中=正在读 */}
        <div ref={phaseRailRef} className="min-w-0 overflow-x-auto thin-scroll">
          <div className="flex items-center gap-1 w-max min-w-full pb-1">
            {requirement.pipelinePhases.map((p, i) => {
              const selected = selection === p;
              return (
                <div key={`${p.order}-${p.name}`} className="flex items-center shrink-0">
                  {i > 0 && <div className="w-3 h-px bg-gray-300 dark:bg-gray-600 mx-0.5" />}
                  <button
                    onClick={() => handlePhaseClick(p)}
                    aria-pressed={selected}
                    data-current={p.isCurrent ? 'true' : undefined}
                    title={`${p.name} · ${p.isCurrent ? '当前节点' : p.completed ? '已完成' : '未到'}`}
                    className={`relative text-left py-1 rounded-md border w-32 transition-colors ${
                      p.isCurrent ? 'pl-3 pr-2' : 'px-2'
                    } ${
                      !p.completed && !p.isCurrent ? 'border-dashed' : 'border-solid'
                    } ${
                      selected
                        ? 'skin-primary-bg-light skin-primary border-current'
                        : 'skin-border skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {p.isCurrent && (
                      <span className="absolute left-0 inset-y-1.5 w-0.5 rounded-full skin-primary-bg" aria-hidden />
                    )}
                    <div className={`text-[10px] font-mono flex items-center gap-1 ${p.isCurrent ? 'skin-primary' : 'opacity-80'}`}>
                      {p.isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden />}
                      <span className="truncate">
                        {pad2(p.order)} · {p.isCurrent ? '当前节点' : p.completed ? '已完成' : '未到'}
                      </span>
                    </div>
                    <div className="text-xs font-medium truncate">{p.name}</div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 副轨行：五类有数据才出 */}
      <div className="shrink-0 flex items-center gap-1.5 flex-wrap text-xs">
        <span className="skin-text-muted">副轨</span>
        {railPills.filter((p) => p.visible).map((p) => (
          <button
            key={p.kind}
            onClick={() => handleTabClick(p.kind)}
            className={`px-2.5 py-1 rounded-md border transition-colors ${
              tab === p.kind
                ? 'skin-primary-bg-light skin-primary border-current font-medium'
                : 'skin-border skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="skin-text-muted ml-auto">虚线未到 · 填充为正在读 · 主色点为当前节点</span>
      </div>

      {/* 内容区：左选择器 + 右预览（flex 填满剩余，不写死 280px） */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* 左侧 */}
        <div className="w-64 shrink-0 overflow-y-auto space-y-0.5 pr-1 thin-scroll">
          {fileTab && selectedEntries.length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] skin-text-muted font-medium">
                {selection === 'others' ? '未归类 · 文件' : selection ? `${selection.name} · 产物` : ''}
              </div>
              <WorkspaceTree
                key={selection === 'others' ? 'others' : selection ? `phase-${selection.order}` : 'none'}
                nodes={selectedEntries}
                selectedPath={selectedFile?.path}
                onSelect={setSelectedFile}
                expandAll={selection !== 'others'}
              />
            </>
          )}

          {tab === 'decisions' && (
            <>
              {decisionEntries.length > 0 ? (
                decisionEntries.map((entry, i) => (
                  <button
                    key={`${entry.id}-${i}`}
                    onClick={() => jumpToHeading(entry.slug)}
                    className="w-full text-left p-2 rounded text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 group"
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span className="font-mono skin-text-muted text-[10px]">{entry.id} · {entry.date}</span>
                    </div>
                    <p className="skin-text-secondary line-clamp-2 group-hover:skin-primary">{entry.title}</p>
                  </button>
                ))
              ) : (
                <p className="text-xs skin-text-muted px-2 py-2">暂无决策记录</p>
              )}
            </>
          )}

          {tab === 'history' && (
            <>
              {historyVersions && historyVersions.length > 0 ? (
                historyVersions.map((v) => (
                  <button
                    key={v.filename}
                    onClick={() => setSelectedHistoryFile(v.filename)}
                    title={v.filename}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                      selectedHistoryFile === v.filename
                        ? 'skin-primary-bg-light skin-primary'
                        : 'skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{v.filename}</span>
                      <span className="text-[10px] skin-text-muted shrink-0 ml-1">v{v.version}</span>
                    </div>
                    <div className="text-[10px] skin-text-muted">
                      {new Date(v.modified).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-xs text-gray-400 px-2">暂无历史版本</p>
              )}
            </>
          )}

          {tab === 'sessions' && (
            <>
              {linkedSessions && linkedSessions.length > 0 ? (
                linkedSessions.map((s) => (
                  <button
                    key={s.sessionId}
                    onClick={() => setInlineSessionId(inlineSessionId === s.sessionId ? null : s.sessionId)}
                    className={`w-full text-left p-2 rounded text-xs transition-colors ${
                      inlineSessionId === s.sessionId
                        ? 'border border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-mono skin-text-muted">{s.sessionId.slice(0, 8)}...</span>
                      <span className="text-[10px] skin-text-muted">
                        {new Date(s.modified).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {s.firstPrompt && <p className="skin-text-secondary line-clamp-2">{s.firstPrompt}</p>}
                  </button>
                ))
              ) : (
                <p className="text-xs skin-text-muted px-2 py-2">暂无关联会话</p>
              )}
            </>
          )}
        </div>

        {/* 右侧预览 */}
        <div className="flex-1 flex flex-col min-w-0 border skin-border rounded-lg overflow-hidden relative">
          {hasFullscreenContent && (
            <div className="flex items-center justify-between px-3 py-2 border-b skin-border shrink-0">
              <span className="text-xs skin-text-muted truncate" title={selectedFileLabel()}>
                {selectedFileLabel()}
              </span>
              <button
                onClick={() => setIsFullscreen(true)}
                className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100
                           dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                title="全屏预览"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 thin-scroll">
            {tab === 'sessions' ? (
              inlineSessionId ? (
                <SessionInline sessionId={inlineSessionId} onClose={() => setInlineSessionId(null)} />
              ) : (
                <div className="flex items-center justify-center h-full skin-text-muted text-sm">选择会话查看内容</div>
              )
            ) : fileTab && selectedFile && (IMAGE_EXT.has(selectedExt) || isFrame || isSheet) ? (
              <ArtifactPreview
                kind={isSheet ? 'sheet' : isFrame ? (selectedExt === '.pdf' ? 'pdf' : 'html') : 'image'}
                title={selectedFile.name}
                rawUrl={rawUrl}
                sheetUrl={sheetUrl}
                fill={false}
              />
            ) : fileTab && selectedFile && !isTextPreview ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-sm skin-text-secondary mb-1">暂不支持预览此文件类型（{selectedExt || '无扩展名'}）</p>
                  <p className="text-xs skin-text-muted font-mono">{selectedFile.path} · {formatSize(selectedFile.size)}</p>
                </div>
              </div>
            ) : fileTab && selectedFile && codeLang && previewContent != null ? (
              <CodePreview content={previewContent} language={codeLang} />
            ) : fileTab && selectedFile && selectedExt !== '.md' && isTextPreview && previewContent != null ? (
              <pre className="text-xs leading-relaxed whitespace-pre overflow-x-auto font-mono skin-text-secondary">
                {previewContent}
              </pre>
            ) : previewContent ? (
              <MarkdownPreview
                content={previewContent}
                headingIdFn={(_, text) => defaultSlugify(text)}
                resolveImage={resolveImage}
              />
            ) : (
              <div className="flex items-center justify-center h-full skin-text-muted text-sm text-center px-6">
                {fileTab && selectedFile && '加载中...'}
                {fileTab && !selectedFile && (
                  selection && selection !== 'others' && selectedEntries.length === 0
                    ? selection.isCurrent
                      ? <span>这一阶段的产物文件还没落盘。当前下一手：{requirement.next ? `${requirement.next.agent} · ${requirement.next.action}` : '—'}</span>
                      : <span>冻结链上这一阶段还没到，目录里没有对应产物。</span>
                    : '选择文件预览内容'
                )}
                {tab === 'decisions' && (decisionEntries.length > 0 ? '点击左侧决策跳转对应段落' : '暂无决策记录')}
                {tab === 'history' && (selectedHistoryFile ? '加载中...' : '选择历史版本')}
              </div>
            )}
          </div>

          {tab !== 'sessions' && <TocOverlay entries={tocEntries} onJump={jumpToHeading} />}
        </div>
      </div>

      {/* 全屏文档预览（Esc 或 X 关闭） */}
      {isFullscreen && hasFullscreenContent && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-gray-900">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                {requirement.name}
              </h2>
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                {selectedFileLabel()}
              </span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                         dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              title="关闭全屏 (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-6 thin-scroll">
            {fileTab && selectedFile && (IMAGE_EXT.has(selectedExt) || isFrame || isSheet) ? (
              <ArtifactPreview
                kind={isSheet ? 'sheet' : isFrame ? (selectedExt === '.pdf' ? 'pdf' : 'html') : 'image'}
                title={selectedFile.name}
                rawUrl={rawUrl}
                sheetUrl={sheetUrl}
                fill
              />
            ) : fileTab && selectedFile && codeLang && previewContent != null ? (
              <CodePreview content={previewContent} language={codeLang} />
            ) : fileTab && selectedFile && selectedExt !== '.md' && isTextPreview && previewContent != null ? (
              <pre className="max-w-4xl mx-auto text-xs leading-relaxed whitespace-pre overflow-x-auto font-mono skin-text-secondary">
                {previewContent}
              </pre>
            ) : previewContent ? (
              <div className="max-w-4xl mx-auto">
                <MarkdownPreview
                  content={previewContent}
                  headingIdFn={(_, text) => defaultSlugify(text)}
                  resolveImage={resolveImage}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
