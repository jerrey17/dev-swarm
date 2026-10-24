// 三级配置 deep-merge + 逐键来源标注 + 敏感键掩码（配置视图数据源）
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { listRequirements } from "./parser.js";

type Obj = Record<string, unknown>;
const SENSITIVE = /secret|token|password|webhook|target/i;

function load(p: string): Obj {
  if (!existsSync(p)) return {};
  try { return (yaml.load(readFileSync(p, "utf-8")) as Obj) || {}; } catch { return {}; }
}

function isObj(v: unknown): v is Obj { return typeof v === "object" && v !== null && !Array.isArray(v); }

function mergeWithSource(base: Obj, override: Obj, src: string, acc: Obj, srcAcc: Obj): void {
  for (const k of Object.keys(override)) {
    const v = override[k];
    if (isObj(v) && isObj(base[k])) {
      if (!isObj(acc[k])) acc[k] = {};
      if (!isObj(srcAcc[k])) srcAcc[k] = {};
      mergeWithSource(base[k] as Obj, v, src, acc[k] as Obj, srcAcc[k] as Obj);
    } else {
      acc[k] = v; srcAcc[k] = src;
    }
  }
}

function mask(value: unknown, key = ""): unknown {
  if (typeof value === "string" && (SENSITIVE.test(key) || /qyapi\.weixin\.qq\.com|\/webhook\/.+key=/.test(value))) return "***";
  if (isObj(value)) { const o: Obj = {}; for (const k of Object.keys(value)) o[k] = mask(value[k], k); return o; }
  if (Array.isArray(value)) return value.map(v => mask(v));
  return value;
}

export function effectiveConfig(repoRoot: string) {
  const defaults = load(join(repoRoot, "skill", "config", "defaults.yaml"));
  const repo = load(join(repoRoot, "dev-swarm.yaml"));
  const effective: Obj = JSON.parse(JSON.stringify(defaults));
  const sources: Obj = {};
  mergeWithSource(defaults, repo, "repo", effective, sources);
  const overrides: { req: string; keys: string[] }[] = [];
  for (const req of listRequirements(repoRoot)) {
    const ov = load(join(repoRoot, "workspace", req, "_state", "override.yaml"));
    if (Object.keys(ov).length === 0) continue;
    const keys: string[] = [];
    (function collect(o: Obj, prefix = "") { for (const k of Object.keys(o)) { const p = prefix ? `${prefix}.${k}` : k; isObj(o[k]) ? collect(o[k] as Obj, p) : keys.push(p); } })(ov);
    overrides.push({ req, keys });
  }
  // CR-002：effective 只反映 defaults+repo（仓级生效配置）；需求覆盖不互相污染，留在 overrides 列表按需求展示
  return { effective: mask(effective) as Obj, sources, overrides };
}
