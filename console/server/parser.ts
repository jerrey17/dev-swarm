// 解析器：current.md frontmatter / services.yaml / INDEX / status.md / reverify.md
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

export interface Current {
  name: string; phase: string; node: string; profile?: string;
  next?: { agent: string; action: string; blockers: string[] };
  terminal: boolean; blockers: string[]; updated_at?: string;
  phases?: { name: string; completed: boolean }[];
  tapdUrl?: string; // 03 §F3/D002：正文首个 TAPD 故事链接重建的 canonical URL
}
export interface Service { name: string; appid?: string; local_path?: string; role?: string; kind?: string; }
// schema v2：9 数据列（split("|") 行长 11）。repo=代码根路径；dataRoot/expect/actual 为 v2 新增
export interface ReverifyRow { req: string; id: string; repo: string; commit: string; dataRoot: string; point: string; expect: string; actual: string; instance: string; state: string; }

function parseFrontmatter(text: string): Record<string, unknown> {
  const parts = text.split(/^---\s*$/m);
  if (parts.length < 3) return {};
  try { return (yaml.load(parts[1]) as Record<string, unknown>) || {}; } catch { return {}; }
}

// 03 §F3/D002（04 B1 方案 L）：current.md 正文首个 TAPD 故事链接 → canonical prong URL；tapd_fe 形态归一化
const TAPD_STORY_URL = /tapd\.cn\/(?:tapd_fe\/)?(\d+)\/(?:prong\/stories\/view|story\/detail)\/(\d+)/;

export function parseTapdUrl(text: string): string | undefined {
  const parts = text.split(/^---\s*$/m);
  const body = parts.length >= 3 ? parts.slice(2).join("---") : "";
  const hit = body.match(TAPD_STORY_URL);
  return hit ? `https://www.tapd.cn/${hit[1]}/prong/stories/view/${hit[2]}` : undefined;
}

