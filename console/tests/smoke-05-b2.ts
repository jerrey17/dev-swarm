// tests/smoke-05-b2.ts — B2 六端点冒烟（临时实例 127.0.0.1:4601，不触碰运行中的 console）
import express from "express";
import configFilesRouter from "../server/config-files.js";
import knowledgeRouter from "../server/knowledge.js";

const app = express();
app.use(configFilesRouter);
app.use(knowledgeRouter);

const CASES: [string, string, number][] = [
  ["/api/config/files", "源索引", 200],
  ["/api/config/file/dev-swarm", "L2 原文（target 行须掩码）", 200],
  ["/api/config/file/defaults", "L1 原文", 200],
  ["/api/config/file/profile-toolchain", "profile 全文含 gates", 200],
  ["/api/config/file/spec-commit", "SPEC md", 200],
  ["/api/config/file/hook-pre-push", "hooks sh", 200],
  ["/api/config/file/console-example", "example", 200],
  ["/api/config/file/console-runtime", "真值掩码 kv", 200],
  ["/api/config/file/merge", "合并视图 JSON", 200],
  ["/api/config/file/override", "override 机制", 200],
  ["/api/config/file/link-pipeline", "跳转项", 200],
  ["/api/config/file/nope", "白名单外 404", 404],
  ["/api/knowledge/roots", "knowledge 解析", 200],
  ["/api/knowledge/tree?root=default", "顶层树", 200],
  ["/api/knowledge/tree?root=default&path=base_specifications", "二层树", 200],
  ["/api/knowledge/tree?root=default&path=contract", "三层树", 200],
  ["/api/knowledge/file?root=default&path=_INDEX.md", "md 文件", 200],
  ["/api/knowledge/file?root=default&path=../secret.md", "穿越 400", 400],
  ["/api/knowledge/file?root=default&path=_INDEX.md.png", "非 md 400", 400],
  ["/api/knowledge/tree?root=nope", "未知 root 400", 400],
];

const server = app.listen(4601, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:4601";
  let fail = 0;
  for (const [path, label, want] of CASES) {
    try {
      const r = await fetch(base + path);
      const body = await r.text();
      const ok = r.status === want;
      if (!ok) fail++;
      const head = body.slice(0, 100).replace(/\n/g, "⏎");
      console.log(`${ok ? "✅" : "❌"} [${r.status}] ${label} ${path} → ${head}`);
    } catch (e) {
      fail++;
      console.log(`❌ ERR ${label} ${path} → ${(e as Error).message}`);
    }
  }
  // 定点断言：掩码命中（解析 JSON 后查 content，规避转义误判）
  const dev = JSON.parse(await (await fetch(base + "/api/config/file/dev-swarm")).text());
  console.log(dev.content.includes('target: "***"') ? "✅ dev-swarm target 键掩码命中（行内 flow）" : "❌ target 未掩码");
  const run = JSON.parse(await (await fetch(base + "/api/config/file/console-runtime")).text());
  console.log(run.content.includes("webhookUrl: ***") || run.content.includes("webhookUrl: （未配置）") ? "✅ 运行真值 webhookUrl 掩码" : "❌ webhookUrl 未掩码");
  const tree = await (await fetch(base + "/api/knowledge/tree?root=default")).json();
  console.log(JSON.stringify(tree.entries?.map((e: any) => `${e.isDir ? "d" : "f"}:${e.name}${e.noDrill ? "(灰)" : ""}`)) ?? "❌");
  console.log(fail === 0 ? "ALL PASS" : `FAIL=${fail}`);
  server.close();
});
