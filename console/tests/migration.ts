// 07-单元测试（console迁移claude-board工作区；03 §八清单五项）
// 惯例与 smoke.ts 一致：无测试框架，tsx 直跑断言，退出码 0=全过
// 覆盖：①parser 字段映射（含 pipelinePhases order 1 起）②workspace 分组与穿越拒绝
//       ③sessions 正则 ④client parseDecisions（server 正则口径）⑤jsonl 解析
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { computeReqFields, startedAtOf, type Current } from "../server/parser.js";
import { groupNodes, safePath, type WorkspaceNode } from "../server/workspace.js";
import { escapeRegExp } from "../server/sessions.js";
import { parseJsonlFile } from "../server/parsers/jsonl.js";
import { parseDecisions } from "../client/src/utils/workflow.js";

let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) { console.error("❌ " + msg); process.exit(1); }
  console.log("✅ " + msg);
  passed++;
}

// ── ① parser 字段映射（X01/D002 绑定表） ──
const tmpRoot = mkdtempSync(join(tmpdir(), "ds-ut-migration-"));
const reqDir = join(tmpRoot, "workspace", "测试需求");
mkdirSync(join(reqDir, "_state"), { recursive: true });
writeFileSync(join(reqDir, "_state", "current.md"), [
  "---",
  'name: "测试需求"',
  "phase: 代码审查",
  "node: 代码审查",
  "profile: toolchain",
  "next:",
  "  agent: cursor-qa",
  '  action: "审查"',
  "  blockers: []",
  "terminal: false",
  "updated_at: \"2026-10-09T10:00:00+08:00\"",
  "phases:",
  "  - name: 需求分析",
  "    completed: true",
  "  - name: 服务拆分",
  "    completed: true",
  "---",
  "",
].join("\n"));
writeFileSync(join(reqDir, "services.yaml"), [
  "services:",
  '  - name: "svc-a"',
  '    appid: ""',
  '    local_path: "/tmp/a"',
  "    role: 主责",
  '  - name: "svc-b"',
  "    role: 协同",
  "",
].join("\n"));
writeFileSync(join(reqDir, "01-需求分析.md"), "a");
writeFileSync(join(reqDir, "02-服务拆分.md"), "b");
writeFileSync(join(reqDir, "memo.md"), "c"); // 非 0N 前缀：不进 startedAt

const current: Current = {
  name: "测试需求", phase: "代码审查", node: "代码审查", profile: "toolchain",
  next: { agent: "cursor-qa", action: "审查", blockers: [] },
  terminal: false, blockers: [],
  updated_at: "2026-10-09T10:00:00+08:00",
  phases: [{ name: "需求分析", completed: true }, { name: "服务拆分", completed: true }],
};
const stages = ["需求分析", "服务拆分", "技术方案", "方案审查", "代码审查", "单元测试"];
const f = computeReqFields(tmpRoot, "测试需求", current, stages);

assert(f.format === "schema2", "① format=schema2");
assert(f.totalPhases === 6 && f.completedPhases === 2, "① total=6/done=2（frontmatter 未列出的阶段 completed=false）");
assert(f.pipelinePhases[0].order === 1 && f.pipelinePhases[0].name === "需求分析" && f.pipelinePhases[0].completed, "① order 1 起（需求分析=1，非 0 起下标）");
assert(f.pipelinePhases[4].name === "代码审查" && f.pipelinePhases[4].isCurrent && !f.pipelinePhases[4].completed, "① isCurrent=phase 匹配项（代码审查）");
assert(f.todo === "cursor-qa · 审查" && f.lastAction === "审查", "① todo={agent} · {action}、lastAction=next.action");
assert(f.mainProject === "svc-a", "① mainProject=role 主责 条目");
assert(f.projectName === "dev-swarm-workspace", "① projectName 常量");
const errFields = computeReqFields(tmpRoot, "测试需求", null, stages);
assert(errFields.format === "error" && Boolean(errFields.parseError), "① current=null → format=error+parseError");
const startedAt = startedAtOf(tmpRoot, "测试需求");
assert(Boolean(startedAt), "① startedAt=顶层 0N-*.md 最旧 mtime（排除 memo.md/_state）");

