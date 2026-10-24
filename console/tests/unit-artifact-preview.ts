// 未归类产物预览：xlsx 读出单元格；pdf/html/png 走 raw；yaml 按原文换行而不是拆词
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { previewXlsx } from "../server/xlsx-preview.ts";

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

const book = previewXlsx(readFileSync(join(HERE, "fixtures/sheets.xlsx")));
eq("三张表", book.length, 3);
eq("第一张表表头含序号", book[0].rows[0]?.includes("序号"), true);
eq("第一张表表头含开户名", book[0].rows[0]?.includes("开户名"), true);
eq("第一张表有数据行", book[0].rows.length > 2, true);
eq("企业名称在单元格里", book[0].rows.some((r) => r.some((c) => c.includes("示例企业"))), true);
eq("空表不编造行", book[1].rows.length, 0);
eq("含外部主体", book.some((s) => s.name === "外部主体" && s.rows.length > 1), true);
eq("含示例主体", book.some((s) => s.name === "示例主体"), true);

let threw = false;
try { previewXlsx(Buffer.from("not a zip")); } catch { threw = true; }
eq("非 zip 拒绝", threw, true);

const workspace = readFileSync(join(HERE, "../server/workspace.ts"), "utf-8");
has("raw 放行 pdf", workspace, '".pdf": "application/pdf"');
has("raw 放行 html", workspace, '".html": "text/html; charset=utf-8"');
has("raw 仍放行 png", workspace, '".png": "image/png"');
has("html sandbox CSP", workspace, "sandbox allow-scripts");
has("xlsx 走 sheet 端点", workspace, 'endsWith(".xlsx")');

const detail = readFileSync(join(HERE, "../client/src/pages/RequirementDetail.tsx"), "utf-8");
const artifact = readFileSync(join(HERE, "../client/src/components/ArtifactPreview.tsx"), "utf-8");
has("详情页挂 ArtifactPreview", detail, "<ArtifactPreview");
has("yaml 预览不拆词", detail.includes("whitespace-pre overflow-x-auto") && !detail.includes("break-all") ? "ok" : "bad", "ok");
has("html iframe 禁止同源", artifact, 'sandbox="allow-scripts"');
has("pdf 用 iframe", artifact, "kind === 'pdf'");
has("图片用 img", artifact, "kind === 'image'");

if (fail) {
  console.error(`\n${fail} 条失败`);
  process.exit(1);
}
console.log("\nunit-artifact-preview 全绿");
