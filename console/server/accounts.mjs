#!/usr/bin/env node
// accounts.mjs — console 登录账号发放 CLI（03 §五.3 / X02·D002：管理员发放，不开放自助注册）
// 用法：node console/server/accounts.mjs add <账号>   交互输密码两遍（回显屏蔽），生成本账号随机盐+scrypt 散列
//       node console/server/accounts.mjs list        仅列账号与备注，不回显散列
// DEV_SWARM_ACCOUNTS_FILE 环境变量仅测试用（指向临时文件，不碰真实凭据）
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const FILE = process.env.DEV_SWARM_ACCOUNTS_FILE || join(dirname(fileURLToPath(import.meta.url)), "..", ".local-state", "accounts.local.yaml");

function load() {
  if (!existsSync(FILE)) return { accounts: [] };
  return (yaml.load(readFileSync(FILE, "utf-8")) ?? { accounts: [] });
}

async function add(account) {
  // readline 仅在 add 内创建（07：list 曾因顶层 rl 未 close 挂起）
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let muted = false;
  const origWrite = rl.output.write.bind(rl.output);
  rl.output.write = (chunk, ...rest) => { if (muted && chunk !== "\r\n") return; origWrite(chunk, ...rest); };
  const ask = async (label, hide) => {
    muted = hide;
    const v = await rl.question(label);
    muted = false;
    origWrite("\n");
    return v.trim();
  };
  const p1 = await ask("密码: ", true);
  if (p1.length < 6) { console.error("密码至少 6 位"); process.exit(1); }
  const p2 = await ask("再输一遍: ", true);
  rl.close();
  if (p1 !== p2) { console.error("两次输入不一致"); process.exit(1); }
  const doc = load();
  if (!Array.isArray(doc.accounts)) doc.accounts = [];
  if (doc.accounts.some((e) => e.account === account)) {
    console.error(`账号已存在: ${account}（改密=手改文件删该行后重新 add）`);
    process.exit(1);
  }
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(p1, salt, 64).toString("hex");
  doc.accounts.push({ account, salt, hash, note: `发放于 ${new Date().toISOString().slice(0, 10)}` });
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, yaml.dump(doc, { lineWidth: 120 }), "utf-8");
  console.log(`已发放 ${account} -> ${FILE}（仅盐+散列落盘，明文未存储）`);
}

function list() {
  const doc = load();
  if (!doc.accounts?.length) { console.log("（无账号）"); return; }
  for (const e of doc.accounts) console.log(`${e.account}\t${e.note ?? ""}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "add" && arg) await add(arg);
else if (cmd === "list") list();
else { console.error("用法: node console/server/accounts.mjs add <账号> | list"); process.exit(1); }
