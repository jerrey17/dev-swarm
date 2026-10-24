// tests/unit-03.ts — 05-B1 单元测试（03 §F3 / D002 / 04 B1 方案 L）
// 覆盖：parseTapdUrl 正则口径（canonical/tapd_fe 归一化/括注截断/正文限定/首匹配）/
//       parseCurrent 集成（临时 workspace 夹具）/ 列表白名单带出断言（源码静态，模式同 migration.ts ⑥）
import { readFileSync } from "node:fs";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTapdUrl, parseCurrent } from "../server/parser.js";

let fail = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} ${label}${ok ? "" : ` → got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
}

// ── parseTapdUrl（D002 口径）──
const CANONICAL = "https://www.tapd.cn/100001/prong/stories/view/1000010000000001";
eq(
  "canonical prong 形态重建",
  parseTapdUrl(`---\nname: a\n---\n\n- TAPD：${CANONICAL}`),
  CANONICAL,
);
eq(
  "tapd_fe 形态归一化为 prong",
  parseTapdUrl("---\nname: a\n---\n\n- TAPD：https://www.tapd.cn/tapd_fe/100001/story/detail/1000010000000002"),
  "https://www.tapd.cn/100001/prong/stories/view/1000010000000002",
);
eq(
  "行尾中文括注不吃进 ID",
  parseTapdUrl(`---\nname: a\n---\n\n- TAPD：${CANONICAL} （【刷数】sms 某表 说明文字）`),
  CANONICAL,
);
eq("正文无链接 → undefined", parseTapdUrl("---\nname: a\n---\n\n正文没有故事地址。"), undefined);
eq("无 frontmatter（切片<3）→ undefined", parseTapdUrl("只有正文但无分隔线 " + CANONICAL), undefined);
eq("链接只在 frontmatter 不算（正文限定）", parseTapdUrl(`---\nname: a\nlink: ${CANONICAL}\n---\n\n正文没有。`), undefined);
eq(
  "多个链接取正文首个",
  parseTapdUrl(`---\nname: a\n---\n\n- 第一：${CANONICAL}\n- 第二：https://www.tapd.cn/99999/prong/stories/view/111`),
  CANONICAL,
);

// ── parseCurrent 集成（临时 repoRoot 夹具）──
const root = mkdtempSync(join(tmpdir(), "unit-03-"));
function fixture(req: string, body: string) {
  const dir = join(root, "workspace", req, "_state");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "current.md"), `---\nname: "${req}"\nphase: 开发编码\nnode: 开发编码\nprofile: toolchain\nterminal: false\n---\n\n# current.md\n\n${body}\n`);
}
try {
  fixture("正例需求", `- TAPD：${CANONICAL}`);
  fixture("反例需求", "- 备忘：无故事地址");
  eq("parseCurrent 正例带出 tapdUrl", parseCurrent(root, "正例需求")?.tapdUrl, CANONICAL);
  eq("parseCurrent 反例 tapdUrl=undefined", parseCurrent(root, "反例需求")?.tapdUrl, undefined);
  eq("current.md 缺失 → null", parseCurrent(root, "不存在"), null);
} finally {
  rmSync(root, { recursive: true, force: true });
}

// ── 列表白名单带出断言（04 B1：仅测 parseCurrent 发现不了；源码静态断言，模式同 migration.ts ⑥）──
const here = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(here, "..", "server", "index.ts"), "utf-8");
const listSection = indexSrc.split("// ② 需求详情")[0];
eq("index.ts 列表 handler 含 tapdUrl", listSection.includes("tapdUrl: links?.tapd?.url || c?.tapdUrl"), true);
eq("断言确在列表段（非详情段）", listSection.includes('"/api/requirements"') && !listSection.includes("...c,"), true);

console.log(`\n${fail === 0 ? "全部通过" : `失败 ${fail} 项`}`);
process.exit(fail === 0 ? 0 : 1);
