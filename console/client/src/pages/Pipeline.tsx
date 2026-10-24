// ── 流程定义（05-B2/F1 上轨下读：阶段链轨=导航，操作卡整页阅读；替代 mermaid+表格行内展开）──
// 数据源不变：GET /api/pipeline/overview（stages 链序+gate/gateSource、subnodes）+ GET /api/pipeline/skill/:name
// flowchartMermaid 字段仍在响应但前端停消费（H3 接口零改动）；X02：协议入口=前端常量，不入 overview
import { useEffect, useRef, useState } from 'react';
import { useAPI } from '../hooks/useAPI';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { MarkdownPreview, defaultSlugify } from '../components/MarkdownPreview';
import { parseTOC, jumpToHeading, pad2 } from '../utils/workflow';

interface StageRow {
  order: number;
  name: string;
  agent: string;
  gate: 'human' | 'auto' | string;
  gateSource?: 'advance_gates' | 'repo' | string;
  skillName: string;
}

interface PipelineOverview {
  stages: StageRow[];
  subnodes: { name: string; agent: string }[];
  flowchartMermaid: string; // 保留响应字段（H3）；前端不再渲染
  profile: string;
  source: string;
}

// X02：协议入口为前端常量（不入 overview 响应），独立入口不进阶段链（H8）
const CONTRACT_SKILL = 'agent-contract';

// D003：09 子节点 → 操作卡小节锚点关键词；无命中停卡顶（不改操作卡，H4）
const SUBNODE_STAGE = 'Agent自动化测试';
const SUBNODE_ANCHOR_KEYWORD: Record<string, string> = { 执行: '执行', 修复: '修复', 部署: '部署' };

// 06 建议1：pill 带各链阶段数（与 skill/pipeline/{profile}.yaml phases 长度一致；默认=仓级 pipeline.profile）
const PROFILE_CHAIN_LENGTH: Record<string, number> = { 'toolchain': 9, 'java-business': 12, 'data-script': 7 };

const PROFILE_OPTIONS = [
  ['', '默认'],
  ['toolchain', 'toolchain'],
  ['java-business', 'java-business'],
  ['data-script', 'data-script'],
] as const;

