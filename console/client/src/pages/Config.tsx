// ── 配置中心（F01/D002 X03：左配置源分类树 + 右内容查看器；白名单与掩码在 server/config-files.ts）──
// 三类配置全量可查看：三级配置（L1/L2/合并/L3）+ 流程 profile（含 gates）+ SPEC×4 + hooks + console 运行配置
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../hooks/useAPI';
import { MarkdownPreview } from '../components/MarkdownPreview';

type FileKind = 'yaml' | 'md' | 'sh' | 'merge' | 'override' | 'console-runtime' | 'link';
interface FileEntry { id: string; label: string; kind: FileKind }
interface Category { id: string; label: string; files: FileEntry[] }
interface RepoInfo { repo?: { tag?: string; commit?: string }; overrides?: { req: string; keys: string[] }[] }

const KIND_BADGE: Record<FileKind, string> = {
  yaml: 'yaml', md: 'md', sh: 'sh', merge: '视图', override: '机制', 'console-runtime': '掩码', link: '跳转',
};

export function Config() {
  const navigate = useNavigate();
  const { data: index, loading: idxLoading } = useAPI<{ categories: Category[] }>('/config/files');
  const { data: repoInfo } = useAPI<RepoInfo>('/config');
  const [selected, setSelected] = useState<FileEntry | null>(null);

  useEffect(() => {
    if (!selected && index?.categories?.length) setSelected(index.categories[0].files[0] ?? null);
  }, [index, selected]);

  const contentPath = selected && selected.kind !== 'link' ? `/config/file/${selected.id}` : '';
  const { data: fileData, loading: fileLoading } = useAPI<{ content: string }>(contentPath);

  const isMd = selected?.kind === 'md';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold skin-text mb-1">配置中心</h2>
        <p className="text-xs skin-text-muted">
          来源：工具仓真值 · 敏感值已掩码（X07）
          {repoInfo?.repo && <> · 整仓 {repoInfo.repo.tag || '（无 tag）'} @{repoInfo.repo.commit}</>}
          {repoInfo?.overrides?.length
            ? <> · 覆盖工作空间：{repoInfo.overrides.map((o) => `${o.req}(${o.keys.length}键)`).join('、')}</>
            : ' · 覆盖工作空间：无'}
        </p>
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)' }}>
        {/* 左：配置源分类树 */}
        <div className="w-64 shrink-0 overflow-y-auto pr-1 thin-scroll space-y-3">
          {idxLoading && <p className="text-xs skin-text-muted px-2">加载中…</p>}
          {index?.categories?.map((cat) => (
            <div key={cat.id}>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider skin-text-muted">{cat.label}</div>
              <div className="space-y-0.5">
                {cat.files.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f)}
                    className={`w-full flex items-center justify-between gap-2 text-left px-2 py-1.5 rounded text-xs transition-colors ${
                      selected?.id === f.id
                        ? 'skin-primary-bg-light skin-primary'
                        : 'skin-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className="truncate">{f.label}</span>
                    <span className="shrink-0 px-1 rounded text-[9px] font-mono bg-gray-100 dark:bg-gray-700 skin-text-muted">
                      {KIND_BADGE[f.kind]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 右：内容查看器 */}
        <div className="flex-1 flex flex-col min-w-0 border skin-border rounded-lg overflow-hidden">
          {selected?.kind === 'link' ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <p className="text-sm skin-text-secondary">操作卡 13 张与 agent-contract 在「流程定义」页查看</p>
                <button
                  onClick={() => navigate('/pipeline')}
                  className="px-3 py-1.5 rounded-md text-xs skin-primary-bg-light skin-primary border border-[rgb(var(--skin-primary)/0.4)] hover:brightness-95 transition"
                >
                  前往流程定义 →
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b skin-border shrink-0">
                <span className="text-xs skin-text-muted truncate">{selected?.label ?? ''}</span>
                <span className="text-[10px] skin-text-muted font-mono shrink-0">{selected?.kind}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 thin-scroll">
                {fileLoading && <p className="text-xs skin-text-muted">加载中…</p>}
                {!fileLoading && isMd && fileData?.content ? (
                  <MarkdownPreview content={fileData.content} />
                ) : !fileLoading && fileData?.content ? (
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap break-all font-mono skin-text-secondary">
                    {fileData.content}
                  </pre>
                ) : !fileLoading ? (
                  <p className="text-xs skin-text-muted">选择左侧配置源查看内容</p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
