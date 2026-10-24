// tests/unit-07.ts — 07 单元测试（零依赖：tsx 可执行脚本，沿用仓内 tests/ 惯例，03 §八 零新增依赖优先于 §十 vitest 字样）
// 覆盖：maskText 掩码精度 / knowledge safePath 防穿越与 NO_DRILL / config 白名单 id 全集（H02，经临时实例）
import express from "express";
import { maskText } from "../server/config-files.js";
import { safePath, NO_DRILL } from "../server/knowledge.js";
import configFilesRouter from "../server/config-files.js";

let fail = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} ${label}${ok ? "" : ` → got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
}

// ── maskText（X07 + 04 S6：值模式 + 键名行首/行内 flow 两层）──
eq("锚定键行掩码", maskText('target: "https://x"'), 'target: "***"');
eq("行内 flow 键掩码（B2 实证缺陷回归）", maskText('reverify: { channel: qiwei-webhook, target: "{webhook-url}" }'), 'reverify: { channel: qiwei-webhook, target: "***" }');
eq("webhookUrl 键掩码", maskText("webhookUrl: abc123"), 'webhookUrl: "***"');
eq("secret 键掩码", maskText("  client_secret: s3cr3t"), '  client_secret: "***"');
eq("值模式 URL 掩码", maskText("见 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=kkk"), "见 ***");
eq("值模式 /webhook/ 掩码", maskText("path /webhook/abc123 end"), "path *** end");
eq("非敏感行不动", maskText("port: 4600"), "port: 4600");
eq("已掩码幂等", maskText('target: "***"'), 'target: "***"');
eq("md 散文正常段落不动", maskText("# 标题\n\n正文 port 与 channel 无敏感。"), "# 标题\n\n正文 port 与 channel 无敏感。");
eq("多行混合只掩该掩的", maskText("a: 1\ntoken: t1\nb: 2"), 'a: 1\ntoken: "***"\nb: 2');

// ── safePath（03 §5.3.2：resolve 后必须仍在根内）──
const ROOT = "/tmp/kb-root";
eq("根本身合法（rel 为空）", safePath(ROOT, ""), ROOT);
eq("子目录合法", safePath(ROOT, "a/b.md"), `${ROOT}/a/b.md`);
eq("穿越拒绝", safePath(ROOT, "../secret.md"), null);
eq("多层穿越拒绝", safePath(ROOT, "a/../../escape"), null);
eq("NUL 拒绝", safePath(ROOT, "a\0b"), null);

// ── NO_DRILL（H06，严于源）──
eq("gitnexus_repos 在置灰集", NO_DRILL.has("gitnexus_repos"), true);
eq("普通目录不在置灰集", NO_DRILL.has("sms"), false);

// ── H02 白名单 id 全集（临时实例，模式同 smoke-05-b2）──
const app = express();
app.use(configFilesRouter);
const server = app.listen(4603, "127.0.0.1", async () => {
  const j = await (await fetch("http://127.0.0.1:4603/api/config/files")).json();
  const ids = j.categories.flatMap((c: any) => c.files.map((f: any) => f.id)).sort();
  const want = [
    "console-example", "console-runtime", "defaults", "dev-swarm", "hook-pre-push", "hook-setup",
    "link-pipeline", "merge", "override", "profile-data-script", "profile-java-business",
    "profile-toolchain", "spec-change", "spec-commit", "spec-dirs", "spec-mask",
  ].sort();
  eq("白名单 id 全集=16（H02 对照 03 §5.4）", JSON.stringify(ids), JSON.stringify(want));
  const kinds = j.categories.flatMap((c: any) => c.files.map((f: any) => f.kind));
  eq("link 类型恰 1 项", kinds.filter((k: string) => k === "link").length, 1);
  console.log(fail === 0 ? "ALL PASS" : `FAIL=${fail}`);
  server.close();
  process.exit(fail === 0 ? 0 : 1);
});
