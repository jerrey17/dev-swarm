// ── TocOverlay ── 悬浮目录：右下角常驻小按钮，hover 展开章节列表面板，点击跳转、可折叠。（迁移自 claude-board）

import { useState } from 'react';
import type { TocEntry } from '../utils/workflow';

interface TocOverlayProps {
  readonly entries: TocEntry[];
  readonly onJump: (id: string) => void;
}

export function TocOverlay({ entries, onJump }: TocOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (entries.length === 0) return null;

  const open = isOpen || pinned;

  return (
    <div
      className="absolute bottom-2 right-2 z-30"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {open && (
        <div
          className="absolute right-0 bottom-full mb-1
                     bg-white dark:bg-gray-800 border skin-border rounded-lg shadow-xl flex flex-col
                     w-[28rem] max-h-[70vh]"
        >
          <div className="px-3 py-2 text-xs skin-text-muted border-b skin-border shrink-0
                          flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
            <span className="font-medium skin-text">目录</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px]">{entries.length} 项</span>
              <button
                onClick={() => setPinned(p => !p)}
                className="text-[10px] px-1.5 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 skin-text-muted"
                title={pinned ? '取消固定' : '固定面板'}
              >
                📌
              </button>
            </div>
          </div>
          <div className="overflow-y-auto p-1 flex-1 thin-scroll">
            {(() => {
              const nodes: React.ReactNode[] = [];
              let skipAboveLevel: number | null = null;
              for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                if (skipAboveLevel !== null && entry.level > skipAboveLevel) continue;
                skipAboveLevel = null;
                const next = entries[i + 1];
                const hasChildren = !!next && next.level > entry.level;
                const isCollapsed = collapsed.has(entry.id);
                if (hasChildren && isCollapsed) {
                  skipAboveLevel = entry.level;
                }
                nodes.push(
                  <div
                    key={`${entry.id}-${i}`}
                    className="flex items-start gap-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    style={{ paddingLeft: `${(entry.level - 1) * 0.75}rem` }}
                  >
                    {hasChildren ? (
                      <button
                        onClick={() => toggleCollapse(entry.id)}
                        className="shrink-0 w-4 h-4 mt-0.5 flex items-center justify-center text-[10px] skin-text-muted hover:skin-primary"
                        title={isCollapsed ? '展开' : '折叠'}
                      >
                        {isCollapsed ? '▶' : '▼'}
                      </button>
                    ) : (
                      <span className="shrink-0 w-4 h-4 mt-0.5" />
                    )}
                    <button
                      onClick={() => onJump(entry.id)}
                      title={entry.text}
                      className="flex-1 text-left py-0.5 pr-1 rounded text-xs transition-colors truncate"
                    >
                      <span
                        className={
                          entry.level === 1
                            ? 'font-semibold skin-text'
                            : entry.level === 2
                              ? 'skin-text'
                              : 'skin-text-secondary'
                        }
                      >
                        {entry.text}
                      </span>
                    </button>
                  </div>,
                );
              }
              return nodes;
            })()}
          </div>
        </div>
      )}

      <button
        onClick={() => setPinned(p => !p)}
        className="bg-white dark:bg-gray-800 border skin-border rounded-lg shadow-md pl-2 pr-2.5 py-1
                   text-xs skin-text-secondary hover:skin-primary flex items-center gap-1.5"
        title="鼠标悬浮展开目录，点击固定"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        目录
      </button>
    </div>
  );
}
