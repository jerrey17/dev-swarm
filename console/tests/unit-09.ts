// tests/unit-09.ts — 05-B4 单元测试（F09/D003-v3 研发入口抽屉；09/BUG-001~003 schema v2）
// 覆盖：parseLinks v2（缺失→undefined/合法→解析含 wiki 列表/坏 yaml→undefined/首实例真文件）
//       + 源码静态断言（抽屉默认收起、五类目 v2、待办态、两入口、detail 载荷 links、tapdUrl links 优先）
import { readFileSync, existsSync } from "node:fs";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLinks } from "../server/parser.js";

const CONSOLE = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(CONSOLE, "..");
let fail = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} ${label}${ok ? "" : ` → got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
}
function has(label: string, text: string, needle: string) {
  const ok = text.includes(needle);
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} ${label}${ok ? "" : `（未命中：${needle}）`}`);
}

// ── parseLinks 功能 ──
const tmp = mkdtempSync(join(tmpdir(), "ds-unit09-"));
try {
  mkdirSync(join(tmp, "workspace", "r1", "_state"), { recursive: true });
  eq("links.yaml 缺失 → undefined（console 全类目待办）", parseLinks(tmp, "r1"), undefined);

  writeFileSync(join(tmp, "workspace", "r1", "_state", "links.yaml"),
    'tapd:\n  url: "https://t/1"\ndev_plan:\n  url: "http://pro/2"\ntest_env:\n  url: ""\n  cluster: fat\nwiki:\n  - name: 总览\n    url: "https://w/1"\nservices:\n  s1:\n    pipeline: "https://ci/1"\n    wiki: "https://w/s1"\n');
  const parsed = parseLinks(tmp, "r1");
  eq("合法文件 → tapd.url 解析", parsed?.tapd?.url, "https://t/1");
  eq("test_env.cluster 解析", parsed?.test_env?.cluster, "fat");
  eq("需求级 wiki 列表解析（BUG-001）", parsed?.wiki?.[0]?.name, "总览");
  eq("服务级 pipeline 解析", parsed?.services?.["s1"]?.pipeline, "https://ci/1");
  eq("服务级 wiki 解析（BUG-001）", parsed?.services?.["s1"]?.wiki, "https://w/s1");

  writeFileSync(join(tmp, "workspace", "r1", "_state", "links.yaml"), "tapd: [broken\n");
  eq("坏 yaml → undefined（容错不炸）", parseLinks(tmp, "r1"), undefined);

  // 首实例（本仓真文件）
  if (existsSync(join(REPO, "workspace", "dev-swarm优化v3", "_state", "links.yaml"))) {
    const own = parseLinks(REPO, "dev-swarm优化v3");
    eq("首实例：tapd 留空（toolchain 无单→待办）", own?.tapd?.url ?? "", "");
    eq("首实例：wiki 空列表（待办）", Array.isArray(own?.wiki) && own!.wiki!.length === 0, true);
    eq("首实例：服务级=dev-swarm-workspace 两槽存在", Object.keys(own?.services ?? {}).includes("dev-swarm-workspace"), true);
  } else { eq("首实例 links.yaml 存在", false, true); }
} finally { rmSync(tmp, { recursive: true, force: true }); }

// ── 源码静态断言（C9：默认收起/八类目/待办/只读/两入口）──
const drawer = readFileSync(join(CONSOLE, "client/src/components/DevEntryDrawer.tsx"), "utf-8");
has("抽屉默认收起（translate-x-full）", drawer, "translate-x-full");
has("滑出态（translate-x-0）", drawer, "translate-x-0");
has("未填=待办 pill", drawer, "待办");
// BUG-003：五类目 v2；SQL/Saturn/Apollo/监控 不得再渲染
for (const cat of ["TAPD 需求单", "研发计划", "测试环境和集群", "Wiki", "流水线"]) {
  has(`类目「${cat}」渲染`, drawer, cat);
}
for (const gone of ["Saturn", "Apollo"]) {
  const ok = !drawer.includes(`label="${gone}"`);
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} 类目「${gone}」已砍（BUG-003）`);
}
has("wiki 多条渲染（Wiki · name）", drawer, "Wiki · ${w.name}");
has("只读注记", drawer, "只读");

const row = readFileSync(join(CONSOLE, "client/src/components/RequirementRow.tsx"), "utf-8");
has("列表行内入口（stopPropagation）", row, "e.stopPropagation(); onDevEntry()");
const detail = readFileSync(join(CONSOLE, "client/src/pages/RequirementDetail.tsx"), "utf-8");
has("详情页头部入口", detail, "setDevEntryOpen(true)");
has("详情页抽屉直传 detail", detail, "detail={requirement}");
const idx = readFileSync(join(CONSOLE, "server/index.ts"), "utf-8");
has("detail 载荷带 links", idx, "links: parseLinks(");
has("tapdUrl links 优先（BUG-002，列表）", idx, "links?.tapd?.url || c?.tapdUrl");

console.log(fail === 0 ? "🎉 unit-09 全绿" : `💥 unit-09 失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
