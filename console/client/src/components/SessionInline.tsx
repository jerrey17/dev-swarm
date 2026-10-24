// ── SessionInline ── 内嵌会话查看（迁移自 claude-board；适配：路径 /sessions/{id}/messages，03 §五 B3 选 B） ──
import { useAPI } from '../hooks/useAPI';
import { LoadingSkeleton } from './LoadingSkeleton';
import { MessageBubble, ContentBlock } from './MessageBubble';

interface SessionMessage {
  type: 'user' | 'assistant' | 'system';
  content: ContentBlock[];
  timestamp: string;
  model?: string;
}

interface SessionInlineProps {
  readonly sessionId: string;
  readonly onClose: () => void;
}

export function SessionInline({ sessionId, onClose }: SessionInlineProps) {
  const { data: messages, loading, error } = useAPI<SessionMessage[]>(`/sessions/${encodeURIComponent(sessionId)}/messages`);

  return (
    <div className="border skin-border rounded-lg overflow-hidden mt-3">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b skin-border">
        <span className="text-xs skin-text-muted font-mono">
          Session: {sessionId.slice(0, 12)}...
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200
                     dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto p-3 space-y-3 thin-scroll">
        {loading && <LoadingSkeleton count={3} />}
        {error && <div className="text-xs text-red-400">加载失败: {error}</div>}
        {messages?.map((msg, idx) => (
          <MessageBubble
            key={idx}
            type={msg.type}
            content={msg.content}
            timestamp={msg.timestamp}
            model={msg.model}
          />
        ))}
        {messages?.length === 0 && (
          <div className="text-xs skin-text-muted text-center py-4">暂无消息</div>
        )}
      </div>
    </div>
  );
}