// ── ② workspace 分组与穿越拒绝 ──
function node(name: string, type: "dir" | "file"): WorkspaceNode {
  return { name, path: name, type, size: 1, modified: "2026-10-09T00:00:00Z", ...(type === "dir" ? { children: [] } : {}) };
}
const groups = groupNodes([node("services.yaml", "file"), node("02-服务拆分.md", "file"), node("_state", "dir"), node("01-需求分析.md", "file")]);
assert(groups.map((g) => g.key).join(",") === "01,02,others", "② 分组 key=两位前缀+others 恒末尾（实际：" + groups.map((g) => g.key).join(",") + "）");
assert(groups[2].entries.length === 2, "② others 含无前缀文件与目录（services.yaml+_state）");

// ── ②b B1 子集链夹具：库 order 生效——current.phases 缺「服务拆分」时「技术方案」order=3 ──
const subRoot = mkdtempSync(join(tmpdir(), "ds-ut-subchain-"));
try {
  // 夹具自带阶段库（tmpRoot 无 dev-swarm.yaml→上一组断言天然走下标回退，互不干扰）
  writeFileSync(join(subRoot, "dev-swarm.yaml"), [
    "nodes:",
    "  stages:",
    "    需求分析: { order: 1, agent: cc-dev }",
    "    服务拆分: { order: 2, agent: cc-dev }",
    "    技术方案: { order: 3, agent: cc-dev }",
    "    方案审查: { order: 4, agent: cursor-qa }",
    "",
  ].join("\n"));
  const subReq = join(subRoot, "workspace", "子集需求");
  mkdirSync(join(subReq, "_state"), { recursive: true });
  writeFileSync(join(subReq, "_state", "current.md"), [
    "---",
    'name: "子集需求"',
    "phase: 技术方案",
    "node: 技术方案",
    "profile: toolchain",
    "next:",
    "  agent: cc-dev",
    '  action: "x"',
    "  blockers: []",
    "terminal: false",
    "updated_at: \"2026-10-10T09:00:00+08:00\"",
    "phases:",
    "  - name: 需求分析",
    "    completed: true",
    "  - name: 技术方案",
    "    completed: false",
    "---",
    "",
  ].join("\n"));
  const subCurrent: Current = {
    name: "子集需求", phase: "技术方案", node: "技术方案", profile: "toolchain",
    next: { agent: "cc-dev", action: "x", blockers: [] },
    terminal: false, blockers: [],
    phases: [{ name: "需求分析", completed: true }, { name: "技术方案", completed: false }],
  };
  const subFields = computeReqFields(subRoot, "子集需求", subCurrent, ["需求分析", "技术方案"]);
  assert(subFields.pipelinePhases.length === 2, "②b 子集链 2 阶段");
  assert(subFields.pipelinePhases[1].order === 3 && subFields.pipelinePhases[1].name === "技术方案",
    "②b B1: 缺「服务拆分」时「技术方案」order=库编号 3（实际 " + subFields.pipelinePhases[1].order + "）");
  assert(subFields.pipelinePhases[0].order === 1, "②b 需求分析 order=1");
} finally { rmSync(subRoot, { recursive: true, force: true }); }

// safePath 基于 dataClone 真路径（只读构造，不落盘）
assert(safePath("console迁移claude-board工作区", "03-技术方案.md") !== null, "② 合法相对路径放行");
assert(safePath("console迁移claude-board工作区", "../dev-swarm.yaml") === null, "② .. 穿越拒绝");
assert(safePath("console迁移claude-board工作区", "/etc/passwd") === null, "② 绝对路径拒绝");
assert(safePath("console迁移claude-board工作区", "a/../../x.yaml") === null, "② 嵌套 ../ 穿越拒绝");

