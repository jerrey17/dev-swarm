# 操作卡 09 — Agent自动化测试（java-business；执行=cursor-qa，修复子节点=cc-dev，部署=human）

## 执行（cursor-qa）

消费 `reverify.md`（唯一开工信号，schema v2 九列）：

- 实例**空**或数据根**空** → 停，log 写阻塞原因等 human 部署，不猜 IP
- 两列「无」= 显式不涉及，可继续复验（对其合理性有质疑权，质疑=打回）
- 复验在复验单声明的代码根/commit 上重跑，比对「期望」字段级输出
- 通过 → status 跃迁「已验证」（commit 正文含 `代码根:`/`数据根:`/`实际输出:` 三行，缺则被 pre-push 拒）；不过 → reverify 行「已打回」+ 同次 status 回「待修复」+ 附实际输出（只在聊天说「不对」不算打回）
- 台账：三文件协议——status.md 仅当前状态、log.md append-only 带 [实证]/[推断] 标注、INDEX 同次提交

**四步法（原文）**：先写用例、只改测试库并还原、报文库表对字段、缓存异常单独看。

（workspace 仓并行/worktree：命令与纪律见 `05-开发编码.md`「workspace 仓并行与 worktree」——他需求脏区时第二需求开工默认进 worktree；单需求留主工作区；禁止 reset 清盘。）

## 修复子节点（cc-dev）

1. 先证据后结论：日志实证（MCP）→ 区分代码 vs 配置 → 数据验证（websql）→ 白盒（GitNexus）
2. 修复必须带单测；复验打回先答「下一层还有没有封装副作用」（contract §8 下一层原则），禁止原补丁打补丁
3. 修复完成：status→已修复待验 + reverify 写新行（单号/代码根/commit/数据根/复验动作/期望/实例/待复验）→ 状态跃迁 commit `Agent: cc-dev`；**已验证绝不写**
4. 根因在方案口径分裂 → 强制方案回溯（contract §8.4 + SPEC-变更流程.md），04 审查不能代替
5. TAPD 边界③：本地台账归 cc；TAPD 缺陷状态流转归 cursor-qa；不顺手改 TAPD

## 门禁自检项（gates.Agent自动化测试）

- [ ] 状态只用六词，INDEX 与 status.md 一致（check_workspace）
- [ ] 一条缺陷修复部署后就复验，不堆积批次
- [ ] 环境问题只解释某一次失败，规范不达标仍是待修复

## 衔接

无 open bug 或测试验收通过（human 确认可发布）→ 10 发布CheckList。
