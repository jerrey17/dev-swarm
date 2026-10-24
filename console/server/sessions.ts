// sessions.ts — F11c（03 v2 §3.2/X05）：会话关联 + messages 展开
// 数据根=~/.claude/projects（本机 home，只读 H08）；X05 匹配规则=workspace/{需求名}/ 路径引用
import { Router } from "express";
import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { parseJsonlFile } from "./parsers/jsonl.js";

const PROJECTS_DIR = join(homedir(), ".claude", "projects");
const MAX_JSONL_BYTES = 50 * 1024 * 1024; // X05：单文件超 50MB 跳过

const router = Router();

interface LinkedSession {
  sessionId: string;
  modified: string;
  firstPrompt?: string;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function grepFiles(dir: string, pattern: string): Promise<string[]> {
  return new Promise((resolve) => {
    execFile("grep", ["-rlE", "--include=*.jsonl", pattern, dir], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err || !stdout) { resolve([]); return; }
      resolve(stdout.trim().split("\n").filter(Boolean));
    });
  });
}

async function extractFirstPrompt(filePath: string): Promise<string> {
  const content = await readFile(filePath, "utf-8").catch(() => "");
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === "user" && obj.message?.role === "user") {
        const blocks = obj.message.content;
        let raw = "";
        if (typeof blocks === "string") {
          raw = blocks;
        } else if (Array.isArray(blocks)) {
          const text = blocks.find((b: { type: string; text?: string }) => b.type === "text");
          if (text?.text) raw = text.text;
        }
        const clean = raw.replace(/<[^>]+>[^<]*<\/[^>]+>/g, "").trim();
        if (clean.length > 5) return clean.slice(0, 120);
      }
    } catch { /* skip malformed lines */ }
  }
  return "";
}

// GET /api/requirements/:name/sessions — 会话按需求名关联（X05：单模式覆盖产物与状态文件引用）
router.get("/api/requirements/:name/sessions", async (req, res) => {
  try {
    const safeName = escapeRegExp(req.params.name);
    const pattern = `workspace/${safeName}/`;

    const projectDirs = await readdir(PROJECTS_DIR).catch(() => [] as string[]);
    const results: LinkedSession[] = [];

    for (const dir of projectDirs) {
      const dirPath = join(PROJECTS_DIR, dir);
      const dirStat = await stat(dirPath).catch(() => null);
      if (!dirStat?.isDirectory()) continue;

      for (const filePath of await grepFiles(dirPath, pattern)) {
        const fileStat = await stat(filePath).catch(() => null);
        if (!fileStat) continue;
        const sessionId = filePath.split("/").pop()?.replace(/\.jsonl$/, "") ?? "";
        if (!sessionId) continue;
        const firstPrompt = fileStat.size > MAX_JSONL_BYTES ? undefined : await extractFirstPrompt(filePath);
        results.push({ sessionId, modified: fileStat.mtime.toISOString(), firstPrompt });
      }
    }

    // 同 sessionId 去重取最新 mtime，按修改时间倒序
    const deduped = new Map<string, LinkedSession>();
    for (const r of results) {
      const existing = deduped.get(r.sessionId);
      if (!existing || r.modified > existing.modified) deduped.set(r.sessionId, r);
    }
    res.json([...deduped.values()].sort((a, b) => b.modified.localeCompare(a.modified)));
  } catch {
    res.status(500).json({ error: "Failed to find linked sessions" });
  }
});

// GET /api/sessions/:sessionId/messages — 会话消息流（B3 选 B；数组直返与源一致）
router.get("/api/sessions/:sessionId/messages", async (req, res) => {
  try {
    // sessionId 约定不带扩展名（源 basename(filePath, '.jsonl')）；防路径注入
    const sessionId = req.params.sessionId;
    if (sessionId.includes("/") || sessionId.includes("..")) {
      res.status(400).json({ error: "Invalid sessionId" });
      return;
    }
    const projectDirs = await readdir(PROJECTS_DIR).catch(() => [] as string[]);
    let filePath: string | null = null;
    for (const dir of projectDirs) {
      const candidate = join(PROJECTS_DIR, dir, `${sessionId}.jsonl`);
      if (await stat(candidate).then(s => s.isFile()).catch(() => false)) {
        filePath = candidate;
        break;
      }
    }
    if (!filePath) { res.status(404).json({ error: "Session not found" }); return; }
    const fileStat = await stat(filePath);
    if (fileStat.size > MAX_JSONL_BYTES) { res.status(413).json({ error: "Session file too large" }); return; }
    const content = await readFile(filePath, "utf-8");
    res.json(parseJsonlFile(content));
  } catch {
    res.status(500).json({ error: "Failed to read session" });
  }
});

export default router;
