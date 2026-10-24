#!/usr/bin/env python3
"""s7：current.md 状态单写（仅当前节点配置 agent 可改，human 放行；门禁原名 F09 状态单写）

四场景（独立分支 + reset 隔离）：
① node=需求分析(cc-dev) 时 cursor-qa 提交 current.md → 拒
② 同 node cc-dev 提交 → 放行
③ node 未命中 stages/subnodes → 拒
④ node=Agent自动化测试/修复(subnodes→cc-dev) cc-dev 提交 → 放行（子节点解析）
"""
import os
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BASE_BRANCH = "dev-workflow-workspace"

FM = """---
name: "s7-临时需求"
phase: {phase}
node: {node}
profile: toolchain
next:
  agent: {agent}
  action: "s7 夹具"
  blockers: []
terminal: false
updated_at: "2026-10-03T17:00:00+08:00"
---
"""


def run(*args, cwd=None, check=False):
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"❌ 命令失败: {' '.join(args)}\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r


def make_current(clone, phase, node, agent):
    p = os.path.join(clone, "workspace", "s7-临时需求", "_state", "current.md")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(FM.format(phase=phase, node=node, agent=agent))


def main():
    tmp = tempfile.mkdtemp(prefix="ds-s7-")
    try:
        bare = os.path.join(tmp, "bare.git")
        run("git", "init", "--bare", "-b", BASE_BRANCH, bare, check=True)
        run("git", "-C", REPO, "push", "--no-verify", bare, f"HEAD:refs/heads/{BASE_BRANCH}", check=True)
        clone = os.path.join(tmp, "clone")
        run("git", "clone", bare, clone, check=True)
        run("git", "-C", clone, "config", "core.hooksPath", "hooks", check=True)
        run("git", "-C", clone, "config", "user.email", "s7@dev-swarm.test", check=True)
        run("git", "-C", clone, "config", "user.name", "s7", check=True)
        base = f"origin/{BASE_BRANCH}"

        # 基线：cc-dev 建需求 current.md（node=需求分析）——新建路径同样受管，Agent 匹配 → 放行基础
        make_current(clone, "需求分析", "需求分析", "cc-dev")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s7 基线建需求\n\nAgent: cc-dev", check=True)

        # ① cursor-qa 改当前（node 仍=需求分析）→ 拒
        with open(os.path.join(clone, "workspace", "s7-临时需求", "_state", "current.md"), "a", encoding="utf-8") as f:
            f.write("- cursor 追加\n")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s7-1 越权写\n\nAgent: cursor-qa", check=True)
        r1 = run("git", "-C", clone, "push", "origin", "HEAD:refs/heads/t7-1")
        out1 = r1.stderr + r1.stdout
        ok1 = r1.returncode != 0 and "越权" in out1 and "cc-dev" in out1
        print(("✅" if ok1 else "❌") + " 非节点 agent（cursor-qa）写 current.md → 拒绝")
        if not ok1:
            print(out1[-600:])

        run("git", "-C", clone, "reset", "--hard", "HEAD~1", check=True)

        # ② cc-dev 正常跃迁 node → 服务拆分 → 放行
        make_current(clone, "服务拆分", "服务拆分", "cc-dev")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s7-2 节点 agent 跃迁\n\nAgent: cc-dev", check=True)
        r2 = run("git", "-C", clone, "push", "origin", "HEAD:refs/heads/t7-2")
        ok2 = r2.returncode == 0
        print(("✅" if ok2 else "❌") + " 节点 agent（cc-dev）跃迁 current.md → 放行")
        if not ok2:
            print((r2.stderr + r2.stdout)[-600:])

        # ③ node 未命中 → 拒
        make_current(clone, "需求分析", "不存在的节点", "cc-dev")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s7-3 非法 node\n\nAgent: cc-dev", check=True)
        r3 = run("git", "-C", clone, "push", "origin", "HEAD:refs/heads/t7-3")
        out3 = r3.stderr + r3.stdout
        ok3 = r3.returncode != 0 and "未命中" in out3
        print(("✅" if ok3 else "❌") + " node 未命中 stages/subnodes → 拒绝")
        if not ok3:
            print(out3[-600:])

        run("git", "-C", clone, "reset", "--hard", "HEAD~1", check=True)

        # ④ 子节点 node → subnodes 解析 cc-dev → 放行
        make_current(clone, "Agent自动化测试", "Agent自动化测试/修复", "cc-dev")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s7-4 子节点修复写入\n\nAgent: cc-dev", check=True)
        r4 = run("git", "-C", clone, "push", "origin", "HEAD:refs/heads/t7-4")
        ok4 = r4.returncode == 0
        print(("✅" if ok4 else "❌") + " 子节点 node（Agent自动化测试/修复→cc-dev）→ 放行（subnodes 解析）")
        if not ok4:
            print((r4.stderr + r4.stdout)[-600:])

        sys.exit(0 if (ok1 and ok2 and ok3 and ok4) else 1)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
