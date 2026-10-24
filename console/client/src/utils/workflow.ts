// 需求列表/详情/卡片共享类型与解析工具（迁移自 claude-board，按 schema 2 / X01 / D002 改写）
import { defaultSlugify } from '../components/MarkdownPreview';

// ── 类型（X01/D002 口径：字段=API 响应；无 schema 2 来源的字段保留类型但置空，UI 条件渲染） ──

export interface PipelinePhase {
  order: number;         // 1 起（工作区 key = pad2(order)）
  name: string;
  completed: boolean;
  isCurrent: boolean;
}

export interface RequirementSummary {
  name: string;
  phase: string;
  node?: string;
  profile?: string;
  terminal?: boolean;
  updated_at?: string;       // 更新时间唯一来源（D002：不新增 lastUpdatedAt）
  blockers: string[];
  next?: { agent: string; action: string };
  tapdUrl?: string;          // 03 §F3：current.md 正文 TAPD 故事链接（server parseTapdUrl，唯一 TAPD 来源）
  // 计算字段（服务端 computeReqFields）
  pipelinePhases: PipelinePhase[];
  completedPhases: number;
  totalPhases: number;
  lastAction?: string;
  todo?: string;
  projectName: string;
  mainProject?: string;
  format: 'schema2' | 'error';
  parseError?: string;
  startedAt?: string;
  // 显式置空组（X01）：branch/branchNote/gitnexusGroup/relatedProjects/prLink
  // （05-B3/D004：tapdId/tapdWorkspaceId 移除——TAPD 唯一来源=server 解析的 tapdUrl）
  branch?: string;
  branchNote?: string;
  gitnexusGroup?: string;
  relatedProjects?: { path: string; scope: string }[];
  prLink?: string;
}

export interface WorkspaceNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  size: number;
  modified: string;
  children?: WorkspaceNode[];
}

export interface WorkspaceGroup {
  key: string;
  entries: WorkspaceNode[];
}

export interface DecisionEntry {
  id: string;          // D001
  title: string;
  date: string;
  role: string;
  headingText: string; // 整行标题文本
  slug: string;        // defaultSlugify(headingText)，与 MarkdownPreview 锚点一致
}

export interface TocEntry {
  level: number;
  text: string;
  id: string;
}

export interface LinkedSession {
  sessionId: string;
  modified: string;
  firstPrompt?: string;
}

// ── 解析工具 ──

// B2 决策 A（04 复审注记）：正则复用 server parser.ts parseDecisions 口径（role 只取括号内首 token，
// 逗号尾巴由 (?:，[^）]*)? 吞掉）——两侧解析器对同一文件必须同口径
const DECISION_HEADING = /^###\s+(D\d+)\s*—\s*(.+?)（([^，()（）]+)，\s*([^，()（）]+)(?:，[^）]*)?）\s*$/;

export function parseDecisions(content: string | undefined): DecisionEntry[] {
  if (!content) return [];
  const entries: DecisionEntry[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(DECISION_HEADING);
    if (!m) continue;
    const headingText = m[0].replace(/^###\s+/, '');
    entries.push({ id: m[1], title: m[2], date: m[3], role: m[4], headingText, slug: defaultSlugify(headingText) });
  }
  return entries.reverse();
}

export function parseTOC(content: string | undefined): TocEntry[] {
  if (!content) return [];
  const entries: TocEntry[] = [];
  let inCodeBlock = false;
  for (const line of content.split('\n')) {
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;
    const [, hashes, text] = m;
    entries.push({ level: hashes.length, text, id: defaultSlugify(text) });
  }
  return entries;
}

export function jumpToHeading(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('heading-flash');
  setTimeout(() => el.classList.remove('heading-flash'), 1800);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// 05-B4：行/详情统一的更新时间口径 MM-DD HH:mm
export function formatStamp(iso?: string): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}
