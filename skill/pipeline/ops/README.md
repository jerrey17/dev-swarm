# ops/ — 各阶段操作卡（阶段库编号 01~14；profile场景定制 D001/D002）

> 内容源：dev-workflow SKILL.md 编排知识迁移（2026-10-03 原文抄录），迁完之日 dev-workflow SKILL.md 退出必需阅读清单。
> 用法：**按需求 profile 链用卡**——java-business 13 张（01～12 加 14；13 仍只属于 data-script）；data-script 用 01/03/04/13/09 卡；toolchain 沿用 adapters/cc/SKILL.md（门禁由 profile yaml 裁剪）。
> 状态：首批 java-business / data-script 试点需求时逐卡验证打磨。

| 卡 | 阶段 | agent | 要点 |
|----|------|-------|------|
| [01-需求分析.md](01-需求分析.md) | 需求分析 | cc-dev | req-analysis 调用+TAPD 拉取边界 |
| [02-服务拆分.md](02-服务拆分.md) | 服务拆分 | cc-dev | service-split+GitNexus 组匹配+关联项目回填 |
| [03-技术方案.md](03-技术方案.md) | 技术方案 | cc-dev | tech-solution-design+Wiki 推送可选 |
| [04-方案审查.md](04-方案审查.md) | 方案审查 | cursor-qa | 三方对齐矩阵方法（cursor 自有能力执行） |
| [05-开发编码.md](05-开发编码.md) | 开发编码 | cc-dev | 三态状态表+阶段末代码核查+gap-review 自检 |
| [06-代码审查.md](06-代码审查.md) | 代码审查 | cursor-qa | 三方对齐→规范审查两步维度（cursor 执行） |
| [07-单元测试.md](07-单元测试.md) | 单元测试 | cc-dev | new-test-development 调用 |
| [08-提测.md](08-提测.md) | 提测 | cc-dev | submit-for-testing+reverify 首批 |
| [09-Agent自动化测试.md](09-Agent自动化测试.md) | Agent自动化测试 | cursor-qa（修复子节点=cc-dev） | 四步法+三文件台账 |
| [10-发布CheckList.md](10-发布CheckList.md) | 发布CheckList | cc-dev | 三块式+配置回填 |
| [11-复盘.md](11-复盘.md) | 复盘 | cc-dev | 台账统计+根因归纳 |
| [12-知识库更新.md](12-知识库更新.md) | 知识库更新 | cc-dev | 自动节点：环境复位+索引重建 |
| [13-编写脚本和验证脚本.md](13-编写脚本和验证脚本.md) | 编写脚本和验证脚本 | cc-dev | data-script 链专属：四件套+数据安全五条+reverify 首批 |
| [14-发布验证与观测.md](14-发布验证与观测.md) | 发布验证与观测 | cursor-qa（修复子节点=cc-dev） | java 链专属：human 通知触发+单项验证（三项口径）+记录表；gate=human 收口 |
