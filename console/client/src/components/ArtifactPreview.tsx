// 未归类产物里的二进制/页面：png 走图片，pdf/html 走 iframe，xlsx 走表格。
import { useEffect, useState } from 'react';
import { useAPI } from '../hooks/useAPI';

export interface SheetGrid {
  name: string;
  rows: string[][];
  truncated: boolean;
}

function FramePreview({ src, title, sandbox, fill }: {
  src: string;
  title: string;
  sandbox?: string;
  fill: boolean;
}) {
  return (
    <iframe
      title={title}
      src={src}
      sandbox={sandbox}
      className={`w-full bg-white rounded border skin-border ${fill ? 'h-[calc(100vh-4.5rem)]' : 'h-[min(720px,calc(100vh-14rem))] min-h-[420px]'}`}
    />
  );
}

function SheetTable({ path }: { path: string }) {
  const { data, loading, error } = useAPI<{ sheets: SheetGrid[] }>(path);
  const [active, setActive] = useState(0);
  useEffect(() => { setActive(0); }, [path]);
  const sheets = data?.sheets ?? [];
  const index = Math.min(active, Math.max(sheets.length - 1, 0));
  const sheet = sheets[index];

  if (loading) return <p className="text-sm skin-text-muted">表格加载中...</p>;
  if (error || !data) return <p className="text-sm text-red-400">表格无法预览{error ? `（${error}）` : ''}</p>;

  return (
    <div data-sheet-preview className="rounded-lg border skin-border overflow-hidden bg-gray-50 dark:bg-gray-950/40">
      <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-1.5 border-b skin-border bg-gray-100/95 dark:bg-gray-900/95 overflow-x-auto">
        {sheets.map((s, i) => (
          <button
            key={`${s.name}-${i}`}
            type="button"
            onClick={() => setActive(i)}
            className={`shrink-0 px-2 py-0.5 rounded text-[11px] border ${
              i === index
                ? 'skin-primary-bg-light skin-primary border-current'
                : 'skin-border skin-text-secondary'
            }`}
          >
            {s.name}
          </button>
        ))}
        {sheet?.truncated && <span className="text-[10px] skin-text-muted shrink-0 ml-auto">已截断，仅显示前 500 行 / 40 列</span>}
      </div>
      {sheet && sheet.rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="border-collapse text-xs min-w-full">
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r} className={r === 0 ? 'font-medium bg-gray-100 dark:bg-gray-800' : ''}>
                  {row.map((cell, c) => (
                    <td key={c} className="border skin-border px-2 py-1 whitespace-pre align-top skin-text-secondary">
                      {cell || '\u00a0'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs skin-text-muted px-3 py-6">这张表没有单元格</p>
      )}
    </div>
  );
}

export function ArtifactPreview({ kind, title, rawUrl, sheetUrl, fill }: {
  kind: 'image' | 'pdf' | 'html' | 'sheet';
  title: string;
  rawUrl?: string;
  sheetUrl?: string;
  fill: boolean;
}) {
  if (kind === 'image' && rawUrl) {
    return (
      <div className="flex items-start justify-center">
        <img src={rawUrl} alt={title} className={`max-w-full rounded border skin-border ${fill ? 'max-h-full' : ''}`} />
      </div>
    );
  }
  if (kind === 'pdf' && rawUrl) return <FramePreview src={rawUrl} title={title} fill={fill} />;
  if (kind === 'html' && rawUrl) return <FramePreview src={rawUrl} title={title} sandbox="allow-scripts" fill={fill} />;
  if (kind === 'sheet' && sheetUrl) return <SheetTable path={sheetUrl} />;
  return null;
}
