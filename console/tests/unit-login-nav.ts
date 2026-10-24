// unit-login-nav.ts — BUG-001 修复单测：targetFrom 复原规则（功能）+ Login 跳转单一路径（源码静态防回归）
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { targetFrom } from "../client/src/pages/Login.js";

const results: string[] = [];
function check(name: string, cond: boolean, detail = "") {
  results.push(`${cond ? "✅" : "❌"} ${name}${detail ? `（${detail}）` : ""}`);
  if (!cond) process.exitCode = 1;
}

// ① targetFrom 功能（BUG-001：pathname+search+hash 全量复原；无 from 回首页）
check("深链含 query/hash 全量复原", targetFrom({ from: { pathname: "/reverify", search: "?state=待复验", hash: "#top" } }) === "/reverify?state=待复验#top");
check("深链仅 pathname 原样返回", targetFrom({ from: { pathname: "/pipeline" } }) === "/pipeline");
check("无 from（直访登录页）回首页", targetFrom(null) === "/" && targetFrom({}) === "/");
check("from 无 pathname 回首页", targetFrom({ from: { search: "?x=1" } }) === "/");

// ② 源码静态（防回归：跳转单一路径，杜绝 BUG-001 双导航竞争复发）
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "client", "src", "pages", "Login.tsx"), "utf-8");
check("短路 Navigate 目标为 from（不再硬编码 /）", /<Navigate to=\{from\} replace \/>/.test(src));
check("Login 无 useNavigate/无手动 navigate（防双导航竞争）", !/useNavigate/.test(src) && !/navigate\(/.test(src));

console.log(results.join("\n"));
console.log(`unit-login-nav ${process.exitCode ? "存在失败" : "全绿"}`);
