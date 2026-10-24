// ── JSONL Parser（B3 选 B：源码级迁移自 claude-board server/parsers/jsonl.ts） ──
// 解析 Claude Code 会话文件（.jsonl）为类型化消息。
// 裁剪说明：SessionSummary/extractSessionSummary（Sessions 浏览页用）不迁移；
// messages 展开所需的 ParsedMessage/ContentBlock 链全量保留。

export type EventType = 'user' | 'assistant' | 'system' | string;

export interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | { type: string; text?: string }[];
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ParsedMessage {
  type: EventType;
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  sessionId: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  slug?: string;
  model?: string;
  stopReason: string | null;
  content: ContentBlock[];
  usage?: TokenUsage;
  isSidechain: boolean;
}

// 无会话内容的事件类型，解析时过滤
const SKIP_TYPES: ReadonlySet<string> = new Set([
  'queue-operation',
  'last-prompt',
  'progress',
  'file-history-snapshot',
]);

export function parseJsonlLine(line: string): ParsedMessage | null {
  try {
    const raw = JSON.parse(line) as Record<string, unknown>;
    const type = raw.type as EventType;

    if (SKIP_TYPES.has(type)) return null;

    const msg = (raw.message ?? {}) as Record<string, unknown>;
    return {
      type,
      uuid: (raw.uuid as string) ?? '',
      parentUuid: (raw.parentUuid as string) ?? null,
      timestamp: (raw.timestamp as string) ?? '',
      sessionId: (raw.sessionId as string) ?? '',
      cwd: raw.cwd as string | undefined,
      version: raw.version as string | undefined,
      gitBranch: raw.gitBranch as string | undefined,
      slug: raw.slug as string | undefined,
      model: msg.model as string | undefined,
      stopReason: (msg.stop_reason as string) ?? null,
      content: normalizeContent(type, msg),
      usage: extractUsage(msg),
      isSidechain: (raw.isSidechain as boolean) ?? false,
    };
  } catch {
    return null;
  }
}

export function parseJsonlFile(fileContent: string): readonly ParsedMessage[] {
  if (!fileContent.trim()) return [];
  const messages: ParsedMessage[] = [];
  for (const line of fileContent.split('\n')) {
    if (!line.trim()) continue;
    const parsed = parseJsonlLine(line);
    if (parsed !== null) messages.push(parsed);
  }
  return messages;
}

function normalizeContent(type: EventType, msg: Record<string, unknown>): ContentBlock[] {
  if (type === 'user') {
    const content = msg.content;
    if (typeof content === 'string') {
      return [{ type: 'text', text: content }];
    }
    if (Array.isArray(content)) {
      return content.filter(isContentBlock);
    }
    return [];
  }
  if (type === 'assistant' || type === 'system') {
    const content = msg.content;
    if (Array.isArray(content)) {
      return content.filter(isContentBlock);
    }
    return [];
  }
  return [];
}

function isContentBlock(block: unknown): block is ContentBlock {
  if (typeof block !== 'object' || block === null) return false;
  const b = block as Record<string, unknown>;
  return ['thinking', 'text', 'tool_use', 'tool_result'].includes(b.type as string);
}

function extractUsage(msg: Record<string, unknown>): TokenUsage | undefined {
  const usage = msg.usage as Record<string, unknown> | undefined;
  if (!usage) return undefined;
  return {
    input_tokens: (usage.input_tokens as number) ?? 0,
    output_tokens: (usage.output_tokens as number) ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens as number | undefined,
    cache_read_input_tokens: usage.cache_read_input_tokens as number | undefined,
  };
}