export function listRequirements(repoRoot: string): string[] {
  const ws = join(repoRoot, "workspace");
  if (!existsSync(ws)) return [];
  return readdirSync(ws, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
}

export function parseCurrent(repoRoot: string, req: string): Current | null {
  const p = join(repoRoot, "workspace", req, "_state", "current.md");
  if (!existsSync(p)) return null;
  const text = readFileSync(p, "utf-8");
  const fm = parseFrontmatter(text);
  const next = fm.next as Current["next"];
  return {
    name: String(fm.name || req), phase: String(fm.phase || ""), node: String(fm.node || fm.phase || ""),
    profile: fm.profile ? String(fm.profile) : undefined,
    next, terminal: Boolean(fm.terminal),
    blockers: Array.isArray(next?.blockers) ? next.blockers : [],
    updated_at: fm.updated_at ? String(fm.updated_at) : undefined,
    phases: Array.isArray(fm.phases) ? (fm.phases as Current["phases"]) : undefined,
    tapdUrl: parseTapdUrl(text),
  };
}

export function parseServices(repoRoot: string, req: string): Service[] {
  const p = join(repoRoot, "workspace", req, "services.yaml");
  if (!existsSync(p)) return [];
  try {
    const parsed = yaml.load(readFileSync(p, "utf-8")) as { services?: Service[] } | undefined;
    return parsed?.services || [];
  } catch { return []; }
}

// F09/D003-v3：研发入口配置（workspace/{req}/_state/links.yaml，可选；缺失/不可解析→undefined=console 全类目待办）
// 09/BUG-001~003 schema v2：外链单一存储（links.yaml）；+wiki（需求级多条/服务级一槽）；-monitor/sql/saturn/apollo（归研发计划，不在抽屉重复）
export interface ReqLinks {
  tapd?: { url?: string };
  dev_plan?: { url?: string };
  test_env?: { url?: string; cluster?: string };
  wiki?: Array<{ name?: string; url?: string }>;
  services?: Record<string, { pipeline?: string; wiki?: string }>;
}

export function parseLinks(repoRoot: string, req: string): ReqLinks | undefined {
  const p = join(repoRoot, "workspace", req, "_state", "links.yaml");
  if (!existsSync(p)) return undefined;
  try {
    return (yaml.load(readFileSync(p, "utf-8")) as ReqLinks | undefined) ?? undefined;
  } catch { return undefined; }
}

// profile场景定制（03 §3.7/S5）：需求级 kind 显式声明（services.yaml 顶层，可选；kind 优先于规则推断）
export function reqKind(repoRoot: string, req: string): string | undefined {
  const p = join(repoRoot, "workspace", req, "services.yaml");
  if (!existsSync(p)) return undefined;
  try {
    const parsed = yaml.load(readFileSync(p, "utf-8")) as { kind?: unknown } | undefined;
    return parsed?.kind ? String(parsed.kind) : undefined;
  } catch { return undefined; }
}

// B1/R1-P：阶段库编号（dev-swarm.yaml nodes.stages.{阶段名}.order）；库缺失/无 order 回退枚举下标
export function stageLibraryOrders(repoRoot: string): Map<string, number> {
  const orders = new Map<string, number>();
  try {
    const cfg = (yaml.load(readFileSync(join(repoRoot, "dev-swarm.yaml"), "utf-8")) as Record<string, any>) ?? {};
    const stages = ((cfg?.nodes?.stages ?? {}) as Record<string, any>);
    let i = 0;
    for (const [name, spec] of Object.entries(stages)) {
      i += 1;
      const o = Number((spec as any)?.order);
      orders.set(name, Number.isFinite(o) && o > 0 ? o : i);
    }
  } catch { /* 库不可读→调用方回退下标 */ }
  return orders;
}

// B-03：按 profile 取 pipeline 全阶段序列（skill/pipeline/{profile}.yaml 的 phases），供详情流水线补齐未到阶段
export function pipelineStages(repoRoot: string, profile: string): string[] | undefined {
  const p = join(repoRoot, "skill", "pipeline", `${profile}.yaml`);
  if (!existsSync(p)) return undefined;
  try {
    const parsed = yaml.load(readFileSync(p, "utf-8")) as { phases?: unknown } | undefined;
    return Array.isArray(parsed?.phases) ? (parsed!.phases as unknown[]).map(String) : undefined;
  } catch { return undefined; }
}

export function parseStatus(repoRoot: string, req: string): Map<string, string> {
  const dir = join(repoRoot, "workspace", req, "bug");
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.startsWith("BUG-")) continue;
    const p = join(dir, name, "status.md");
    if (!existsSync(p)) continue;
    const fm = parseFrontmatter(readFileSync(p, "utf-8"));
    out.set(String(fm.id || name), String(fm.status || ""));
  }
  return out;
}

function isSeparator(cells: string[]): boolean {
  return cells.every(c => /^[-: ]*$/.test(c));
}

export function parseIndex(repoRoot: string, req: string): Map<string, string> {
  const p = join(repoRoot, "workspace", req, "bug", "INDEX.md");
  const out = new Map<string, string>();
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf-8").split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map(c => c.trim());
    if (isSeparator(cells)) continue;
    if (cells.length >= 5 && cells[1] && cells[1] !== "单号") out.set(cells[1], cells[3]);
  }
  return out;
}

export function parseReverify(repoRoot: string): ReverifyRow[] {
  const rows: ReverifyRow[] = [];
  for (const req of listRequirements(repoRoot)) {
    const p = join(repoRoot, "workspace", req, "reverify.md");
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf-8").split("\n")) {
      if (!line.startsWith("|")) continue;
      const cells = line.split("|").map(c => c.trim());
      if (isSeparator(cells)) continue;
      if (cells.length >= 11 && cells[1] && !["单号"].includes(cells[1])) {
        rows.push({ req, id: cells[1], repo: cells[2], commit: cells[3], dataRoot: cells[4], point: cells[5], expect: cells[6], actual: cells[7], instance: cells[8], state: cells[9] });
      }
    }
  }
  return rows;
}

// F06 平移（claude-board workflow.ts /decisions）：_state/decisions.md ### D00N 分节解析
// 06 S3：role 只取括号内首 token（不吃逗号）——「（2026-10-03，cc-dev，待 cursor-qa 复审确认）」的 role=cc-dev
export interface Decision { id: string; title: string; date: string; role: string; body: string }

