// 企微通知：轮询检测 reverify 新增行 -> webhook 直发；去重键=(需求,单号,commit)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReverifyRow } from "./parser.js";

const LOCAL = join(dirname(fileURLToPath(import.meta.url)), "..", ".local-state");

function loadNotified(): string[] {
  const p = join(LOCAL, "notified.json");
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return []; }
}

export async function notifyNewReverify(rows: ReverifyRow[], webhookUrl: string): Promise<void> {
  if (!webhookUrl) return;
  const seen = new Set(loadNotified());
  const fresh = rows.filter(r => r.state === "待复验" && !seen.has(`${r.req}|${r.id}|${r.commit}`));
  if (fresh.length === 0) return;
  for (const r of fresh) {
    const text = `[dev-swarm] ${r.req} 新增待复验：${r.id} ${r.point}（${r.repo}@${r.commit.slice(0, 7)}，实例 ${r.instance || "待部署——等 human 填实例"}）`;
    try {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resp = await fetch(webhookUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ msgtype: "text", text: { content: text } }),
            signal: AbortSignal.timeout(5000),
          });
          if (!resp.ok) throw new Error(`webhook ${resp.status}`);
          lastErr = null; break;
        } catch (e) { lastErr = e; }
      }
      if (lastErr) { console.error("[notify] 发送失败（弱依赖，不阻断）:", (lastErr as Error).message); continue; }
      seen.add(`${r.req}|${r.id}|${r.commit}`);
    } catch (e) { console.error("[notify] 异常:", e); }
  }
  writeFileSync(join(LOCAL, "notified.json"), JSON.stringify([...seen], null, 2));
}
