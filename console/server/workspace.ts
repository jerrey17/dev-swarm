// workspace.ts — F11a（03 v2 §3.2）：需求工作区只读端点族
// 树/文件/raw/历史内容/决策原文；数据根=dataClone/workspace/{name}；全 GET 只读（H01）
import { Router } from "express";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "./config.js";
import { previewXlsx } from "./xlsx-preview.js";

const cfg = loadConfig();
const router = Router();

// ── WorkspaceNode 树（迁移自 claude-board buildWorkspaceTree） ──
export interface WorkspaceNode {
  name: string;
  path: string;
  type: "dir" | "file";
  size: number;
  modified: string;
  children?: WorkspaceNode[];
}
export interface WorkspaceGroup { key: string; entries: WorkspaceNode[] }

const WORKSPACE_MAX_DEPTH = 10;

export async function buildWorkspaceTree(dirPath: string, relBase: string, depth: number): Promise<{ nodes: WorkspaceNode[]; totalSize: number }> {
  if (depth > WORKSPACE_MAX_DEPTH) return { nodes: [], totalSize: 0 };
  const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
  const nodes: WorkspaceNode[] = [];
  let totalSize = 0;

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = join(dirPath, entry.name);
    const entryStat = await stat(fullPath).catch(() => null);
    if (!entryStat) continue;
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const sub = await buildWorkspaceTree(fullPath, rel, depth + 1);
      nodes.push({ name: entry.name, path: rel, type: "dir", size: sub.totalSize, modified: entryStat.mtime.toISOString(), children: sub.nodes });
      totalSize += sub.totalSize;
    } else if (entry.isFile()) {
      nodes.push({ name: entry.name, path: rel, type: "file", size: entryStat.size, modified: entryStat.mtime.toISOString() });
      totalSize += entryStat.size;
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-CN");
  });
  return { nodes, totalSize };
}

function reqDirOf(name: string): string {
  return resolve(join(cfg.dataClone, "workspace", name));
}

// §3.3.1 path 穿越防护：resolve 后必须仍在需求目录内；path 禁绝对路径与 ..
export function safePath(name: string, rel: string): string | null {
  if (!rel || rel.startsWith("/") || rel.includes("..")) return null;
  const dir = reqDirOf(name);
  const p = resolve(join(dir, rel));
  return p.startsWith(dir + "/") ? p : null;
}

// 顶层节点按两位数字前缀分组（key="01"~"12" | "others"；others 恒排末尾）
export function groupNodes(nodes: WorkspaceNode[]): WorkspaceGroup[] {
  const groupMap = new Map<string, WorkspaceNode[]>();
  for (const node of nodes) {
    const m = node.name.match(/^(\d{2})-/);
    const key = m ? m[1] : "others";
    const list = groupMap.get(key) ?? [];
    list.push(node);
    groupMap.set(key, list);
  }
  return [...groupMap.entries()]
    .sort(([a], [b]) => {
      if (a === "others") return 1;
      if (b === "others") return -1;
      return a.localeCompare(b);
    })
    .map(([key, entries]) => ({ key, entries }));
}

// GET /api/requirements/:name/workspace — 工作区树按 0N 前缀分组（key="01"~"12" | "others"，与 pipelinePhases order 1 起对齐）
router.get("/api/requirements/:name/workspace", async (req, res) => {
  try {
    const dir = reqDirOf(req.params.name);
    if (!existsSync(dir)) { res.status(404).json({ error: "requirement not found" }); return; }
    const { nodes } = await buildWorkspaceTree(dir, "", 1);
    res.json({ groups: groupNodes(nodes) });
  } catch {
    res.status(500).json({ error: "Failed to load workspace" });
  }
});

// §3.3.2 文本白名单（与源 TEXT_PREVIEW_EXT + .md 一致）
const TEXT_EXT = new Set([
  ".md", ".txt", ".sql", ".json", ".yaml", ".yml", ".xml", ".log", ".csv",
  ".js", ".mjs", ".ts", ".tsx", ".jsx", ".vue", ".java", ".proto", ".properties",
  ".sh", ".py", ".css", ".html", ".htm",
]);

