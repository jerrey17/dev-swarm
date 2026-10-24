# skill/templates/ — 需求初始化模板（V2-R2）

> 初始化 = **复制 + 填空，禁止现场发明结构与字段**。
> 本目录是 workspace/{需求名}/ 下状态文件结构的单一来源（SPEC-目录规范 §2 的物化）。

## 初始化步骤（新需求建项时，由 cc-dev 执行）

1. `mkdir -p workspace/{需求名}/{attachments,_state/history,bug}`
2. 按下表复制模板并填空（`{占位符}` 全部替换后才算初始化完成）：

| 模板 | 复制到 | 填空要点 |
|------|--------|----------|
| `services.yaml` | `workspace/{需求名}/services.yaml` | 服务名/appid/local_path/role；跨项目需求不拆分，全列在此；顶层可选 `kind`（toolchain\|java-business\|data-script，建项显式声明，优先于规则推断） |
| `current.md` | `workspace/{需求名}/_state/current.md` | name=目录名；profile 按 **kind 优先 → 再 R1~R3 规则推断**（开好头原则：判不定推 human）；phases **逐项复制**该需求 profile 的 phases（名称+顺序=建项冻结链，B2-A） |
| `decisions.md` | `workspace/{需求名}/_state/decisions.md` | 删除注释模板节即可，首条决策随做随追加 |
| `bug-INDEX.md` | `workspace/{需求名}/bug/INDEX.md` | 空表即可 |
| `reverify.md` | `workspace/{需求名}/reverify.md` | 空表即可 |
| `bug-status.md` | `workspace/{需求名}/bug/BUG-{NNN}/status.md` | 立单时才复制；id/status 填实际值 |
| `bug-log.md` | `workspace/{需求名}/bug/BUG-{NNN}/log.md` | 立单时才复制；标题替换 BUG-000，首行=立单行（六要素） |

3. current.md 写后跑 PyYAML 校验；phases 用 block style，值禁 Markdown 标记、同键禁重复。

## 字段权威来源

| 模板 | 权威依据 |
|------|----------|
| current.md | console/server/parser.ts `Current`（schema 2）+ agent-contract §6 |
| services.yaml | console/server/parser.ts `Service` + SPEC-目录规范 §3（role 枚举） |
| bug-status.md | agent-contract §3/§4 + skill/scripts/check_status_push.py（`^status:` 行 + Agent trailer 校验） |
| bug-log.md | agent-contract §4（表列与类型枚举照抄） |
| bug-INDEX.md | agent/server parser.ts `parseIndex`（cells[1]=单号、cells[3]=状态）+ consistency.ts 双向校验 |
| reverify.md | agent-contract §5 + console/server/parser.ts `parseReverify`（9 数据列） |

## 禁止

- 列结构只允许随 agent-contract §5 **同版本变更**（禁单独增删列/改列序）、加第七个状态词、frontmatter 加自由文本键
- 修改本目录任一模板须 human 批准（工具路径，`Approved-by: human`）
