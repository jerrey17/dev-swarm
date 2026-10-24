// 一致性检测：INDEX vs status.md（阻塞视图数据源之一）
import { parseIndex, parseStatus, listRequirements, Current } from "./parser.js";

export interface Blockage { req: string; type: string; detail: string; }

export function detectBlockages(repoRoot: string, currents: Map<string, Current | null>): Blockage[] {
  const out: Blockage[] = [];
  for (const req of listRequirements(repoRoot)) {
    const cur = currents.get(req) || null;
    if (cur?.terminal) continue;
    for (const b of cur?.blockers || []) out.push({ req, type: "blockers", detail: b });
    const status = parseStatus(repoRoot, req);
    const index = parseIndex(repoRoot, req);
    for (const [id, st] of status) {
      const idx = index.get(id);
      if (idx === undefined) out.push({ req, type: "索引不一致", detail: `INDEX 缺行: ${id}` });
      else if (idx !== st) out.push({ req, type: "索引不一致", detail: `${id}: INDEX=${idx} status=${st}` });
    }
    // 反向：INDEX 有行但 status.md 缺失（目录被删/未建）
    for (const [id] of index) {
      if (!status.has(id)) out.push({ req, type: "索引不一致", detail: `INDEX 多行/缺 status.md: ${id}` });
    }
  }
  return out;
}