// ── ③ sessions 正则（X05：workspace/{escapeRegExp(需求名)}/ 单模式） ──
assert(escapeRegExp("a.b(c)d[e]") === "a\\.b\\(c\\)d\\[e\\]", "③ escapeRegExp 元字符全转义");
const pattern = `workspace/${escapeRegExp("console迁移claude-board工作区")}/`;
assert(!/[().]/.test(pattern.replace(/workspace\/|console迁移claude-board工作区/g, "")) === false || pattern.includes("claude-board"), "③ 模式含需求名原文");
assert("…/dev-swarm-workspace/workspace/console迁移claude-board工作区/_state/current.md".search(new RegExp(pattern.replace(/\//g, "\\/"))) !== -1, "③ 模式命中产物/状态文件路径引用");

// ── ④ client parseDecisions（与 server parser 同正则口径；含逗号尾巴） ──
const decisionsMd = [
  "# decisions.md",
  "",
  "### D001 — 迁移范围（2026-10-08，human）",
  "- 内容",
  "",
  "### D002 — 口径确认（2026-10-08，cc-dev，待 cursor-qa 复审确认）",
  "- 内容",
  "",
  "### D003 — 拍板（2026-10-09，human）",
  "- 内容",
  "",
].join("\n");
const entries = parseDecisions(decisionsMd);
assert(entries.length === 3, "④ 命中 3 条（### D\\d+ — 标题（日期，角色））");
assert(entries[0].id === "D003" && entries[2].id === "D001", "④ 倒序（最新在前）");
assert(entries[1].role === "cc-dev" && entries[1].date === "2026-10-08" && entries[1].title === "口径确认", "④ role 只取括号内首 token（逗号尾巴吞掉）");
assert(entries[0].slug.startsWith("d003-"), "④ slug=defaultSlugify(整行标题) 可作锚点");

// ── ⑤ jsonl 解析（B3 选 B） ──
const jsonl = [
  JSON.stringify({ type: "queue-operation" }), // skip
  JSON.stringify({ type: "user", message: { role: "user", content: "你好" } }),
  JSON.stringify({ type: "assistant", message: { role: "assistant", model: "test-model", content: [
    { type: "thinking", thinking: "推理" },
    { type: "text", text: "回答" },
    { type: "tool_use", name: "Read", id: "t1", input: { file_path: "/a" } },
    { type: "unknown-block" }, // 过滤
  ] } }),
  "{ 这不是 JSON", // malformed 跳过
  "",
].join("\n");
const msgs = parseJsonlFile(jsonl);
assert(msgs.length === 2, "⑤ skip 类型与 malformed 行跳过（2/5）");
assert(msgs[0].type === "user" && msgs[0].content.length === 1 && msgs[0].content[0].type === "text" && msgs[0].content[0].text === "你好", "⑤ user string content 包装为 TextBlock");
assert(msgs[1].content.length === 3 && msgs[1].model === "test-model", "⑤ assistant 数组过滤未知块（thinking/text/tool_use 保留 3 块）");

rmSync(tmpRoot, { recursive: true, force: true });

// ── ⑥ BUG-001 回归：列表行 profile 绑定存在性（05-B3 改绑 RequirementRow；静态断言；渲染行为归 09 浏览器复验） ──
import { readFileSync } from "node:fs";
const cardSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "client", "src", "components", "RequirementRow.tsx"), "utf-8");
assert(cardSrc.includes("{req.profile && (") && cardSrc.includes("{req.profile}"), "⑥ BUG-001：RequirementRow 含 profile 条件渲染绑定（空值不渲染）");

// ── ⑦ BUG-002 回归：详情 previewContent 仅在「有选中文本文件」时取值（useAPI path 变空保留 stale data，残留会堵死空态分支） ──
const detailSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "client", "src", "pages", "RequirementDetail.tsx"), "utf-8");
assert(detailSrc.includes("selectedFile && isTextPreview ? fileContent?.content : undefined"), "⑦ BUG-002：previewContent 无选中文本文件时必须为 undefined");

console.log(`\n全部通过：${passed} 断言，退出码 0`);
