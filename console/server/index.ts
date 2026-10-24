// dev-swarm-console server：Express 5 + 独立 clone 轮询 + 五只读 API + 企微通知
import express from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, ROOT } from "./config.js";
import { listRequirements, parseCurrent, parseServices, parseLinks, parseReverify, parseDecisions, listHistory, computeReqFields, startedAtOf, Current } from "./parser.js";
import { detectBlockages } from "./consistency.js";
import { effectiveConfig } from "./config-merge.js";
import { notifyNewReverify } from "./notify.js";
import workspaceRouter from "./workspace.js";
import sessionsRouter from "./sessions.js";
import pipelineRouter from "./pipeline.js";
import configFilesRouter from "./config-files.js";
import knowledgeRouter from "./knowledge.js";
import authRouter, { authMiddleware } from "./auth.js";
import yaml from "js-yaml";

const exec = promisify(execFile);
const cfg = loadConfig();

if (!existsSync(cfg.dataClone) || !existsSync(join(cfg.dataClone, "dev-swarm.yaml"))) {
  console.error(`❌ dataClone 路径无效或不为 monorepo：${cfg.dataClone}（检查 console/.local-state/console.config.yaml）`);
  process.exit(1);
}

async function pull(): Promise<void> {
  try { await exec("git", ["-C", cfg.dataClone, "pull", "--ff-only"]); } catch (e) { console.error("[poll] pull 失败:", (e as Error).message); }
}

function scanAll(): Map<string, Current | null> {
  const m = new Map<string, Current | null>();
  for (const req of listRequirements(cfg.dataClone)) m.set(req, parseCurrent(cfg.dataClone, req));
  return m;
}

const app = express();
app.use((_req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); });
app.use(express.json()); // 05 B1：登录 POST 体解析（Express 内置；GET 无 JSON 体不受影响，H04）
app.use(authRouter); // 05 B1：登录族三端点（login/logout/session），authMiddleware 之前挂载=白名单天然豁免
app.use(authMiddleware); // 05 B1（H01/X07）：其余 /api/* 未登录一律 401；顺序敏感，必须在既有只读 routers 前
app.use(workspaceRouter); // F11a：workspace 树/file/raw/历史内容/决策原文（全 GET 只读）
app.use(sessionsRouter); // F11c：会话关联+messages 展开（home 只读）
app.use(pipelineRouter); // F11c：流程定义/操作卡（工具仓数据根）
app.use(configFilesRouter); // F01：配置中心源索引+文件内容（白名单 id+掩码，工具仓数据根）
app.use(knowledgeRouter); // F06：知识库 roots/tree/file/image（数据根=knowledge[].ref）

