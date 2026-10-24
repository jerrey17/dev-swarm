---
# profile 填写指引（F06+kind，03 §3.7/§3.8；开好头原则）：
#   ① services.yaml kind 显式声明优先（toolchain | java-business | data-script）；
#   ② 缺 kind 按规则推断——R1 任一 appid 非空 → java-business；R2 local_path 全部指向本仓（或无 services）→ toolchain；
#      R3 判不定 → 停问 human，声明落 decisions 后再写。禁止 agent 猜测或擅自取默认值。
#   开工校验（check_workspace.py 带需求名）会核对本值。
#
# phases 填写指引（B2-A 建项冻结）：
#   逐项复制该需求 profile（skill/pipeline/{profile}.yaml）的 phases——名称+顺序即建项链快照，之后不随 yaml 演进变化。
#   三链速查：
#     java-business（13）：需求分析/服务拆分/技术方案/方案审查/开发编码/代码审查/单元测试/提测/Agent自动化测试/发布CheckList/发布验证与观测/复盘/知识库更新（发布验证与观测=库号 14）
#     toolchain（9）：需求分析/技术方案/方案审查/开发编码/代码审查/单元测试/Agent自动化测试/复盘/知识库更新
#     data-script（7）：需求分析/技术方案/方案审查/编写脚本和验证脚本/Agent自动化测试/复盘/知识库更新
name: "{需求名}"
phase: 需求分析
node: 需求分析
profile: toolchain
next:
  agent: cc-dev
  action: "产出 01-需求分析.md"
  blockers: []
terminal: false
updated_at: "2026-10-03T16:00:00+08:00"
phases:
  - name: 需求分析
    completed: false
  - name: 服务拆分
    completed: false
  - name: 技术方案
    completed: false
  - name: 方案审查
    completed: false
  - name: 开发编码
    completed: false
  - name: 代码审查
    completed: false
  - name: 单元测试
    completed: false
  - name: 提测
    completed: false
  - name: Agent自动化测试
    completed: false
  - name: 发布CheckList
    completed: false
  - name: 复盘
    completed: false
  - name: 知识库更新
    completed: false
---

# current.md — 总控（frontmatter 为机器唯一依据；正文只放人读备注）

- 需求名/name 必须与目录名一致；phases 顺序=skill/pipeline/{profile}.yaml 的 phases
- 当前节点 agent 独占写；phase/node/next 三字段必须同一次提交变更（agent-contract §6）
- 每次写入刷新 updated_at（ISO 8601 带时区）；写后跑 PyYAML 校验
- next 禁止自由文本；blockers 非空 = 任何 agent 不可开工
- frontmatter 值禁 Markdown 标记；同键禁重复

## 备忘

- TAPD：{需求链接}
- 创建：{日期}，by cc-dev（初始化）
