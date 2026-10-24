// console 本地配置（.local-state/console.config.yaml，gitignore，真值不入库）
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export interface ConsoleConfig {
  dataClone: string;            // 独立 clone 路径（禁止指向 agent 工作区）
  pollIntervalSeconds: number;
  webhookUrl: string;           // 企微群机器人
  port: number;
}

const DEFAULTS: ConsoleConfig = {
  dataClone: "./dev-swarm-data",
  pollIntervalSeconds: 30,
  webhookUrl: "",
  port: 4600,
};

export function loadConfig(): ConsoleConfig {
  const p = join(ROOT, ".local-state", "console.config.yaml");
  if (!existsSync(p)) return { ...DEFAULTS };
  const parsed = yaml.load(readFileSync(p, "utf-8")) as Partial<ConsoleConfig> | undefined;
  return { ...DEFAULTS, ...(parsed || {}) };
}

export { ROOT };
