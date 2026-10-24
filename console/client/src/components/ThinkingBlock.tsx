// ── ThinkingBlock ── 可折叠思考块（迁移自 claude-board，messages 只读子集随迁） ──

import { useState } from 'react';

interface ThinkingBlockProps {
  readonly thinking: string;
}

export function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2 rounded-lg border border-purple-300/30 bg-purple-50/50 dark:border-purple-800/30 dark:bg-purple-950/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400
                   hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-colors"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        <span>Thinking</span>
        <span className="text-purple-400 dark:text-purple-600">({thinking.length} chars)</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 text-sm text-purple-700/80 dark:text-purple-300/80 whitespace-pre-wrap border-t border-purple-200/30 dark:border-purple-800/20 max-h-96 overflow-y-auto thin-scroll">
          {thinking}
        </div>
      )}
    </div>
  );
}
