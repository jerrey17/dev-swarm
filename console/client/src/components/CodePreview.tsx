// SQL / YAML 预览：上色 + 行号 + 一键复制全文（复制的是原文，不是上色后的片段）
import { useEffect, useState } from 'react';
import { codeLangOf, codeLines, CODE_LABEL, type CodeLang, type CodeSpan } from '../utils/codeHighlight';
import { sqlLines, type SqlSpan } from '../utils/sqlHighlight';
import { yamlLines, type YamlSpan } from '../utils/yamlHighlight';

type PreviewLang = 'sql' | 'yaml' | CodeLang;
type Span = SqlSpan | YamlSpan | CodeSpan;

export { codeLangOf };

const KIND_CLASS: Record<Span['kind'], string> = {
  keyword: 'text-sky-700 dark:text-sky-300',
  key: 'text-violet-700 dark:text-violet-300',
  string: 'text-emerald-700 dark:text-emerald-300',
  comment: 'text-gray-500 italic',
  number: 'text-amber-700 dark:text-amber-300',
  text: '',
};

const LANG: Record<PreviewLang, { name: string; copy: string; title: string }> = {
  sql: { name: 'SQL', copy: '复制 SQL', title: '复制全部 SQL' },
  yaml: { name: 'YAML', copy: '复制 YAML', title: '复制全部 YAML' },
  ...Object.fromEntries((Object.keys(CODE_LABEL) as CodeLang[]).map((id) => {
    const name = CODE_LABEL[id];
    return [id, { name, copy: `复制 ${name}`, title: `复制全部 ${name}` }];
  })) as Record<CodeLang, { name: string; copy: string; title: string }>,
};

function previewLines(language: PreviewLang, content: string): Span[][] {
  if (language === 'yaml') return yamlLines(content);
  if (language === 'sql') return sqlLines(content);
  return codeLines(content, language);
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function Line({ spans }: { spans: readonly Span[] }) {
  if (spans.length === 0) return <span>{'\u00a0'}</span>;
  return (
    <>
      {spans.map((span, i) => (
        <span key={i} className={KIND_CLASS[span.kind]}>{span.text}</span>
      ))}
    </>
  );
}

export function CodePreview({ content, language = 'sql' }: { readonly content: string; readonly language?: PreviewLang }) {
  const lines = previewLines(language, content);
  const meta = LANG[language];
  const [state, setState] = useState<'idle' | 'done' | 'fail'>('idle');

  useEffect(() => { setState('idle'); }, [content]);

  async function copyAll() {
    const ok = await writeClipboard(content);
    setState(ok ? 'done' : 'fail');
    window.setTimeout(() => setState('idle'), 1600);
  }

  const label = state === 'done' ? '已复制' : state === 'fail' ? '复制失败' : meta.copy;

  return (
    <div
      data-sql-preview={language === 'sql' ? '' : undefined}
      data-yaml-preview={language === 'yaml' ? '' : undefined}
      data-code-preview={language !== 'sql' && language !== 'yaml' ? language : undefined}
      className="rounded-lg border skin-border overflow-hidden bg-gray-50 dark:bg-gray-950/50"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-3 py-1.5 border-b skin-border bg-gray-100/95 dark:bg-gray-900/95 backdrop-blur-sm">
        <span className="text-[10px] font-mono uppercase tracking-wide skin-text-muted">
          {meta.name} · {lines.length} 行
        </span>
        <button
          type="button"
          onClick={copyAll}
          className="shrink-0 px-2 py-0.5 rounded border skin-border text-[11px] font-medium skin-text
                     hover:bg-white dark:hover:bg-gray-800 transition-colors"
          title={meta.title}
        >
          {label}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs leading-relaxed font-mono min-w-full">
          <tbody>
            {lines.map((spans, i) => (
              <tr key={i}>
                <td className="select-none sticky left-0 align-top text-right pr-3 pl-3 py-0 tabular-nums text-[10px] text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-950 w-10">
                  {i + 1}
                </td>
                <td className="whitespace-pre py-0 pr-4 skin-text-secondary align-top">
                  <Line spans={spans} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
