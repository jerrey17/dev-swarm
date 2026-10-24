---
id: BUG-000
status: 待确认
updated_at: "2026-10-03T16:00:00+08:00"
---

# status.md — 仅当前状态（一次一跃迁；跃迁史在 log.md）

- status 六词：待确认 / 待修复 / 已修复待验 / 已验证 / 已关闭 / 作废（agent-contract §3）
- 跃迁权限：「待修复 ↔ 已修复待验」归开发 agent；「已修复待验 → 已验证/打回」归复验 agent
- 开发 agent 写「已验证」= 违规，pre-push 门禁直接拒绝（check_status_push.py）
- 本文件变更必须与 bug/INDEX.md 同一次提交
