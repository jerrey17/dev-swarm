// knowledge.ts — F06（03 §5.2/§三 X05/D002）：知识库端点
// 数据根=工具仓 dev-swarm.yaml knowledge[].ref（仅 type=local-path 可浏览）；全 GET 只读；路径防穿越
import { Router } from "express";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import { ROOT } from "./config.js";

const TOOL_ROOT = join(ROOT, "..");
export const NO_DRILL = new Set(["gitnexus_repos"]); // H06：置灰不下钻（严于源，04 S2）
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]);

interface KnowledgeEntry { project: string; type: string; ref?: string }

function loadKnowledge(): KnowledgeEntry[] {
  try {
    const cfg = yaml.load(readFileSync(join(TOOL_ROOT, "dev-swarm.yaml"), "utf-8")) as Record<string, unknown>;
    return Array.isArray(cfg?.knowledge) ? (cfg.knowledge as KnowledgeEntry[]) : [];
  } catch { return []; }
}

function rootOf(project: string): string | null {
  const e = loadKnowledge().find(k => k?.project === project);
  if (!e || e.type !== "local-path" || !e.ref) return null;
  const root = resolve(e.ref);
  if (!existsSync(root) || !statSync(root).isDirectory()) return null;
  return root;
}

// 防穿越：resolve 结果必须仍在数据根内（rel='' 时等于根本身，合法）
export function safePath(root: string, rel: string): string | null {
  if (rel.includes("\0")) return null;
  const p = resolve(root, rel);
  if (p !== root && !p.startsWith(root + "/")) return null;
  return p;
}

const router = Router();

// GET /api/knowledge/roots — knowledge 配置解析（X05：非 local-path 列出但 browsable:false）
router.get("/api/knowledge/roots", (_req, res) => {
  res.json({
    entries: loadKnowledge().map(e => ({
      project: String(e?.project ?? ""),
      type: String(e?.type ?? ""),
      ref: e?.ref ? String(e.ref) : "",
      browsable: Boolean(e && e.type === "local-path" && e.ref && rootOf(String(e.project))),
    })),
  });
});

// GET /api/knowledge/tree?root=&path= — 单层目录（仅 .md 与目录；点文件隐藏；gitnexus_repos 置灰）
router.get("/api/knowledge/tree", (req, res) => {
  const project = String(req.query.root || "");
  const rel = String(req.query.path || "");
  const root = rootOf(project);
  if (!root) { res.status(400).json({ error: `knowledge root "${project}" 不存在或不可浏览（仅 local-path）` }); return; }
  const dir = safePath(root, rel);
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) { res.status(400).json({ error: "bad path" }); return; }

  const out: { name: string; path: string; isDir: boolean; hasMd: boolean; noDrill?: boolean }[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    if (ent.isDirectory()) {
      const child = join(dir, ent.name);
      const hasMd = readdirSync(child, { withFileTypes: true }).some(f => !f.name.startsWith(".") && f.isFile() && f.name.endsWith(".md"));
      out.push({ name: ent.name, path: rel ? `${rel}/${ent.name}` : ent.name, isDir: true, hasMd, noDrill: NO_DRILL.has(ent.name) });
    } else if (ent.isFile() && ent.name.endsWith(".md")) {
      out.push({ name: ent.name, path: rel ? `${rel}/${ent.name}` : ent.name, isDir: false, hasMd: true });
    }
  }
  out.sort((a, b) => (Number(b.isDir) - Number(a.isDir)) || a.name.localeCompare(b.name));
  res.json({ entries: out });
});

// GET /api/knowledge/file?root=&path= — md 文本（仅 .md 白名单）
router.get("/api/knowledge/file", (req, res) => {
  const project = String(req.query.root || "");
  const rel = String(req.query.path || "");
  const root = rootOf(project);
  if (!root) { res.status(400).json({ error: `knowledge root "${project}" 不存在或不可浏览` }); return; }
  const p = safePath(root, rel);
  if (!p || !p.endsWith(".md") || !existsSync(p) || !statSync(p).isFile()) { res.status(400).json({ error: "bad path（仅 .md）" }); return; }
  try { res.json({ content: readFileSync(p, "utf-8") }); }
  catch { res.status(500).json({ error: "read failed" }); }
});

// GET /api/knowledge/image?root=&path= — 图片二进制（扩展名白名单）
router.get("/api/knowledge/image", (req, res) => {
  const project = String(req.query.root || "");
  const rel = String(req.query.path || "");
  const root = rootOf(project);
  if (!root) { res.status(400).json({ error: `knowledge root "${project}" 不存在或不可浏览` }); return; }
  const p = safePath(root, rel);
  const ext = p ? p.slice(p.lastIndexOf(".")).toLowerCase() : "";
  if (!p || !IMAGE_EXT.has(ext) || !existsSync(p) || !statSync(p).isFile()) { res.status(400).json({ error: "bad path（仅图片白名单）" }); return; }
  res.type(ext).send(readFileSync(p));
});

export default router;
