// auth.ts — 控制台登录后才能查看（03 §五/§六）：登录族三端点 + 未登录 API 拦截（X07 双层之 server 侧）
// 机制：本地账号 scrypt 散列校验（X01/D002）+ 内存 session 表 + httpOnly cookie（X03）；挂载次序=index.ts：express.json → 本路由（白名单即自身）→ authMiddleware → 既有只读 routers
import { Router, Request, Response, NextFunction } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { ROOT } from "./config.js";

// DEV_SWARM_ACCOUNTS_FILE 仅测试用（unit-auth 指向临时文件，避免碰真实凭据）
const ACCOUNTS_FILE = process.env.DEV_SWARM_ACCOUNTS_FILE ?? join(ROOT, ".local-state", "accounts.local.yaml");
export const SESSION_COOKIE = "dev-swarm-session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // X03：7 天滑动续期；console 重启全部失效（有意取舍，11 回评）

interface AccountEntry { account: string; salt: string; hash: string; note?: string }
interface SessionEntry { account: string; expiresAt: number }

const sessions = new Map<string, SessionEntry>();

function loadAccounts(): AccountEntry[] {
  // 每次登录重读（03 §五.2：accounts.mjs 发放后免重启生效）；文件缺失/解析失败按无账号处理（拒绝登录，不炸服务）
  try {
    const doc = yaml.load(readFileSync(ACCOUNTS_FILE, "utf-8")) as { accounts?: AccountEntry[] } | undefined;
    return Array.isArray(doc?.accounts) ? doc.accounts.filter(e => e?.account && e?.salt && e?.hash) : [];
  } catch { return []; }
}

function verifyPassword(entry: AccountEntry, password: string): boolean {
  // scrypt 默认参数（N=16384,r=8,p=1，03 §五.2）；timingSafeEqual 防时序侧信道；hex 异常按不匹配
  try {
    const expect = Buffer.from(entry.hash, "hex");
    const actual = scryptSync(password, entry.salt, expect.length);
    return expect.length > 0 && expect.length === actual.length && timingSafeEqual(expect, actual);
  } catch { return false; }
}

function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function currentSession(req: Request): { token: string; session: SessionEntry } | null {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expiresAt <= Date.now()) { sessions.delete(token); return null; }
  s.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, session: s };
}

function setSessionCookie(res: Response, token: string | null): void {
  const cookie = token
    ? `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
    : `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  res.setHeader("Set-Cookie", cookie);
}

const router = Router();

// POST /api/auth/login —— scrypt 校验；失败 401 统一文案（X04：不区分账号/密码错，防枚举；不锁定）
router.post("/api/auth/login", (req, res) => {
  const { account, password } = (req.body ?? {}) as { account?: string; password?: string };
  const entry = loadAccounts().find(e => e.account === account);
  if (!account || !password || !entry || !verifyPassword(entry, password)) {
    res.status(401).json({ error: "账号或密码不正确" });
    return;
  }
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { account: entry.account, expiresAt: Date.now() + SESSION_TTL_MS });
  setSessionCookie(res, token);
  res.json({ ok: true, account: entry.account });
});

// POST /api/auth/logout —— H07 双侧失效：server 删 token + cookie 置空过期；未登录也 200（幂等）
router.post("/api/auth/logout", (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  setSessionCookie(res, null);
  res.json({ ok: true });
});

// GET /api/auth/session —— AuthProvider 挂载探测；未登录 200 {authenticated:false}（属登录族，不违反 H01）
router.get("/api/auth/session", (req, res) => {
  const hit = currentSession(req);
  res.json(hit ? { authenticated: true, account: hit.session.account } : { authenticated: false });
});

// H01：其余 /api/* 未携带有效登录态一律 401（白名单=上方三端点，由挂载次序天然豁免；非 /api 不拦，页面层归 client RequireAuth）
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api/")) { next(); return; }
  const hit = currentSession(req);
  if (hit) {
    setSessionCookie(res, hit.token); // 06 S1：server 会话滑动续期时同步重发 cookie，浏览器侧 Max-Age 跟随滑动
    next();
    return;
  }
  res.status(401).json({ error: "unauthorized" });
}

export default router;
