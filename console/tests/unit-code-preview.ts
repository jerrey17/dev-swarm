// Python / Java / Proto 等代码预览：关键字上色、注释和字符串里不上色、不丢字
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { codeLines, codeLangOf } from "../client/src/utils/codeHighlight.ts";

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

function flat(source: string, lang: Parameters<typeof codeLines>[1]): string {
  return codeLines(source, lang).map((line) => line.map((s) => s.text).join("")).join("\n");
}
function roundtrip(source: string, lang: Parameters<typeof codeLines>[1]) {
  eq(`${lang} 不丢字`, flat(source, lang), source.endsWith("\n") ? source.slice(0, -1) : source);
}

const py = '"""PDF 直签"""\nfrom __future__ import annotations\n# 注释\nSEAL = "class"\n';
const pyLines = codeLines(py, "python");
eq("文档字符串是 string", pyLines[0].every((s) => s.kind === "string"), true);
eq("import 是关键字", pyLines[1].some((s) => s.kind === "keyword" && s.text === "import"), true);
eq("行注释", pyLines[2].some((s) => s.kind === "comment"), true);
eq("字符串里的 class 不是关键字", pyLines[3].some((s) => s.kind === "string" && s.text === '"class"'), true);
eq("字符串行没有 keyword", pyLines[3].every((s) => s.kind !== "keyword"), true);
roundtrip(py, "python");

const java = 'public class Spike {\n  // 注释\n  String html = "<div class=\'sec\'>";\n}\n';
const javaLines = codeLines(java, "java");
eq("public/class 是关键字", javaLines[0].filter((s) => s.kind === "keyword").map((s) => s.text).join(","), "public,class");
eq("java 注释", javaLines[1].some((s) => s.kind === "comment"), true);
eq("java 字符串含 class", javaLines[2].some((s) => s.kind === "string" && s.text.includes("class")), true);
roundtrip(java, "java");

const proto = 'enum ErrCode {\n  //参数错误\n  ERR_CODE_BAD_PARAM = -10000;\n}\nmessage GetAllUserInfoByUidRequest {\n  optional uint64 uid = 2;\n}\n';
const protoLines = codeLines(proto, "proto");
eq("enum 是关键字", protoLines[0].some((s) => s.kind === "keyword" && s.text === "enum"), true);
eq("proto 注释", protoLines[1].some((s) => s.kind === "comment"), true);
eq("message 是关键字", protoLines.some((line) => line.some((s) => s.text === "message" && s.kind === "keyword")), true);
eq("optional 是关键字", protoLines.some((line) => line.some((s) => s.text === "optional" && s.kind === "keyword")), true);
roundtrip(proto, "proto");

const json = codeLines('{"name": "class", "ok": true}\n', "json");
eq("json 键", json[0].some((s) => s.kind === "key" && s.text === '"name"'), true);
eq("json true", json[0].some((s) => s.kind === "keyword" && s.text === "true"), true);

eq("扩展名 python", codeLangOf(".py"), "python");
eq("扩展名 java", codeLangOf(".java"), "java");
eq("扩展名 proto", codeLangOf(".proto"), "proto");
eq("扩展名 ts", codeLangOf(".ts"), "typescript");
eq("非代码扩展名", codeLangOf(".txt"), null);

const detail = readFileSync(join(HERE, "../client/src/pages/RequirementDetail.tsx"), "utf-8");
has("详情页按扩展名选代码语言", detail, "codeLangOf(selectedExt)");
const preview = readFileSync(join(HERE, "../client/src/components/CodePreview.tsx"), "utf-8");
has("代码预览标记", preview, "data-code-preview");

if (fail) {
  console.error(`\n${fail} 条失败`);
  process.exit(1);
}
console.log("\nunit-code-preview 全绿");
