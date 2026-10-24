// config-files.ts — F01（03 §5.2/§5.4/D002 X03/X07）：配置中心端点
// 白名单 id→工具仓相对路径硬编码（无目录遍历）；全部原文经敏感值掩码后返回
import { Router } from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./config.js";
import { loadConfig } from "./config.js";
import { effectiveConfig } from "./config-merge.js";

const TOOL_ROOT = join(ROOT, "..");

type FileKind = "yaml" | "md" | "sh" | "merge" | "override" | "console-runtime" | "link";
interface FileSpec { id: string; label: string; kind: FileKind; rel?: string }

const CATEGORIES: { id: string; label: string; files: FileSpec[] }[] = [
  {
    id: "three-level", label: "三级配置", files: [
      { id: "defaults", label: "L1 默认 defaults.yaml", kind: "yaml", rel: "skill/config/defaults.yaml" },
      { id: "dev-swarm", label: "L2 仓级 dev-swarm.yaml", kind: "yaml", rel: "dev-swarm.yaml" },
      { id: "merge", label: "三级合并视图（effective + 来源）", kind: "merge" },
      { id: "override", label: "L3 工作空间覆盖 override", kind: "override" },
    ],
  },
  {
    id: "profiles", label: "流程 profile", files: [
      { id: "profile-toolchain", label: "toolchain.yaml", kind: "yaml", rel: "skill/pipeline/toolchain.yaml" },
      { id: "profile-java-business", label: "java-business.yaml", kind: "yaml", rel: "skill/pipeline/java-business.yaml" },
      { id: "profile-data-script", label: "data-script.yaml", kind: "yaml", rel: "skill/pipeline/data-script.yaml" },
    ],
  },
  {
    id: "specs", label: "规范 SPEC", files: [
      { id: "spec-change", label: "SPEC-变更流程.md", kind: "md", rel: "SPEC-变更流程.md" },
      { id: "spec-dirs", label: "SPEC-目录规范.md", kind: "md", rel: "SPEC-目录规范.md" },
      { id: "spec-commit", label: "SPEC-提交规约.md", kind: "md", rel: "SPEC-提交规约.md" },
      { id: "spec-mask", label: "SPEC-脱敏红线.md", kind: "md", rel: "SPEC-脱敏红线.md" },
    ],
  },
  {
    id: "hooks", label: "hooks", files: [
      { id: "hook-pre-push", label: "pre-push", kind: "sh", rel: "hooks/pre-push" },
      { id: "hook-setup", label: "setup.sh", kind: "sh", rel: "hooks/setup.sh" },
    ],
  },
  {
    id: "console", label: "console 运行配置", files: [
      { id: "console-example", label: "console.config.example.yaml", kind: "yaml", rel: "console/.local-state/console.config.example.yaml" },
      { id: "console-runtime", label: "运行真值（掩码 kv）", kind: "console-runtime" },
    ],
  },
  {
    id: "docs", label: "流程文档（跳流程定义页）", files: [
      { id: "link-pipeline", label: "操作卡 13 张 + agent-contract", kind: "link" },
    ],
  },
];

const ALL_FILES = new Map<string, FileSpec>(CATEGORIES.flatMap(c => c.files).map(f => [f.id, f]));

// 敏感掩码（X07 + 04 S6 两层：值模式 + 键名模式（行首与行内 flow 均覆盖），与 config-merge.ts mask() 同源口径）
const VALUE_PATTERNS = [/(\w+:\/\/)?qyapi\.weixin\.qq\.com[^\s"'`，。；）\]]*/g, /\S*\/webhook\/\S+/g];
const SENSITIVE_KEY_INLINE = /([A-Za-z0-9_-]*(?:secret|token|password|webhook|target)[A-Za-z0-9_-]*\s*:\s*)("[^"]*"|'[^']*'|[^\s,}]+)/gi;

export function maskText(content: string): string {
  let out = content;
  for (const re of VALUE_PATTERNS) out = out.replace(re, "***");
  return out.replace(SENSITIVE_KEY_INLINE, '$1"***"');
}

function readMasked(rel: string): string | null {
  const p = join(TOOL_ROOT, rel);
  if (!existsSync(p)) return null;
  return maskText(readFileSync(p, "utf-8"));
}

const router = Router();

// GET /api/config/files — 配置源索引（不泄露 rel 路径）
router.get("/api/config/files", (_req, res) => {
  res.json({
    categories: CATEGORIES.map(c => ({
      id: c.id, label: c.label,
      files: c.files.map(f => ({ id: f.id, label: f.label, kind: f.kind })),
    })),
  });
});

// GET /api/config/file/:id — 白名单 id 精确匹配；真值 yaml 不回原文（H03/X07）
router.get("/api/config/file/:id", (req, res) => {
  const spec = ALL_FILES.get(req.params.id);
  if (!spec) { res.status(404).json({ error: "config id not in whitelist" }); return; }

  if (spec.kind === "link") {
    res.json({ id: spec.id, label: spec.label, kind: spec.kind, content: "操作卡与 agent-contract 在「流程定义」页查看（左侧导航 → 系统 → 流程定义）。" });
    return;
  }

  if (spec.kind === "merge") {
    const { effective, sources } = effectiveConfig(loadConfig().dataClone);
    res.json({ id: spec.id, label: spec.label, kind: spec.kind, content: JSON.stringify({ effective, sources }, null, 2) });
    return;
  }

  if (spec.kind === "override") {
    const { overrides } = effectiveConfig(loadConfig().dataClone);
    const lines = [
      "# L3 需求级覆盖机制",
      "",
      "- 机制：workspace/{需求名}/_state/override.yaml 深合并覆盖仓级配置（需求级 > 仓级 > 内置默认）",
      "- 生效范围：effective 只反映 L1+L2（需求覆盖不互相污染）；命中覆盖的键在下方逐需求列出",
      "- 当前列表：" + (overrides.length ? "" : "无（现存工作空间均无 override.yaml）"),
      ...overrides.map(o => `- ${o.req}：${o.keys.join("、")}`),
    ];
    res.json({ id: spec.id, label: spec.label, kind: spec.kind, content: lines.join("\n") });
    return;
  }

  if (spec.kind === "console-runtime") {
    const cfg = loadConfig();
    const example = readMasked("console/.local-state/console.config.example.yaml") ?? "# example 文件缺失";
    const truth = [
      "",
      "# ── 运行真值（console.config.yaml，仅掩码 kv，不回原文）──",
      `dataClone: ${cfg.dataClone}`,
      `pollIntervalSeconds: ${cfg.pollIntervalSeconds}`,
      `port: ${cfg.port}`,
      `webhookUrl: ${cfg.webhookUrl ? "***" : "（未配置）"}`,
      "# 内置默认 = server/config.ts DEFAULTS（代码常量，非文件配置）",
    ].join("\n");
    res.json({ id: spec.id, label: spec.label, kind: spec.kind, content: example + "\n" + truth });
    return;
  }

  const content = spec.rel ? readMasked(spec.rel) : null;
  if (content === null) { res.status(404).json({ error: `config file missing: ${spec.id}` }); return; }
  res.json({ id: spec.id, label: spec.label, kind: spec.kind, content });
});

export default router;
