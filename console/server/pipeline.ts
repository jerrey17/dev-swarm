// pipeline.ts — F11c（03 v2 §3.2/§3.4/B4 闭合）：流程定义端点
// 数据根=工具仓（join(ROOT,"..")，与现网 B-03 同根同理由：dataClone 的 skill 快照可为空，不能当来源）
import { Router } from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { ROOT } from "./config.js";

const TOOL_ROOT = join(ROOT, "..");
const router = Router();

interface StageSpec { order: number; name: string; agent: string; gate: string; gateSource: "advance_gates" | "repo"; skillName: string }
interface SubnodeSpec { name: string; agent: string }

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// F07（D005）+ profile场景定制：读 profile 文件（advance_gates 推进门禁 + phases 链）；文件不存在返回 null（用于参数校验）
function loadProfileCfg(profile: string): { phases?: string[]; advance_gates: Record<string, string> } | null {
  const p = join(TOOL_ROOT, "skill", "pipeline", `${profile}.yaml`);
  if (!existsSync(p)) return null;
  try {
    const cfg = (yaml.load(readFileSync(p, "utf-8")) as Record<string, any>) ?? {};
    return {
      phases: Array.isArray(cfg?.phases) ? (cfg.phases as unknown[]).map(String) : undefined,
      advance_gates: (cfg.advance_gates ?? {}) as Record<string, string>,
    };
  } catch {
    return { advance_gates: {} };
  }
}

function loadNodes(profileParam?: string): { stages: StageSpec[]; subnodes: SubnodeSpec[]; profile: string; librarySkillNames: string[] } | null {
  const p = join(TOOL_ROOT, "dev-swarm.yaml");
  if (!existsSync(p)) return null;
  try {
    const cfg = (yaml.load(readFileSync(p, "utf-8")) as Record<string, any>) ?? {};
    const profile = profileParam || String(cfg.pipeline?.profile ?? "toolchain");
    const prof = loadProfileCfg(profile); // 路由层已 400 未知 profile；此处 null→全库兜底
    const adv = prof?.advance_gates ?? {};
    const stagesRaw = (cfg.nodes?.stages ?? {}) as Record<string, { order?: number; agent?: string; gate?: string }>;
    const libOrder = (name: string, spec: { order?: number }, fallback: number): number => {
      const o = Number(spec?.order);
      return Number.isFinite(o) && o > 0 ? o : fallback;
    };
    // B1/F03：order=库编号（spec.order，不再用数组下标）；链=profile phases 子集+顺序（缺 phases→全库按库序）
    const libEntries = Object.entries(stagesRaw);
    const seq: Array<[string, { order?: number; agent?: string; gate?: string }]> =
      prof?.phases?.length
        ? (prof.phases.map((n) => [n, stagesRaw[n]]).filter((e): e is [string, { order?: number; agent?: string; gate?: string }] => Boolean(e[1])))
        : libEntries;
    const stages: StageSpec[] = seq.map(([name, spec], i) => {
      const order = libOrder(name, spec, i + 1);
      const advGate = adv[name];
      const g = String(advGate ?? spec?.gate ?? "");
      return {
        order, name,
        agent: String(spec?.agent ?? ""),
        gate: g === "" ? "human" : g, // advance_gates 优先，仓级 gate 兜底；解析为空=human（渲染安全默认，03 §3.9）
        gateSource: advGate ? ("advance_gates" as const) : ("repo" as const),
        skillName: `${pad2(order)}-${name}`, // 不含 .md，与 skill/:name 逐字相同；编号=库编号
      };
    });
    const subnodesRaw = (cfg.nodes?.subnodes ?? {}) as Record<string, { agent?: string }>;
    const subnodes: SubnodeSpec[] = Object.entries(subnodesRaw).map(([name, spec]) => ({
      name, agent: String(spec?.agent ?? ""),
    }));
    const librarySkillNames = libEntries.map(([name, spec], i) => `${pad2(libOrder(name, spec, i + 1))}-${name}`);
    return { stages, subnodes, profile, librarySkillNames };
  } catch {
    return null;
  }
}

// 操作卡白名单（X02）：阶段库全集卡（01~13）+ agent-contract；均为文件名去 .md 形式
function skillWhitelist(librarySkillNames: string[]): Set<string> {
  return new Set([...librarySkillNames, "agent-contract"]);
}

// 流程图（mermaid；标签含 · 与空格，统一双引号包裹）
function generateFlowchart(stages: StageSpec[]): string {
  const lines = [
    "graph LR",
    "  classDef phase fill:#3b82f6,stroke:#2563eb,color:#fff",
    "  classDef autoPhase fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-dasharray:5 5",
  ];
  for (const s of stages) {
    const label = `${pad2(s.order)} ${s.name}<br/>${s.agent} · ${s.gate}`;
    lines.push(`  P${s.order}("${label}"):::${s.gate === "auto" ? "autoPhase" : "phase"}`);
  }
  for (let i = 0; i < stages.length - 1; i++) {
    lines.push(`  P${stages[i].order} --> P${stages[i + 1].order}`);
  }
  return lines.join("\n");
}

// GET /api/pipeline/overview — 阶段表（含 skillName）+ subnodes + mermaid
// ?profile=（F07/D005）：按需求 profile 解析推进门禁（advance_gates 优先，仓级 gate 兜底）；缺省=仓级 pipeline.profile
router.get("/api/pipeline/overview", (req, res) => {
  const profileParam = typeof req.query.profile === "string" && req.query.profile ? req.query.profile : undefined;
  if (profileParam && !existsSync(join(TOOL_ROOT, "skill", "pipeline", `${profileParam}.yaml`))) {
    res.status(400).json({ error: `unknown profile "${profileParam}"` });
    return;
  }
  const loaded = loadNodes(profileParam);
  if (!loaded) { res.status(500).json({ error: "dev-swarm.yaml not readable in tool repo" }); return; }
  res.json({
    stages: loaded.stages,
    subnodes: loaded.subnodes,
    flowchartMermaid: generateFlowchart(loaded.stages),
    profile: loaded.profile,
    source: `dev-swarm.yaml + advance_gates(${loaded.profile})`,
  });
});

// GET /api/pipeline/skill/:name — 操作卡/协议内容（白名单精确匹配，服务端拼 .md）
router.get("/api/pipeline/skill/:name", (req, res) => {
  const loaded = loadNodes();
  if (!loaded) { res.status(500).json({ error: "dev-swarm.yaml not readable in tool repo" }); return; }
  const whitelist = skillWhitelist(loaded.librarySkillNames);
  const name = req.params.name;
  if (!whitelist.has(name)) { res.status(404).json({ error: "Skill not in whitelist" }); return; }

  const rel = name === "agent-contract"
    ? join("skill", "protocol", "agent-contract.md")
    : join("skill", "pipeline", "ops", `${name}.md`);
  const p = join(TOOL_ROOT, rel);
  if (!existsSync(p)) { res.status(404).json({ error: `Skill "${name}" not found` }); return; }
  try {
    res.json({ name, content: readFileSync(p, "utf-8") });
  } catch {
    res.status(500).json({ error: "Failed to read skill" });
  }
});

export default router;
