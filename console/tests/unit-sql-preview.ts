// SQL 文件预览：分词不丢字、注释/字符串里的关键字不上色；详情页 .sql 走 CodePreview 且有一键复制
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sqlLines } from "../client/src/utils/sqlHighlight.ts";

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
  return sqlLines(source).map((line) => line.map((s) => s.text).join("")).join("\n");
}

const comment = sqlLines("-- CREATE TABLE t (id INT)\nSELECT 1;");
eq("行注释整行是 comment", comment[0].every((s) => s.kind === "comment"), true);
eq("注释外 SELECT 是关键字", comment[1].some((s) => s.kind === "keyword" && s.text === "SELECT"), true);
eq("数字单独上色", comment[1].some((s) => s.kind === "number" && s.text === "1"), true);

const str = sqlLines("COMMENT 'CREATE TABLE'");
eq("字符串内 CREATE 不是关键字", str[0].some((s) => s.kind === "keyword" && s.text.includes("CREATE")), false);
eq("引号内容是 string", str[0].some((s) => s.kind === "string" && s.text === "'CREATE TABLE'"), true);

const quoted = sqlLines("SELECT 'a''b';");
eq("成对单引号转义留在字符串里", quoted[0].some((s) => s.kind === "string" && s.text === "'a''b'"), true);

const block = sqlLines("/* CREATE\nTABLE */\nDROP TABLE t;");
eq("块注释第一行", block[0][0]?.kind, "comment");
eq("块注释第二行", block[1][0]?.kind, "comment");
eq("块注释后的 DROP 是关键字", block[2].some((s) => s.kind === "keyword" && s.text === "DROP"), true);

eq("空文件零行", sqlLines("").length, 0);
eq("分词往返不丢字", flat("CREATE TABLE t (\n  id INT\n);\n"), "CREATE TABLE t (\n  id INT\n);");

const detail = readFileSync(join(HERE, "../client/src/pages/RequirementDetail.tsx"), "utf-8");
const preview = readFileSync(join(HERE, "../client/src/components/CodePreview.tsx"), "utf-8");
has("详情页 .sql 用 CodePreview", detail, "selectedExt === '.sql' ? 'sql'");
has("详情页挂上 CodePreview", detail, "<CodePreview content={previewContent} language={codeLang} />");
has("全屏也预览 SQL", detail.split("<CodePreview").length - 1 === 2 ? "two" : "not-two", "two");
has("一键复制按钮文案", preview, "复制 SQL");
has("复制的是原文", preview, "writeClipboard(content)");

if (fail) {
  console.error(`\n${fail} 条失败`);
  process.exit(1);
}
console.log("\nunit-sql-preview 全绿");
