# dev-swarm

多 agent 研发流程框架：引擎、协议、流水线与只读看板。需求工作区数据留在本地，不进入本仓库。

## 目录结构

```text
├── dev-swarm.yaml          仓级主配置（三级分层第 2 级）
├── SPEC-目录规范.md         需求目录结构规约（全体 agent 强制）
├── SPEC-提交规约.md         分路径提交与 push 边界（含 §8.9 Approved-by）
├── SPEC-脱敏红线.md         敏感信息分口径
├── hooks/                  pre-push（工具路径强制 Approved-by: human）+ setup.sh
├── skill/                  dev-swarm 引擎：adapters/ protocol/ pipeline/ config/ scripts/ tests/
├── console/                只读看板：client（Vite+React）+ server（Express，独立 clone 轮询）
└── workspace/{需求名}/      本地需求数据（不随本仓库分发）
```

## 快速开始

```bash
git clone https://github.com/jerrey17/dev-swarm.git
bash hooks/setup.sh        # 安装 pre-push 拦截（core.hooksPath=hooks）
```

- 全部 agent 开工前读物：`skill/protocol/agent-contract.md`（权限矩阵/台账三文件/开工信号）
- 回归：`bash skill/tests/run_all.sh`（四场景全绿为工具迭代前置）
- 看板：`cd console && npm install && npm run dev`（数据源配 `.local-state/console.config.yaml`）

## 规范索引

| 规范 | 内容 |
|------|------|
| 目录规范 | workspace/ 一级=需求名；固定子结构；`_state/` 命名承载隔离约束不可改 |
| 提交规约 | workspace/ 数据由负责 agent 自主提交；skill/ console/ 仓根为工具迭代，push 须 `Approved-by: human` |
| 脱敏红线 | 密码/token/连接串/webhook 绝不入库；真实实例地址只留在本地 workspace |
