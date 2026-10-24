# SPEC-提交规约

> 全体 agent 强制遵守。依据：dev-swarm 技术方案总览 V1.7 §8.9（push 边界）。机制 5/8 的落地。

## 1. 分路径规则

| 路径 | commit | push |
|------|--------|------|
| `workspace/**`（需求数据） | 负责该文件的 agent 自主 commit | 按 `push_policy`（`dev-swarm.yaml` `workspace.push_policy`，默认 `local-only`）：<br>**collaborative**（协作共享）=自主 push（协作对象需要看到台账），push 前 `pull --rebase`；<br>**本地-only**（`local-only`）=节点末只 commit 不 push，push 为收尾/备份动作（时序见 §1.1） |
| `skill/`、`console/`、`SPEC-*`、`dev-swarm.yaml`、`hooks/`、`README.md`（工具） | cc-dev commit | **必须 human 批准**：commit message 带 `Approved-by: human` trailer 才能过 pre-push |
| 业务代码仓（monorepo 之外） | 现行规则：不主动 push | commit 后汇报 appid+范围+描述，human 确认后 push |

## 1.1 本地并行层（本地-only，`push_policy=local-only`）

- **目录隔离 ≠ 工作区隔离**：多需求按 `workspace/{需求}/` 目录隔离，但仍共享同一 git 工作区——`git rebase` 拒绝任何未提交改动（与路径是否冲突无关），A 需求的脏文件会挡住 B 的收口操作（`--ff-only` 仅在远端更新触及脏路径时被挡）。
- **节点末**：只 commit 自己路径的产物，不 push、不 pull。
- **收尾/备份 push 时序**（唯一需要整仓干净的时点）：
  1. 逐需求处理各自脏区（各自 commit，或 human 决定去留——禁止 agent reset 清他人盘）
  2. 跑工作区自检：`python3 skill/scripts/check_workspace.py workspace {需求名}`，E-dirty（他需求脏区）清零
  3. `git pull --rebase`
  4. `git push`（工具路径 commit 仍受 pre-push `Approved-by: human` 门禁，见 §2）
- **worktree（常态并行默认路径，F05/D003-v3）**：他需求脏区（E-dirty）时，第二需求开工默认进 worktree；单需求（含自身脏区）仍用主工作区；双需求同时收口/收尾备份同样走 worktree。命令样例见 `skill/pipeline/ops/05-开发编码.md`。
- §5 远端不可达攒批后统一 rebase 的语义不变。

## 2. 为什么路径前缀不能代替 push 边界

同一分支上 push 是**整段区间**：数据自主 push 会把压在待推送区间里的未批准工具 commit 一起推上去。因此 pre-push hook 逐 commit 检查：涉及工具路径且无 `Approved-by: human` → 拒绝整段 push。

推荐操作：工具 commit 放分支 `tool`，human 审后合并进 `feature-acknowledge` 再推。

## 3. 提交粒度

- 阶段产物：阶段完成时一次提交（current.md 随行）
- bug 台账与 reverify：**按单提交**（一 bug 一 commit，回滚面最小）
- 禁止逐操作提交（防 current.md 的 updated_at 噪音）

## 4. commit message 约定

- 署名：**提交时落笔**——message 首行后空行接 `Agent: {agent-id}`（cc-dev / cursor-qa / human）；工具路径**同笔**追加 `Approved-by: human`（human 批准先于 commit，不是推送前补）
- **禁止事后修史补署名**（F02/D003-v3）：amend 补 trailer、filter-branch 改写、soft reset 重签=禁止路径（P2 实证：SHA 漂移致台账引用失真）。署名错误的标准修复=下一笔提交时写对；重建历史仅 human 当条消息显式指令，重建笔须同步台账引用
- 例：

```text
fix: 上传地址去前缀 (BUG-062)

Agent: cc-dev
```

```text
feat(skill): agent-contract 增加复验词约束

Agent: cc-dev
Approved-by: human
```

## 5. 异常：远端不可达

各 agent 本地 commit 攒批，恢复后统一 `pull --rebase` 再 push；冲突按「按列分主人 + 三文件物理分治」解决，不改对方已写行。
