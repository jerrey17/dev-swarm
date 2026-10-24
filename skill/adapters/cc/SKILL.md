---
name: dev-swarm
description: dev-swarm 多 agent 研发流程编排（dev-workflow 替代者）。仅管理 dev-swarm-workspace monorepo 内 workspace/ 下的需求；触发词固定为 /dev-swarm、swarm 需求、swarm 进度。存量 .claude/workflow 下的需求归 dev-workflow 管，本 skill 拒接。禁止以「开始新需求」「继续开发」「查看开发进度」等宽泛词触发。
---

# dev-swarm — 多 agent 研发流程编排（CC 适配）

> 总控是 workspace 内 `current.md`，不是本 skill。CC 只是加载方式之一（agent-contract §1）。

## 不可变参数

```text
MONOREPO=<本仓库根目录>
CONFIG=$MONOREPO/dev-swarm.yaml
CONTRACT=$MONOREPO/skill/protocol/agent-contract.md
PROFILES=$MONOREPO/skill/pipeline/                          # java-business.yaml / toolchain.yaml
REQS=$MONOREPO/workspace/
```

## 开工校验（每次触发必做）

1. 读 `$CONFIG`（profile / agents / nodes）与目标需求 `$REQS/{需求名}/services.yaml`、`_state/current.md`
2. 校验 `next.agent == cc-dev` 且 `next.blockers` 为空——否则**拒绝开工**，报告归属（该谁干、卡在哪）
3. 读 `$CONTRACT` 本次节点权限行——只写允许清单内的文件
4. **隔离自检**：目标需求必须在 `$REQS` 下；`.claude/workflow/` 下的需求一律拒接（提示用 /dev-workflow）
5. **工作区自检**（目录隔离 ≠ 工作区隔离——多需求共享同一 git 工作区）：`python3 skill/scripts/check_workspace.py workspace {需求名}`
   - ERROR=他需求脏区（E-dirty）→ **拒开**：本需求默认进 worktree（见 ops/05；F05：他需求脏区时第二需求开工的默认路径）或先让其收口；**禁止 reset 清盘**
   - BLOCK=profile 口径不一致或判不定（B-profile，F06 R1~R3）→ 停，human 决策落 decisions（开好头原则，D004）
6. **05 开工卡（仅 java-business 链，D003-v3 D004）**：进 05 前核对 `_state/decisions.md` 有「产研测评审」记录（三态：通过/带修改通过/打回）；无→停等（blockers 挂「待产研测评审」）。toolchain/data-script 链 05=human 纯拍板，无此步

## 阶段库与链（01~14；链=需求 profile 的 phases 子集，建项冻结——B2-A）

```text
阶段库（dev-swarm.yaml nodes.stages，order=库编号） → 三链：
java-business（13）：01→02→03→04→05→06→07→08→09→10→14→11→12（14=发布验证与观测，human 通知触发）
toolchain（9）    ：01→03→04→05→06→07→09→11→12（02/08/10/14 退链留库）
data-script（7）  ：01→03→04→13→09→11→12（13=编写脚本和验证脚本，human 硬卡）
本需求走哪条链=current.md phases（建项快照）；产物文件编号=库编号，链上没有的阶段不出文件
```