export function parseDecisions(repoRoot: string, req: string): Decision[] {
  const p = join(repoRoot, "workspace", req, "_state", "decisions.md");
  if (!existsSync(p)) return [];
  const out: Decision[] = [];
  const m = /^###\s+(D\d+)\s*—\s*(.+?)（([^，()（）]+)，\s*([^，()（）]+)(?:，[^）]*)?）\s*$/;
  let cur: Decision | null = null;
  for (const line of readFileSync(p, "utf-8").split("\n")) {
    const hit = line.match(m);
    if (hit) {
      if (cur) out.push(cur);
      cur = { id: hit[1], title: hit[2], date: hit[3], role: hit[4], body: "" };
    } else if (cur) {
      cur.body += line + "\n";
    }
  }
  if (cur) out.push(cur);
  return out;
}

// F06 平移（claude-board workflow.ts /history）：_state/history/ 文件清单
export interface HistoryFile { file: string; mtime: string; size: number }

export function listHistory(repoRoot: string, req: string): HistoryFile[] {
  const p = join(repoRoot, "workspace", req, "_state", "history");
  if (!existsSync(p)) return [];
  return readdirSync(p, { withFileTypes: true })
    .filter(f => f.isFile() || f.isDirectory())
    .map(f => ({ file: f.name, mtime: "", size: -1 }))
    .map(h => {
      try {
        const st = statSync(join(p, h.file));
        return { ...h, mtime: st.mtime.toISOString(), size: st.isDirectory() ? -1 : st.size };
      } catch { return h; }
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}

// ── F12（03 v2 §二 X01 绑定表 / D002）：RequirementSummary 计算字段 ──
// pipelinePhases 另起字段名（H04：既有 phases {name,completed}[] 语义不动）
// B1（R1-P）：order=阶段库编号（stageLibraryOrders；库缺失回退下标 1 起）——详情分组键 pad2(order) 命中 {NN}-*.md 产物
export interface PipelinePhase { order: number; name: string; completed: boolean; isCurrent: boolean }
export interface ReqComputed {
  pipelinePhases: PipelinePhase[];
  completedPhases: number;
  totalPhases: number;
  lastAction?: string;
  todo?: string;
  projectName: string;
  mainProject?: string;
  format: "schema2" | "error";
  parseError?: string;
  startedAt?: string;
}

export const PROJECT_NAME = "dev-swarm-workspace";

export function computeReqFields(
  repoRoot: string, req: string, c: Current | null,
  stages: string[] | undefined,
): ReqComputed {
  if (!c) {
    return {
      pipelinePhases: [], completedPhases: 0, totalPhases: 0,
      projectName: PROJECT_NAME, format: "error", parseError: "current.md 缺失或 frontmatter 解析失败",
    };
  }
  // B2-A（R1-P）：seq=该需求冻结链（调用方传 current.phases 名序列；stages 参数保留兼容旧调用）
  const seq = stages?.length ? stages : (c.phases || []).map(p => p.name);
  const doneSet = new Set((c.phases || []).filter(p => p.completed).map(p => p.name));
  const libOrders = stageLibraryOrders(repoRoot);
  const pipelinePhases = seq.map((name, i) => ({ order: libOrders.get(name) ?? i + 1, name, completed: doneSet.has(name), isCurrent: name === c.phase }));
  const mainProject = parseServices(repoRoot, req).find(s => s.role === "主责")?.name;
  return {
    pipelinePhases,
    completedPhases: pipelinePhases.filter(p => p.completed).length,
    totalPhases: pipelinePhases.length,
    lastAction: c.next?.action,
    todo: c.next ? `${c.next.agent} · ${c.next.action}` : undefined,
    projectName: PROJECT_NAME,
    mainProject,
    format: "schema2",
  };
}

// S3：startedAt=需求目录顶层 0N-*.md 产物最旧 mtime（排除 _state/、attachments/ 及全部子目录）
export function startedAtOf(repoRoot: string, req: string): string | undefined {
  const dir = join(repoRoot, "workspace", req);
  if (!existsSync(dir)) return undefined;
  let oldest: number | undefined;
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (!f.isFile() || !/^\d{2}-.*\.md$/.test(f.name)) continue;
    try {
      const m = statSync(join(dir, f.name)).mtimeMs;
      if (oldest === undefined || m < oldest) oldest = m;
    } catch { /* 单文件 stat 失败跳过 */ }
  }
  return oldest === undefined ? undefined : new Date(oldest).toISOString();
}
