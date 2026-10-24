// B-03/B-04 服务端修复冒烟（无测试框架，tsx 直跑断言）：
//   B-04：mask 覆盖 notify.reverify.target（占位符/URL 均掩码），agents 等非敏感键不误伤
//   B-03/F01：pipelineStages 按 profile 返回链序列（toolchain 9 / data-script 7；java 12）
//   06-S3：parseDecisions 角色只取括号首 token（夹具含双逗号标题与 human 两种形态）
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { effectiveConfig } from "../server/config-merge.js";
import { pipelineStages, parseDecisions } from "../server/parser.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function assert(cond: boolean, msg: string): void {
  if (!cond) { console.error("❌ " + msg); process.exit(1); }
  console.log("✅ " + msg);
}

const cfg = effectiveConfig(ROOT);
const notify = (cfg.effective as Record<string, any>).notify?.reverify;
assert(notify?.target === "***", "B-04: notify.reverify.target 已掩码为 ***（实际值：" + String(notify?.target) + "）");
assert(notify?.channel === "qiwei-webhook", "B-04: 非敏感键 channel 不误伤");

const stages = pipelineStages(ROOT, "toolchain");
assert(Array.isArray(stages) && stages.length === 9, "B-03/F01: toolchain 返回 9 阶段（实际 " + (stages?.length ?? "undefined") + "）");
assert(stages?.[0] === "需求分析" && stages?.[1] === "技术方案" && stages?.[8] === "知识库更新", "B-03: 阶段序列首尾正确（02 已退链）");
assert(!stages?.includes("服务拆分") && !stages?.includes("提测") && !stages?.includes("发布CheckList"), "F01: 02/08/10 不在 toolchain 链");
const dsStages = pipelineStages(ROOT, "data-script");
assert(Array.isArray(dsStages) && dsStages.length === 7 && dsStages?.[3] === "编写脚本和验证脚本", "F02: data-script 7 阶段且第 4 位=编写脚本和验证脚本");
assert(pipelineStages(ROOT, "不存在的profile") === undefined, "B-03: profile 文件缺失时返回 undefined（客户端回退 phases）");

// 06-S3：role 只取括号首 token（双逗号标题→cc-dev；单逗号→human）
const tmp = mkdtempSync(join(tmpdir(), "ds-smoke-decisions-"));
try {
  const reqDir = join(tmp, "workspace", "夹具需求", "_state");
  mkdirSync(reqDir, { recursive: true });
  writeFileSync(join(reqDir, "decisions.md"),
    "### D001 — 双逗号形态（2026-10-03，cc-dev，待 cursor-qa 复审确认）\n- 决策：x\n\n" +
    "### D002 — 单逗号形态（2026-10-03，human）\n- 决策：y\n", "utf-8");
  const decs = parseDecisions(tmp, "夹具需求");
  assert(decs.length === 2, "S3: 两条决策均被解析");
  assert(decs[0]?.role === "cc-dev", "S3: 双逗号标题 role 只取首 token=cc-dev（实际 " + decs[0]?.role + "）");
  assert(decs[1]?.role === "human", "S3: 单逗号标题 role=human");
} finally { rmSync(tmp, { recursive: true, force: true }); }

console.log("== smoke 通过 ==");