export function Pipeline() {
  // F07/D005+profile场景定制：三链切换（java/toolchain/data-script）——切换即重取（advance_gates 优先，仓级兜底）
  const [profileSel, setProfileSel] = useState<'' | 'toolchain' | 'java-business' | 'data-script'>('');
  const { data: overview, loading } = useAPI<PipelineOverview>(
    `/pipeline/overview${profileSel ? `?profile=${profileSel}` : ''}`,
  );

  const [stageName, setStageName] = useState<string | null>(null);
  const [docKind, setDocKind] = useState<'stage' | 'contract'>('stage');
  // D003：待跳锚点关键词（等内容载入后消费）；lastAnchor 仅用于子节点 pill 选中态
  const [pendingKeyword, setPendingKeyword] = useState<string | null>(null);
  const [lastAnchor, setLastAnchor] = useState<string | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  const stages = overview?.stages ?? [];

  // 链切换兜底：选中阶段不在新链（或首次加载）→ 回链首
  useEffect(() => {
    if (!stages.length) return;
    if (!stageName || !stages.some((s) => s.name === stageName)) setStageName(stages[0].name);
  }, [stages, stageName]);

  const stage = stages.find((s) => s.name === stageName) ?? null;
  const chainIndex = stage ? stages.findIndex((s) => s.name === stage.name) : -1;
  const skillName = docKind === 'contract' ? CONTRACT_SKILL : stage?.skillName ?? '';

  const { data: skillContent } = useAPI<{ name: string; content: string }>(
    skillName ? `/pipeline/skill/${encodeURIComponent(skillName)}` : '',
  );

  const tocEntries = parseTOC(skillContent?.content);

  // D003 锚点消费：内容就绪后按关键词跳首个命中小节；无命中停卡顶（scrollTop=0）
  useEffect(() => {
    if (!pendingKeyword || !skillContent?.content) return;
    const hit = tocEntries.find((t) => t.text.includes(pendingKeyword));
    if (hit) {
      jumpToHeading(hit.id);
      setLastAnchor(pendingKeyword);
    } else {
      readerRef.current?.scrollTo({ top: 0 });
      setLastAnchor(pendingKeyword);
    }
    setPendingKeyword(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillContent?.content, pendingKeyword]);

  function openStage(name: string) {
    setDocKind('stage');
    setStageName(name);
    setLastAnchor(null);
    readerRef.current?.scrollTo({ top: 0 });
  }

  function openSubnode(snName: string) {
    const short = snName.split('/').pop() ?? snName;
    if (!stages.some((s) => s.name === SUBNODE_STAGE)) return;
    setDocKind('stage');
    setStageName(SUBNODE_STAGE);
    setPendingKeyword(SUBNODE_ANCHOR_KEYWORD[short] ?? short);
  }

  function openContract() {
    setDocKind('contract');
    setLastAnchor(null);
    readerRef.current?.scrollTo({ top: 0 });
  }

  if (loading) return <LoadingSkeleton count={4} />;

  const gate = stage?.gate ?? '';
  const gateSourceText =
    docKind === 'contract'
      ? 'skill/protocol/agent-contract.md'
      : stage?.gateSource === 'advance_gates'
        ? `advance_gates(${overview?.profile ?? ''})`
        : '仓级 nodes.stages 兜底';

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-3rem)]">
      {/* 顶栏：标题 + profile 切换 + 数据源 note */}
      <div className="shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold skin-text">流程定义</h2>
          {PROFILE_OPTIONS.map(([val, label]) => {
            const chainLen = PROFILE_CHAIN_LENGTH[val || (overview?.profile ?? '')];
            return (
              <button
                key={label}
                onClick={() => setProfileSel(val)}
                className={`px-2 py-0.5 rounded font-medium border skin-border text-xs ${
                  profileSel === val ? 'skin-primary-bg-light skin-primary' : 'skin-text-muted hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {label}{chainLen ? ` · ${chainLen}` : ''}
              </button>
            );
          })}
        </div>
        {overview?.source && (
          <p className="text-xs skin-text-muted mt-1">
            数据源：{overview.source} · 当前链 {stages.length} 阶段 · 副轨子节点 {overview.subnodes?.length ?? 0} · agent-contract 独立入口
          </p>
        )}
      </div>

      {/* 阶段链轨：chip 间横连接线；实线=human 停等、虚线=auto 直推；点阶段整页读卡 */}
      <div className="shrink-0 border skin-border rounded-lg skin-bg-card overflow-x-auto thin-scroll">
        <div className="flex items-center gap-1 px-3 py-2.5 w-max min-w-full">
          {stages.map((s, i) => {
            const selected = docKind === 'stage' && s.name === stageName;
            return (
              <div key={s.order} className="flex items-center shrink-0">
                {i > 0 && <div className="w-3.5 h-px bg-gray-300 dark:bg-gray-600 mx-0.5" />}
                <button
                  onClick={() => openStage(s.name)}
                  aria-pressed={selected}
                  title={`${s.name} · ${s.agent} · ${s.gate}`}
                  className={`text-left px-2 py-1 rounded-md border w-36 transition-colors ${
                    s.gate === 'human' ? 'border-solid' : 'border-dashed'
                  } ${
                    selected
                      ? 'skin-primary-bg-light skin-primary border-current'
                      : 'skin-border skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="text-[10px] opacity-80 font-mono">{pad2(s.order)} · {s.gate}</div>
                  <div className="text-xs font-medium truncate">{s.name}</div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 副轨行：09 子节点（锚点跳转）+ agent-contract 独立入口 + 图例 */}
      {overview?.subnodes?.length ? (
        <div className="shrink-0 flex items-center gap-2 flex-wrap text-xs px-1">
          <span className="skin-text-muted">{SUBNODE_STAGE} 子节点：</span>
          {overview.subnodes.map((sn) => {
            const short = sn.name.split('/').pop() ?? sn.name;
            const active =
              docKind === 'stage' && stageName === SUBNODE_STAGE && lastAnchor === (SUBNODE_ANCHOR_KEYWORD[short] ?? short);
            return (
              <button
                key={sn.name}
                onClick={() => openSubnode(sn.name)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  active
                    ? 'skin-primary-bg-light skin-primary border-current'
                    : 'skin-border skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {short} · {sn.agent}
              </button>
            );
          })}
          <button
            onClick={openContract}
            className={`px-2 py-0.5 rounded border font-mono transition-colors ${
              docKind === 'contract'
                ? 'skin-primary-bg-light skin-primary border-current'
                : 'skin-border skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            agent-contract
          </button>
          <span className="skin-text-muted ml-auto">实线 human 停等 · 虚线 auto 直推</span>
        </div>
      ) : null}

      {/* 阅读区：左本节目录 + 右整页操作卡 */}
      <div className="flex-1 min-h-0 flex border skin-border rounded-lg skin-bg-card overflow-hidden">
        <div className="w-44 shrink-0 border-r skin-border overflow-y-auto thin-scroll p-2">
          <div className="text-[10px] skin-text-muted font-medium px-2 py-1">本节目录</div>
          <div className="space-y-0.5 mt-1">
            {tocEntries.length ? (
              tocEntries.map((t) => (
                <button
                  key={`${t.level}-${t.id}`}
                  onClick={() => jumpToHeading(t.id)}
                  className="w-full text-left px-2 py-1 rounded text-xs skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 hover:skin-primary truncate"
                  style={{ paddingLeft: `${(t.level - 1) * 10 + 8}px` }}
                  title={t.text}
                >
                  {t.text}
                </button>
              ))
            ) : (
              <p className="text-xs skin-text-muted px-2 py-2">{skillContent ? '无小节' : '加载中...'}</p>
            )}
          </div>
        </div>

        <div ref={readerRef} className="flex-1 min-w-0 overflow-y-auto thin-scroll relative">
          <div className="sticky top-0 z-10 skin-bg-card border-b skin-border px-4 py-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold skin-text truncate">
                  {docKind === 'contract' ? '协作协议（agent-contract）' : stage?.name ?? '—'}
                </h3>
                <p className="text-xs skin-text-muted mt-0.5">
                  {docKind === 'contract'
                    ? '不进入阶段链 · 独立入口'
                    : `链上第 ${chainIndex + 1} / ${stages.length} 步 · 库编号 ${stage ? pad2(stage.order) : '--'}`}
                </p>
              </div>
              {docKind === 'stage' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => chainIndex > 0 && openStage(stages[chainIndex - 1].name)}
                    disabled={chainIndex <= 0}
                    className="px-2 py-1 rounded text-xs border skin-border skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    上一阶段
                  </button>
                  <button
                    onClick={() => chainIndex >= 0 && chainIndex < stages.length - 1 && openStage(stages[chainIndex + 1].name)}
                    disabled={chainIndex < 0 || chainIndex >= stages.length - 1}
                    className="px-2 py-1 rounded text-xs border skin-border skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    下一阶段
                  </button>
                </div>
              )}
            </div>
            {docKind === 'stage' && stage && (
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-700 skin-text-secondary">{stage.agent}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium font-mono ${
                    stage.gate === 'human'
                      ? 'bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400'
                      : 'bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800/60 text-violet-600 dark:text-violet-400'
                  }`}
                >
                  {stage.gate}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono skin-primary-bg-light skin-primary">{stage.skillName}.md</span>
                <span className="text-[10px] skin-text-muted">门禁来源：{gateSourceText}</span>
              </div>
            )}
          </div>

          <div className="p-4">
            {docKind === 'stage' && gate === 'human' && (
              <div className="mb-3 p-2.5 rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">本阶段停等确认</p>
                <p className="text-xs text-amber-600/90 dark:text-amber-400/80 mt-0.5">
                  产物写完后不自动进入下一阶段。这条门禁来自{stage?.gateSource === 'advance_gates' ? '当前 profile 的 advance_gates' : '仓级兜底'}。
                </p>
              </div>
            )}
            {skillContent?.content ? (
              <MarkdownPreview content={skillContent.content} headingIdFn={(_, text) => defaultSlugify(text)} />
            ) : (
              <p className="text-xs text-gray-400">加载中...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