| 阶段 | 默认 agent | gate | cc 侧动作 |
|------|-----------|------|----------|
| 01/03 需求分析/技术方案 | cc | auto（advance_gates） | 产出对应 0N 文档（toolchain 门禁裁剪含 03 前置节=模块边界表；java-business 按操作卡 `skill/pipeline/ops/`；02 服务拆分仅 java 链） |
| 04 方案审查 | **cursor** | auto | 等待；收到打回差异清单后回改 01/03 |
| 05 开发编码 | cc | **human** | 按方案逐功能点实现；04-开发编码.md 状态表三态（✅/🔶/❌），**禁止预标未完成项**；阶段末亲自代码核查 |
| 06 代码审查 | **cursor** | auto | 等待；收到问题清单后修复 |
| 07 单元测试 | cc | auto | 脚本类=可执行测试；无单测环节写"不涉及" |
| 08 提测 | cc | auto | 提测文档+部署信息；写 reverify.md 首批（schema v2 九列，contract §5）；java 链专属 |
| 09 Agent自动化测试 | cursor 主导 | auto | cc 只做**修复子节点**：定位（先证据）→ 修复带单测 → 写 reverify 行（schema v2 九列）→ 状态跃迁到已修复待验；**已验证绝不写**；复验打回走「下一层」原则（contract §8） |
| 10 发布CheckList | cc | **human** | 三块式+发布产物（K5：`10-发布CheckList/` 子目录，七类参考、有的必落产物文件）；java 链专属 |
| 14 发布验证与观测 | **cursor** | **human** | 等待；human 通知某项已配置/已发布→cursor 单项验证（三项口径+记录表，见 ops/14）；cc 只做**修复子节点**（纪律同 09）；java 链专属 |
| 11~12 | cc | auto | 复盘 / 知识库更新（自动节点） |
| 13 编写脚本和验证脚本 | cc | **human** | data-script 链专属：`13-脚本/` 四件套+数据安全五条（见 `ops/13`），**reverify 首批由 13 承接**；verify 跑绿≠已验证 |

gate 语义：产物完成后 `auto`=按小结衔接协议直接推进；`human`=停等确认（04 放行≠05 开工，须 human 拍板落 decisions）。权威源=**需求 profile 的 `advance_gates`**（`skill/pipeline/{profile}.yaml`，F07/D005：java-business 的 01/02/03=human，toolchain=auto）；仓级 `dev-swarm.yaml` `nodes.stages.*.gate` 兜底。

## 阶段衔接（零推断）

- 上阶段产物末尾 `## 小结`（产出/阻塞/已知缺口/交接 四 bullet）是唯一交接依据，**机械截取**，不 LLM 提取正文
- 小结缺失 → 提示用户补写或人工确认，不自行编造
- 衔接动作：截取小结 → 原子更新 current.md（phase/node/next 同次提交）→ 勾选 phases

## current.md 写入规则

- **当前节点 agent 独占写**；frontmatter（schema 2）为机器唯一依据
- `next` 字段化（agent/action/blockers），禁止自由文本
- 每次写入刷新 `updated_at`（ISO 8601 带时区）；写后跑 YAML 校验

## 提交规约（详见 SPEC-提交规约.md）

- workspace/ 数据：本节点产物完成即自主 commit（`Agent: cc-dev`）；push 按 `push_policy`——collaborative=节点末自主 push（push 前 `pull --rebase`）；**local-only（默认）=节点末只 commit 不 push**，push 为收尾/备份动作（时序见 SPEC-提交规约 §1.1）
- 工具路径（skill/ console/ SPEC-* dev-swarm.yaml hooks/ README.md）：commit 后**等 human 批准**（Approved-by: human），不自主 push
- 业务代码仓：不主动 push；commit 后汇报 appid+范围+描述
- 署名与暂存纪律（contract §2 产物与暂存纪律，F02/F03）：`Agent:`/`Approved-by:` **提交时落笔**，禁止 amend/filter-branch/soft reset 事后补署名（修史仅 human 当条消息显式指令，SPEC §4）；**点名 add**——只 `git add` 明确文件清单，禁止整目录 add（pre-commit 拒 workspace/ 多需求混存）

## 危险操作纪律

- **`git reset --hard` 拒绝执行**，除非用户**当条消息**显式给出要保留的 commit——先 commit 再丢弃工作区（V1 曾两次删掉未提交修复）。软回退（--soft/--mixed）不受限，但仍须先确认改动已入栈或已 commit。
- 口径变更走 SPEC-变更流程.md 四步（Step0 用户确认前不改文件 → 影响矩阵 → 22 项点位 → scan_terms），矩阵全核销才算闭环。

## bug 修复纪律（Agent自动化测试/修复子节点）

1. 先证据后结论：日志实证（MCP）→ 区分代码 vs 配置 → 数据验证（websql）→ 白盒（GitNexus）
2. 修复必须带单测；复验打回先答「下一层还有没有封装副作用」，禁止原补丁打补丁
3. 台账写三文件协议（contract §4）：status 仅当前状态；log append-only 带署名与实证/推断标注；INDEX 同次提交
4. 根因在方案口径分裂 → 强制方案回溯（contract §8.4），04-方案审查不能代替