// GET /api/requirements/:name/file?path= — UTF-8 文本内容（详情页 md/文本预览）
router.get("/api/requirements/:name/file", async (req, res) => {
  try {
    const rel = String(req.query.path || "");
    const p = safePath(req.params.name, rel);
    if (!p) { res.status(400).json({ error: "bad path" }); return; }
    const ext = p.slice(p.lastIndexOf(".")).toLowerCase();
    if (!TEXT_EXT.has(ext)) { res.status(400).json({ error: "extension not in text whitelist" }); return; }
    const content = await readFile(p, "utf-8");
    res.json({ content });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

// raw 预览白名单：图片 + pdf + html（html 带 sandbox CSP，脚本不能访问控制台页面）
const RAW_MEDIA_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
};
const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;

// GET /api/requirements/:name/raw?path= — 图片 / PDF / HTML 二进制（预览用）
router.get("/api/requirements/:name/raw", async (req, res) => {
  try {
    const rel = String(req.query.path || "");
    const p = safePath(req.params.name, rel);
    if (!p) { res.status(400).json({ error: "bad path" }); return; }
    const ext = p.slice(p.lastIndexOf(".")).toLowerCase();
    const contentType = RAW_MEDIA_TYPES[ext];
    if (!contentType) { res.status(400).json({ error: "Unsupported media type" }); return; }
    const fileStat = await stat(p);
    if (fileStat.size > MAX_PREVIEW_BYTES) { res.status(413).json({ error: "file too large to preview" }); return; }
    const content = await readFile(p);
    if (ext === ".html" || ext === ".htm") {
      res.setHeader("Content-Security-Policy", "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:;");
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
    const filename = rel.split("/").pop() || "preview";
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.type(contentType).send(content);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

// GET /api/requirements/:name/sheet?path= — xlsx 转成单元格文本（只读预览）
router.get("/api/requirements/:name/sheet", async (req, res) => {
  try {
    const rel = String(req.query.path || "");
    const p = safePath(req.params.name, rel);
    if (!p) { res.status(400).json({ error: "bad path" }); return; }
    if (!p.toLowerCase().endsWith(".xlsx")) { res.status(400).json({ error: "only .xlsx" }); return; }
    const fileStat = await stat(p);
    if (fileStat.size > MAX_PREVIEW_BYTES) { res.status(413).json({ error: "file too large to preview" }); return; }
    const sheets = previewXlsx(await readFile(p));
    res.json({ sheets });
  } catch {
    res.status(400).json({ error: "无法解析表格" });
  }
});

// GET /api/requirements/:name/history/:filename — 历史版本内容（仅 _state/history/ 顶层 .md）
router.get("/api/requirements/:name/history/:filename", async (req, res) => {
  try {
    const { name, filename } = req.params;
    if (filename.includes("/") || filename.includes("..") || !filename.endsWith(".md")) {
      res.status(400).json({ error: "Invalid filename" }); return;
    }
    const p = join(reqDirOf(name), "_state", "history", filename);
    if (!p.startsWith(join(reqDirOf(name), "_state", "history"))) { res.status(400).json({ error: "bad path" }); return; }
    const content = await readFile(p, "utf-8");
    res.json({ content });
  } catch {
    res.status(404).json({ error: "History file not found" });
  }
});

// GET /api/requirements/:name/decisions/raw — 决策原文（client parseDecisions 消费；数组端点 /decisions 不动 H04）
router.get("/api/requirements/:name/decisions/raw", async (req, res) => {
  try {
    const p = join(reqDirOf(req.params.name), "_state", "decisions.md");
    const content = await readFile(p, "utf-8").catch(() => "");
    if (!content) { res.status(404).json({ error: "Decisions file not found" }); return; }
    const fileStat = await stat(p).catch(() => null);
    res.json({ content, modified: fileStat?.mtime.toISOString() ?? "" });
  } catch {
    res.status(500).json({ error: "Failed to read decisions" });
  }
});

export default router;
