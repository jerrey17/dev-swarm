// ── MarkdownPreview ── Markdown 可视化预览组件（迁移自 claude-board；适配：mermaid 动态 import 分包、图片解析注入式）

import { useEffect, useRef, useId, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type Mermaid from 'mermaid';

// ── Mermaid 懒加载（03 §六：mermaid 不进首屏 bundle） ──

let mermaidInitialized = false;
let mermaidLoading: Promise<typeof Mermaid> | null = null;

function loadMermaid(): Promise<typeof Mermaid> {
  if (!mermaidLoading) mermaidLoading = import('mermaid').then(m => m.default);
  return mermaidLoading;
}

async function ensureMermaidInit(isDark: boolean): Promise<typeof Mermaid> {
  const mermaid = await loadMermaid();
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
      flowchart: { arrowMarkerAbsolute: true },
      themeVariables: { edgeLabelBackground: isDark ? '#1f2937' : '#ffffff' },
    });
    mermaidInitialized = true;
  }
  return mermaid;
}

// ── Mermaid 放大浮层 ──

function MermaidZoomOverlay({
  svgHtml,
  onClose,
}: {
  readonly svgHtml: string;
  readonly onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomIn = useCallback(() => setScale(s => Math.min(s * 1.4, 10)), []);
  const zoomOut = useCallback(() => {
    setScale(s => {
      const next = s / 1.4;
      return next < 0.1 ? 0.1 : next;
    });
    setPan({ x: 0, y: 0 });
  }, []);
  const zoomReset = useCallback(() => { setScale(1); setPan({ x: 0, y: 0 }); }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale(s => Math.min(s * 1.15, 10));
    } else {
      setScale(s => {
        const next = s / 1.15;
        return next < 0.1 ? 0.1 : next;
      });
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => { setDragging(false); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/90 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="px-2.5 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            title="缩小"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="text-xs text-gray-400 tabular-nums w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="px-2.5 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            title="放大"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          <button
            onClick={zoomReset}
            className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            title="重置"
          >
            重置
          </button>
        </div>
        <span className="text-xs text-gray-500">拖拽移动 · 滚轮缩放 · ESC 关闭</span>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="p-8"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.15s ease-out',
          }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>
    </div>
  );
}

// ── Mermaid 代码块组件 ──

function MermaidBlock({ code }: { readonly code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, '_');
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [zooming, setZooming] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !code.trim()) return;

    let cancelled = false;
    const isDark = document.documentElement.classList.contains('dark');

    ensureMermaidInit(isDark).then((mermaid) => {
      if (cancelled) return;
      const id = `mermaid_${uniqueId}_${Date.now()}`;
      return mermaid.render(id, code.trim()).then(({ svg }) => {
        if (cancelled || !containerRef.current) return;
        setSvgHtml(svg);
        containerRef.current.innerHTML = svg;
        containerRef.current.querySelectorAll('marker').forEach(marker => {
          const w = parseFloat(marker.getAttribute('markerWidth') ?? '8');
          const h = parseFloat(marker.getAttribute('markerHeight') ?? '8');
          marker.setAttribute('markerWidth', String(w * 1.6));
          marker.setAttribute('markerHeight', String(h * 1.6));
        });
      });
    }).catch((err: unknown) => {
      console.error('Mermaid render error:', err);
      if (containerRef.current) {
        const msg = err instanceof Error ? err.message : String(err ?? '');
        containerRef.current.innerHTML =
          `<pre class="text-xs text-red-500 p-2">Mermaid 渲染失败: ${msg.substring(0, 200)}</pre>`;
      }
    });
    return () => { cancelled = true; };
  }, [code, uniqueId]);

  return (
    <>
      <div
        ref={containerRef}
        onClick={() => svgHtml && setZooming(true)}
        className="my-3 flex justify-center overflow-x-auto bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
        title="点击放大查看"
      />
      {zooming && svgHtml && (
        <MermaidZoomOverlay svgHtml={svgHtml} onClose={() => setZooming(false)} />
      )}
    </>
  );
}

// ── 自定义 code 渲染器 ──

function CodeRenderer({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<'code'> & { node?: unknown }) {
  const { node: _node, ...rest } = props;
  const match = /language-(\w+)/.exec(className ?? '');
  const lang = match?.[1];
  const code = String(children).replace(/\n$/, '');

  if (lang === 'mermaid') {
    return <MermaidBlock code={code} />;
  }

  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}

// ── 组件 ──

interface MarkdownPreviewProps {
  readonly content: string;
  readonly headingIdFn?: (level: number, text: string) => string | undefined;
  // 适配：相对路径图片解析注入（claude-board 的 /api/acknowledge/image 硬编码不迁移——H03）
  readonly resolveImage?: (src: string) => string;
}

function nodeToText(children: unknown): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(nodeToText).join('');
  if (children && typeof children === 'object' && 'props' in (children as Record<string, unknown>)) {
    const props = (children as { props: { children?: unknown } }).props;
    return nodeToText(props.children);
  }
  return '';
}

export function defaultSlugify(text: string): string {
  return text
    .replace(/[\s—–_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

export function MarkdownPreview({ content, headingIdFn, resolveImage }: MarkdownPreviewProps) {
  if (!content?.trim()) {
    return (
      <div className="text-xs text-gray-400 dark:text-gray-500 italic py-4 text-center">
        暂无内容
      </div>
    );
  }

  const components: Record<string, unknown> = {
    code: CodeRenderer as any,
    img: ({ src, alt, ...props }: { src?: string; alt?: string }) => (
      <img src={resolveImage ? resolveImage(src ?? '') : (src ?? '')} alt={alt ?? ''} {...props} />
    ),
  };

  if (headingIdFn) {
    for (let level = 1; level <= 6; level++) {
      const tag = `h${level}` as const;
      components[tag] = ({ children, ...props }: { children?: unknown }) => {
        const id = headingIdFn(level, nodeToText(children));
        const Comp = tag as unknown as React.FC<React.HTMLAttributes<HTMLElement>>;
        return <Comp id={id} {...props}>{children as React.ReactNode}</Comp>;
      };
    }
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
                    prose-pre:bg-gray-100 dark:prose-pre:bg-gray-900
                    prose-code:text-pink-600 dark:prose-code:text-pink-400
                    prose-headings:text-gray-800 dark:prose-headings:text-gray-200
                    prose-a:text-blue-500">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
