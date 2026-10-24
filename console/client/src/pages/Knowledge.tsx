// ── 知识库（F06/D002 X05：root 切换 + 逐层懒加载树 + Preview/Source + 全屏；形态=claude-board Acknowledge）──
// 数据根=工具仓 dev-swarm.yaml knowledge[].ref（仅 local-path 可浏览）；gitnexus_repos 置灰不下钻（严于源，04 S2）
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAPI } from '../hooks/useAPI';
import { MarkdownPreview, defaultSlugify } from '../components/MarkdownPreview';
import { TocOverlay } from '../components/TocOverlay';
import { parseTOC, jumpToHeading } from '../utils/workflow';

interface KnowledgeRoot { project: string; type: string; ref: string; browsable: boolean }
interface TreeEntry { name: string; path: string; isDir: boolean; hasMd: boolean; noDrill?: boolean }

export function Knowledge() {
  const { data: rootsData } = useAPI<{ entries: KnowledgeRoot[] }>('/knowledge/roots');
  const roots = rootsData?.entries ?? [];
  const browsableRoots = roots.filter((r) => r.browsable);

  const [root, setRoot] = useState('');
  const [childrenOf, setChildrenOf] = useState<Record<string, TreeEntry[]>>({});
  const [loadingOf, setLoadingOf] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<TreeEntry | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!root && browsableRoots.length) setRoot(browsableRoots[0].project);
  }, [browsableRoots, root]);

  const loadDir = useCallback(async (dir: string) => {
    setLoadingOf((m) => ({ ...m, [dir]: true }));
    try {
      const r = await fetch(`/api/knowledge/tree?root=${encodeURIComponent(root)}&path=${encodeURIComponent(dir)}`);
      const j = await r.json();
      if (Array.isArray(j.entries)) setChildrenOf((m) => ({ ...m, [dir]: j.entries }));
    } catch { /* 网络失败保留空 */ }
    finally { setLoadingOf((m) => ({ ...m, [dir]: false })); }
  }, [root]);

  useEffect(() => { if (root) loadDir(''); }, [root, loadDir]);

  // 切 root 清空树与选中
  function switchRoot(p: string) { setRoot(p); setChildrenOf({}); setExpanded(new Set()); setSelected(null); }

  function toggleDir(e: TreeEntry) {
    if (e.noDrill) return; // 置灰不下钻（H06，严于源）
    const isOpen = expanded.has(e.path);
    setExpanded((s) => { const n = new Set(s); isOpen ? n.delete(e.path) : n.add(e.path); return n; });
    if (!isOpen && !childrenOf[e.path]) loadDir(e.path);
  }

  const filePath = selected && !selected.isDir
    ? `/knowledge/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent(selected.path)}`
    : '';
  const { data: fileData } = useAPI<{ content: string }>(filePath);

  const previewContent = fileData?.content;
  const tocEntries = useMemo(() => parseTOC(previewContent), [previewContent]);

  // md 内相对图片 → knowledge image 端点（相对 md 所在目录解析）
  function resolveImage(src: string): string {
    if (!src || /^https?:\/\//.test(src)) return src;
    const dir = selected ? selected.path.substring(0, selected.path.lastIndexOf('/')) : '';
    const rel = dir ? `${dir}/${src}` : src;
    return `/api/knowledge/image?root=${encodeURIComponent(root)}&path=${encodeURIComponent(rel)}`;
  }

  // Esc 退出全屏
  useEffect(() => {
    if (!isFullscreen) return;
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') setIsFullscreen(false); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  useEffect(() => { setIsFullscreen(false); }, [selected]);

  function renderDir(dir: string, depth: number) {
    const entries = childrenOf[dir] ?? [];
    return entries.map((e) => {
      const isOpen = expanded.has(e.path);
      return (
        <div key={e.path}>
          <button
            onClick={() => (e.isDir ? toggleDir(e) : setSelected(e))}
            className={`w-full flex items-center gap-1.5 text-left rounded text-xs py-1 pr-1 transition-colors ${
              e.noDrill
                ? 'opacity-40 cursor-not-allowed skin-text-muted'
                : selected?.path === e.path
                  ? 'skin-primary-bg-light skin-primary'
                  : e.isDir ? 'skin-text hover:bg-gray-100 dark:hover:bg-gray-800' : 'skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            title={e.noDrill ? '不下钻（gitnexus_repos）' : e.path}
          >
            <span className="shrink-0 w-3 text-center skin-text-muted text-[9px]">
              {e.isDir ? (e.noDrill ? '🔒' : isOpen ? '▾' : '▸') : '·'}
            </span>
            <span className="truncate">{e.name}</span>
            {e.isDir && !e.hasMd && !e.noDrill && <span className="shrink-0 text-[9px] skin-text-muted">(无 md)</span>}
          </button>
          {e.isDir && isOpen && !e.noDrill && renderDir(e.path, depth + 1)}
        </div>
      );
    });
  }

  if (!browsableRoots.length) {
    return (
      <div>
        <h2 className="text-lg font-semibold skin-text mb-4">知识库</h2>
        <p className="text-sm skin-text-muted">无可浏览的知识库（dev-swarm.yaml knowledge 未配置 local-path 类型，或 ref 目录不存在）</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold skin-text">知识库</h2>
        {browsableRoots.length > 1 && (
          <select
            value={root}
            onChange={(e) => switchRoot(e.target.value)}
            className="text-xs skin-bg-card skin-text border skin-border rounded px-2 py-1"
          >
            {browsableRoots.map((r) => <option key={r.project} value={r.project}>{r.project}</option>)}
          </select>
        )}
        {roots.length > browsableRoots.length && (
          <span className="text-[10px] skin-text-muted">
            另有 {roots.length - browsableRoots.length} 条非 local-path 条目不可浏览（X05）
          </span>
        )}
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)' }}>
        {/* 左：目录树（逐层懒加载） */}
        <div className="w-72 shrink-0 overflow-y-auto pr-1 thin-scroll border skin-border rounded-lg p-2">
          {loadingOf[''] && !childrenOf['']?.length && <p className="text-xs skin-text-muted px-2 py-1">加载中…</p>}
          {renderDir('', 0)}
        </div>

        {/* 右：内容（Preview/Source + 全屏） */}
        <div className="flex-1 flex flex-col min-w-0 border skin-border rounded-lg overflow-hidden relative">
          <div className="flex items-center justify-between px-3 py-2 border-b skin-border shrink-0">
            <span className="text-xs skin-text-muted truncate" title={selected?.path}>{selected?.path ?? ''}</span>
            {selected && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded p-0.5">
                  <button
                    onClick={() => setSourceMode(false)}
                    className={`px-2 py-0.5 rounded text-[11px] ${!sourceMode ? 'bg-white dark:bg-gray-700 skin-text shadow-sm' : 'skin-text-muted'}`}
                  >Preview</button>
                  <button
                    onClick={() => setSourceMode(true)}
                    className={`px-2 py-0.5 rounded text-[11px] ${sourceMode ? 'bg-white dark:bg-gray-700 skin-text shadow-sm' : 'skin-text-muted'}`}
                  >Source</button>
                </div>
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                  title="全屏预览"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 thin-scroll">
            {sourceMode && previewContent ? (
              <pre className="text-xs leading-relaxed whitespace-pre-wrap break-all font-mono skin-text-secondary">{previewContent}</pre>
            ) : previewContent ? (
              <MarkdownPreview
                content={previewContent}
                headingIdFn={(_, text) => defaultSlugify(text)}
                resolveImage={resolveImage}
              />
            ) : (
              <div className="flex items-center justify-center h-full skin-text-muted text-sm">
                {selected ? '加载中...' : '选择左侧 .md 文件预览'}
              </div>
            )}
          </div>
          {previewContent && <TocOverlay entries={tocEntries} onJump={jumpToHeading} />}
        </div>
      </div>

      {/* 全屏（Esc 关闭） */}
      {isFullscreen && previewContent && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-gray-900">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{selected?.path}</span>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              title="关闭全屏 (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-6 thin-scroll">
            {sourceMode ? (
              <pre className="max-w-4xl mx-auto text-xs leading-relaxed whitespace-pre-wrap break-all font-mono skin-text-secondary">{previewContent}</pre>
            ) : (
              <div className="max-w-4xl mx-auto">
                <MarkdownPreview
                  content={previewContent}
                  headingIdFn={(_, text) => defaultSlugify(text)}
                  resolveImage={resolveImage}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
