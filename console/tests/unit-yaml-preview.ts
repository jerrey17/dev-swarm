// YAML 预览与 SQL 同一套：键/字符串/注释上色，不丢字，详情页 .yaml/.yml 走 CodePreview
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { yamlLines } from "../client/src/utils/yamlHighlight.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
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

function flat(source: string): string {
  return yamlLines(source).map((line) => line.map((s) => s.text).join("")).join("\n");
}

const sample = "kind: java-business\nservices:\n  - name: contract_srv\n    appid: \"\"\n    enabled: true\n    port: 8080  # 监听\n";
const lines = yamlLines(sample);
eq("键 kind 上色", lines[0].some((s) => s.kind === "key" && s.text === "kind"), true);
eq("注释行", yamlLines("# services.yaml\n")[0].every((s) => s.kind === "comment"), true);
eq("空字符串是 string", lines[3].some((s) => s.kind === "string" && s.text === '""'), true);
eq("布尔是关键字", lines[4].some((s) => s.kind === "keyword" && s.text === "true"), true);
eq("数字上色", lines[5].some((s) => s.kind === "number" && s.text === "8080"), true);
eq("行尾注释", lines[5].some((s) => s.kind === "comment" && s.text.startsWith("#")), true);
eq("分词往返不丢字", flat(sample), sample.replace(/\n$/, ""));

const detail = readFileSync(join(HERE, "../client/src/pages/RequirementDetail.tsx"), "utf-8");
const preview = readFileSync(join(HERE, "../client/src/components/CodePreview.tsx"), "utf-8");
has("yaml 与 sql 共用 CodePreview", detail, "selectedExt === '.yaml' || selectedExt === '.yml'");
has("传入 language", detail, "language={codeLang}");
has("复制 YAML", preview, "复制 YAML");

if (fail) {
  console.error(`\n${fail} 条失败`);
  process.exit(1);
}
console.log("\nunit-yaml-preview 全绿");
