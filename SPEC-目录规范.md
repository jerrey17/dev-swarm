# SPEC-目录规范

> 全体 agent 强制遵守。依据：dev-swarm 技术方案总览 V1.7 §5。

## 1. workspace/ 一级 = 需求名

- 一级目录为**需求名**（全局唯一，命名=需求标题简短中文，创建前查重）
- 跨项目需求**不拆分**：涉改服务全列在需求内 `services.yaml`，不按项目分层

## 2. 需求目录固定子结构

```text
workspace/{需求名}/
├── services.yaml           需求级服务配置（进需求必读，按 local_path 定位代码；顶层可选 kind 声明 profile 场景）
├── {NN}-{阶段名}.md        阶段产物——**按需求冻结链产出，文件编号=阶段库编号（01~13）**：
│                             java-business 12 件（01~12 全）/ toolchain 9 件（01/03/04/05/06/07/09/11/12）/
│                             data-script 7 件（01/03/04/13/09/11/12）——链上没有的阶段不出文件（在途需求按其建项链）
├── 13-脚本/                data-script 链「编写脚本和验证脚本」产物（forward.sql/rollback.sql/verify.sql/README.md 四件套）
├── attachments/            附件
├── _state/                 状态目录
│   ├── current.md          总控（frontmatter schema 2：phase/node/next/blockers/terminal）
│   ├── decisions.md        关键决策记录
│   ├── override.yaml       需求级配置覆盖（三级分层第 3 级，可选）
│   └── history/            方案重写归档
├── bug/
│   ├── INDEX.md            bug 索引（与 status.md 同次提交）
│   └── BUG-{NNN}/
│       ├── status.md       状态小文件（仅当前状态，一次一跃迁；跃迁史在 log.md）
│       └── log.md          处理记录（append-only，每行带 agent id + 实证/推断标注）
└── reverify.md             待复验列表（开工信号：单号/仓库/commit/实例/复验点）
```

## 3. 强制约束

- **`_state/` 命名不可改**：不命中旧体系扫描模式 `**/.claude/workflow/*/current.md`，是过渡期隔离（总览 §8.7 ②）的组成部分
- **engine/ 已取消**：协议/配置/门禁在 `skill/` 下同仓直引，禁止在别处建副本
- 需求终态后目录**原地保留**（退役不迁移）
- services.yaml 的 `role` 枚举：`主责 | 协同 | 参考`
