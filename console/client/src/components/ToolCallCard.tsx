// ── ToolCallCard ── 工具调用卡片（迁移自 claude-board，messages 只读子集随迁） ──

import { useState } from 'react';

interface ToolCallCardProps {
  readonly name: string;
  readonly input: Record<string, unknown>;
  readonly id: string;
}

const TOOL_STYLES: Record<string, string> = {
  Read: 'text-green-600 dark:text-green-400 border-green-300/30 dark:border-green-800/30 bg-green-50/50 dark:bg-green-950/20',
  Write: 'text-yellow-600 dark:text-yellow-400 border-yellow-300/30 dark:border-yellow-800/30 bg-yellow-50/50 dark:bg-yellow-950/20',
  Edit: 'text-orange-600 dark:text-orange-400 border-orange-300/30 dark:border-orange-800/30 bg-orange-50/50 dark:bg-orange-950/20',
  Bash: 'text-red-600 dark:text-red-400 border-red-300/30 dark:border-red-800/30 bg-red-50/50 dark:bg-red-950/20',
  Glob: 'text-cyan-600 dark:text-cyan-400 border-cyan-300/30 dark:border-cyan-800/30 bg-cyan-50/50 dark:bg-cyan-950/20',
  Grep: 'text-cyan-600 dark:text-cyan-400 border-cyan-300/30 dark:border-cyan-800/30 bg-cyan-50/50 dark:bg-cyan-950/20',
  Agent: 'text-blue-600 dark:text-blue-400 border-blue-300/30 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-950/20',
  Skill: 'text-indigo-600 dark:text-indigo-400 border-indigo-300/30 dark:border-indigo-800/30 bg-indigo-50/50 dark:bg-indigo-950/20',
};

const DEFAULT_STYLE = 'text-gray-600 dark:text-gray-400 border-gray-300/30 dark:border-gray-800/30 bg-gray-50/50 dark:bg-gray-950/20';

function summarizeInput(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'Read': return String(input.file_path ?? '');
    case 'Write': return String(input.file_path ?? '');
    case 'Edit': return String(input.file_path ?? '');
    case 'Bash': return String(input.command ?? '').slice(0, 60);
    case 'Glob': return String(input.pattern ?? '');
    case 'Grep': return String(input.pattern ?? '');
    case 'Agent': return String(input.description ?? '');
    case 'Skill': return String(input.skill ?? '');
    default: return Object.keys(input).join(', ');
  }
}

export function ToolCallCard({ name, input, id }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const colorClass = TOOL_STYLES[name] ?? DEFAULT_STYLE;

  return (
    <div className={`my-2 rounded-lg border ${colorClass} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        <span className="font-mono font-medium">{name}</span>
        <span className="text-gray-400 dark:text-gray-500 truncate">
          {summarizeInput(name, input)}
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 text-xs font-mono text-gray-700 dark:text-gray-300 border-t border-current/10 max-h-96 overflow-y-auto thin-scroll">
          <pre className="whitespace-pre-wrap">{JSON.stringify(input, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