// ① 需求列表（B2 增量字段：X01/D002 计算字段——pipelinePhases、lastAction/todo、projectName、mainProject、format）
app.get("/api/requirements", (_req, res) => {
  const currents = scanAll();
  res.json([...currents.entries()].map(([name, c]) => {
    // B2-A（R1-P）：详情/列表序列=该需求冻结链（current.phases），不再活读 profile yaml
    const stages = c ? (c.phases || []).map(p => p.name) : undefined;
    // 09/BUG-002：外链单一存储——TAPD 芯片读 links 优先，正文 parseTapdUrl 仅未迁移需求只读回退
    const links = parseLinks(cfg.dataClone, name);
    return {
      name, phase: c?.phase, node: c?.node, next: c?.next, blockers: c?.blockers,
      profile: c?.profile, terminal: c?.terminal, updated_at: c?.updated_at,
      tapdUrl: links?.tapd?.url || c?.tapdUrl, // 04 B1 方案 L：列表白名单显式带出（详情侧靠 ...c）
      ...computeReqFields(cfg.dataClone, name, c, stages),
    };
  }).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")));
});

// ② 需求详情（冻结链阶段流 + services + 产物路径清单 + B2 增量计算字段含 startedAt）
app.get("/api/requirements/:name", (req, res) => {
  const c = parseCurrent(cfg.dataClone, req.params.name);
  if (!c) { res.status(404).json({ error: "not found" }); return; }
  // B2-A（R1-P）：stages=该需求 current.phases 冻结链（客户端据此补齐未到的灰段）；order=阶段库编号（B1）
  const stages = (c.phases || []).map(p => p.name);
  const reqDir = join(cfg.dataClone, "workspace", req.params.name);
  const artifacts = existsSync(reqDir)
    ? readdirSync(reqDir, { withFileTypes: true }).filter(f => f.isFile()).map(f => f.name).sort().map(f => `workspace/${req.params.name}/${f}`)
    : [];
  res.json({
    ...c, services: parseServices(cfg.dataClone, req.params.name), stages, artifacts,
    links: parseLinks(cfg.dataClone, req.params.name),  // F09/D003-v3：研发入口（缺失=undefined→前端全类目待办）
    tapdUrl: parseLinks(cfg.dataClone, req.params.name)?.tapd?.url || c.tapdUrl,  // 09/BUG-002：links 优先，正文回退
    ...computeReqFields(cfg.dataClone, req.params.name, c, stages),
    startedAt: startedAtOf(cfg.dataClone, req.params.name),
  });
});

// ③ 阻塞视图
app.get("/api/blockages", (_req, res) => { res.json(detectBlockages(cfg.dataClone, scanAll())); });

// ④ 待复验视图
app.get("/api/reverify", async (_req, res) => { res.json(parseReverify(cfg.dataClone)); });

// ⑤ 配置视图（三级合并 + 来源 + 掩码 + 整仓 tag/commit）
app.get("/api/config", async (_req, res) => {
  const { effective, sources, overrides } = effectiveConfig(cfg.dataClone);
  let tag = "", commit = "";
  try { tag = (await exec("git", ["-C", cfg.dataClone, "describe", "--tags"])).stdout.trim(); } catch { /* 无 tag */ }
  try { commit = (await exec("git", ["-C", cfg.dataClone, "rev-parse", "--short", "HEAD"])).stdout.trim(); } catch { /* */ }
  res.json({ effective, sources, repo: { tag, commit }, overrides });
});

// ⑥ 需求决策记录（F06 平移 claude-board /decisions；只读 dataClone）
app.get("/api/requirements/:name/decisions", (req, res) => {
  res.json(parseDecisions(cfg.dataClone, req.params.name));
});

// ⑦ 方案重写归档（F06 平移 claude-board /history；B2 增量 filename/version/modified——既有 file/mtime/size 不动 H04）
app.get("/api/requirements/:name/history", (req, res) => {
  res.json(listHistory(cfg.dataClone, req.params.name).map(h => {
    const vm = h.file.match(/-v(\d+)\.md$/);
    return { ...h, filename: h.file, version: vm ? parseInt(vm[1], 10) : 1, modified: h.mtime };
  }));
});

// ⑧ 阶段产物内容（F06 平移 claude-board /file；白名单=需求目录顶层 md/yaml，防路径穿越）
app.get("/api/requirements/:name/artifact", (req, res) => {
  const file = String(req.query.file || "");
  const reqDir = join(cfg.dataClone, "workspace", req.params.name);
  if (!existsSync(reqDir)) { res.status(404).json({ error: "requirement not found" }); return; }
  const top = new Set(readdirSync(reqDir, { withFileTypes: true }).filter(f => f.isFile()).map(f => f.name));
  if (!top.has(file) || !/\.(md|yaml)$/.test(file)) { res.status(400).json({ error: "file not in whitelist (top-level .md/.yaml only)" }); return; }
  const p = join(reqDir, file);
  if (!p.startsWith(reqDir)) { res.status(400).json({ error: "bad path" }); return; }
  try { res.json({ name: file, content: readFileSync(p, "utf-8") }); }
  catch { res.status(500).json({ error: "read failed" }); }
});

// ⑨ 配置总览（F06 平移 claude-board workflow-config/overview；nodes 定义读工具仓，掩码沿用 ⑤）
app.get("/api/config/overview", (_req, res) => {
  const { effective, sources, overrides } = effectiveConfig(cfg.dataClone);
  let nodes: unknown = null;
  try {
    nodes = (yaml.load(readFileSync(join(ROOT, "..", "dev-swarm.yaml"), "utf-8")) as Record<string, unknown>)?.nodes ?? null;
  } catch { /* 工具仓读取失败按 null */ }
  res.json({ effective, sources, overrides, nodes });
});

// 只绑回环地址（方案选型⑤：本地服务零网络暴露；无鉴权不得监听 0.0.0.0）
app.listen(cfg.port, "127.0.0.1", () => console.log(`✅ dev-swarm-console http://127.0.0.1:${cfg.port}（dataClone=${cfg.dataClone}，轮询 ${cfg.pollIntervalSeconds}s）`));

// 轮询：pull -> 检测新待复验 -> 通知
async function tick() {
  await pull();
  await notifyNewReverify(parseReverify(cfg.dataClone), cfg.webhookUrl);
}
void tick();
setInterval(tick, cfg.pollIntervalSeconds * 1000);
