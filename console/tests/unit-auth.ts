// unit-auth.ts — 05 B1 冒烟 + 07 补强：登录族三端点 + authMiddleware 拦截 + cookie 滑动续期（06 S1）+ accounts.mjs 发放闭环
// 隔离（07）：DEV_SWARM_ACCOUNTS_FILE 指向临时文件，全程不读写真实凭据 .local-state/accounts.local.yaml；随机端口不碰 4600
import express from "express";
import { scryptSync, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// execFile 的 input=一次写完立即 end 会让 readline 挂起（07 实测）；分阶段写+延迟 end 正常
function runCli(args: string[], password?: string): Promise<{ stdout: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const p = spawn("node", [join(ROOT, "server", "accounts.mjs"), ...args]);
    let stdout = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stdout += d));
    const timer = setTimeout(() => { p.kill(); reject(new Error(`cli 超时: ${args.join(" ")}`)); }, 15000);
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("exit", (code) => { clearTimeout(timer); resolve({ stdout, code }); });
    if (password) {
      p.stdin.write(`${password}\n`);
      setTimeout(() => { p.stdin.write(`${password}\n`); setTimeout(() => p.stdin.end(), 100); }, 150);
    } else {
      p.stdin.end();
    }
  });
}
const ACCOUNTS_FILE = join(tmpdir(), `dev-swarm-accounts-test-${randomBytes(6).toString("hex")}.yaml`);
process.env.DEV_SWARM_ACCOUNTS_FILE = ACCOUNTS_FILE;
const { default: authRouter, authMiddleware, SESSION_COOKIE } = await import("../server/auth.js");

const results: string[] = [];
function check(name: string, cond: boolean, detail = "") {
  results.push(`${cond ? "✅" : "❌"} ${name}${detail ? `（${detail}）` : ""}`);
  if (!cond) process.exitCode = 1;
}

function writeAccounts(account: string, password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  writeFileSync(ACCOUNTS_FILE, `accounts:\n  - account: ${account}\n    salt: ${salt}\n    hash: ${hash}\n`, "utf-8");
}

async function main() {
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  app.use(authMiddleware);
  app.get("/api/requirements", (_req, res) => res.json([{ name: "fake" }])); // 受拦代表端点
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  try {
    // ① H01：未登录受拦端点 401
    let r = await fetch(`${base}/api/requirements`);
    check("未登录 GET /api/requirements → 401", r.status === 401);

    // ② 未登录 session 200 authenticated:false（登录族放行）
    r = await fetch(`${base}/api/auth/session`);
    const s0 = await r.json() as { authenticated?: boolean };
    check("未登录 GET /api/auth/session → 200 且 authenticated=false", r.status === 200 && s0.authenticated === false);

    // ③ 账号文件缺失时 login 401 统一文案（X04）
    r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: "anyone", password: "whatever123" }) });
    const e0 = await r.json() as { error?: string };
    check("无账号文件 login → 401「账号或密码不正确」", r.status === 401 && e0.error === "账号或密码不正确");

    // ④ 正确账密 → 200 + Set-Cookie（X03 httpOnly SameSite=Lax）
    writeAccounts("tester", "right-pass-6");
    r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: "tester", password: "wrong-pass" }) });
    check("错误密码 → 401 统一文案", r.status === 401);
    r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: "tester", password: "right-pass-6" }) });
    const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
    const setCookieRaw = r.headers.get("set-cookie") ?? "";
    const body = await r.json() as { ok?: boolean; account?: string };
    check("正确账密 login → 200 {ok,account}", r.status === 200 && body.ok === true && body.account === "tester");
    check("Set-Cookie 含 HttpOnly+SameSite=Lax+dev-swarm-session", setCookieRaw.includes("HttpOnly") && setCookieRaw.includes("SameSite=Lax") && cookie.startsWith(`${SESSION_COOKIE}=`), cookie.slice(0, 30) + "…");

    // ⑤ 带 cookie：session 认得 + 受拦端点放行（H01 通过面）
    const authed = { cookie };
    r = await fetch(`${base}/api/auth/session`, { headers: authed });
    const s1 = await r.json() as { authenticated?: boolean; account?: string };
    check("带 cookie session → authenticated=true+account", s1.authenticated === true && s1.account === "tester");
    r = await fetch(`${base}/api/requirements`, { headers: authed });
    const slideCookie = r.headers.get("set-cookie") ?? "";
    const list = await r.json() as unknown[];
    check("带 cookie GET /api/requirements → 200 有数据", r.status === 200 && Array.isArray(list) && list.length === 1);
    check("06 S1：受拦端点命中会话重发 Set-Cookie（浏览器侧滑动）", slideCookie.startsWith(`${SESSION_COOKIE}=`) && slideCookie.includes("Max-Age=604800"), slideCookie.slice(0, 40) + "…");

    // ⑥ H07：logout 后旧 token 失效双侧
    r = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: authed });
    check("logout → 200", r.status === 200);
    r = await fetch(`${base}/api/auth/session`, { headers: authed });
    const s2 = await r.json() as { authenticated?: boolean };
    check("logout 后旧 cookie session → false", s2.authenticated === false);
    r = await fetch(`${base}/api/requirements`, { headers: authed });
    check("logout 后旧 cookie 受拦端点 → 401", r.status === 401);

    // ⑦ logout 幂等（未登录再 logout 也 200）
    r = await fetch(`${base}/api/auth/logout`, { method: "POST" });
    check("未登录 logout → 200 幂等", r.status === 200);

    // ⑧ 非 /api 路径不拦（页面层归 client 守卫）
    app.get("/plain", (_req, res) => res.send("ok"));
    r = await fetch(`${base}/plain`);
    check("非 /api 路径不被中间件拦", r.status === 200);

    // ⑨ 07 补强：accounts.mjs 发放闭环（真实 CLI 生成 → login 通过；stdin 分阶段喂密码两遍；写临时文件不碰真实凭据）
    const addRes = await runCli(["add", "cli-user"], "cli-pass-6");
    check("accounts.mjs add 正常退出（exit 0）", addRes.code === 0, addRes.stdout.trim().slice(-40));
    const cliYaml = readFileSync(ACCOUNTS_FILE, "utf-8");
    check("accounts.mjs add 落盘含散列且无明文密码", /hash:/.test(cliYaml) && /salt:/.test(cliYaml) && !cliYaml.includes("cli-pass-6"));
    check("accounts.mjs add 保留既有账号（tester 不丢）", cliYaml.includes("tester"));
    r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: "cli-user", password: "cli-pass-6" }) });
    check("CLI 发放账号可登录（发放→登录闭环）", r.status === 200);

    // ⑩ 07 修复回归：list 子命令可退出（曾因顶层 readline 未 close 挂起）
    const ls = await runCli(["list"]);
    check("accounts.mjs list 正常退出并列出账号", ls.code === 0 && ls.stdout.includes("cli-user") && ls.stdout.includes("tester"));
  } finally {
    server.close();
    rmSync(ACCOUNTS_FILE, { force: true });
  }

  console.log(results.join("\n"));
  console.log(`unit-auth ${process.exitCode ? "存在失败" : "全绿"}（临时账号文件已清理，未触碰真实凭据）`);
}

void main();
