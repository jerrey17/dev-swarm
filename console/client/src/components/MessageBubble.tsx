// ── MessageBubble ── 消息气泡（迁移自 claude-board，含 ContentBlock 类型；messages 只读子集随迁） ──

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';

export interface ContentBlock {
  readonly type: string;
  readonly text?: string;
  readonly thinking?: string;
  readonly name?: string;
  readonly id?: string;
  readonly input?: Record<string, unknown>;
  readonly tool_use_id?: string;
  readonly content?: string | readonly { type: string; text?: string }[];
}

interface MessageBubbleProps {
  readonly type: 'user' | 'assistant' | 'system';
  readonly content: readonly ContentBlock[];
  readonly timestamp: string;
  readonly model?: string;
}

function ContentBlockRenderer({ block }: { readonly block: ContentBlock }) {
  switch (block.type) {
    case 'thinking':
      return <ThinkingBlock thinking={block.thinking ?? ''} />;

    case 'text':
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none
                        prose-pre:bg-gray-100 dark:prose-pre:bg-gray-900
                        prose-code:text-pink-600 dark:prose-code:text-pink-400">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text ?? ''}</ReactMarkdown>
        </div>
      );

    case 'tool_use':
      return (
        <ToolCallCard
          name={block.name ?? 'Unknown'}
          input={block.input ?? {}}
          id={block.id ?? ''}
        />
      );

    case 'tool_result': {
      const text = typeof block.content === 'string'
        ? block.content
        : Array.isArray(block.content)
          ? block.content.map(c => c.text ?? '').join('\n')
          : '';
      return (
        <div className="my-2 text-xs text-gray-500 bg-gray-100 dark:bg-gray-900/50 rounded p-2 max-h-48 overflow-y-auto font-mono thin-scroll">
          {text.slice(0, 500) || '(no output)'}
        </div>
      );
    }

    default:
      return null;
  }
}

export function MessageBubble({ type, content, timestamp, model }: MessageBubbleProps) {
  const isUser = type === 'user';
  const time = timestamp ? new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) : '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-3xl ${isUser ? 'ml-16' : 'mr-16'}`}>
        <div className={`flex items-center gap-2 mb-1 text-xs text-gray-400 dark:text-gray-500 ${isUser ? 'justify-end' : ''}`}>
          <span>{isUser ? 'User' : model?.replace('claude-', '') ?? 'Claude'}</span>
          <span>{time}</span>
        </div>

        <div
          className={`rounded-xl px-4 py-3 ${
            isUser
              ? 'bg-blue-50 border border-blue-200/50 dark:bg-blue-600/20 dark:border-blue-800/30'
              : 'bg-gray-50 border border-gray-200/50 dark:bg-gray-800/50 dark:border-gray-700/30'
          }`}
        >
          {content.map((block, i) => (
            <ContentBlockRenderer key={i} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}
