# SPEC-脱敏红线

> 依据：dev-swarm 技术方案总览 V1.7（敏感信息分口径，用户拍板）。

## 分口径规则

| 类别 | 规则 | 检查 |
|------|------|------|
| 密码 / token / 连接串 / webhook URL | **绝不入库**：产物中用占位符（如 `{webhook-url}`）；真值写 `.secrets.local.yaml` 或 `console/.local-state/`（均 gitignore） | 提测前 grep 扫描（08-提测门禁）；git diff 审查 |
| 实例 IP / 端口 | 开工信号（reverify.md）必须带实例，但真实地址只留在本地 workspace；本仓库只用占位符 | — |
| 库名 / 表结构 / 报文 / 日志片段 | 只留在本地 workspace，不进入本框架仓库 | — |

## 依据与边界

- 密码类一旦进入 git 历史就不可挽回（**git 历史不可擦除**）
- 开工信号里的实例地址下一个 agent 必须看得到；文档和测试只用占位地址（如 `10.0.0.8:8080`），真实地址只留在本地 workspace
- 掩码键约定（console 配置视图）：键名含 `secret / token / password / webhook` 的值显示为 `***`

## 违规处置

发现密码/token 已入库：立即通知 human；不做 force-push 擦历史（破坏审计），走凭据轮换。
