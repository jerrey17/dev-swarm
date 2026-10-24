#!/usr/bin/env python3
"""s9：F07/D003-v3 推进笔认可（check_current_push 见证集=仅父版本状态）

五场景（bare+clone+新分支 push，镜像 s7）：
① 04 复审放行笔最小化（父 node=技术方案/父 next.agent=cursor-qa，新 node=开发编码，Agent=cursor-qa）→ 放行
② 04 复审打回笔最小化（父 node=开发编码/父 next.agent=cursor-qa，新 node=技术方案，Agent=cursor-qa）→ 放行
③ 真越权（父 node=技术方案/父 next.agent=cc-dev，cursor-qa 改 current.md）→ 拒
④ 自证一（同父状态，cursor-qa 把 node 改成方案审查——见证集不得读新版本 node）→ 拒
⑤ 自证二（同父状态，cursor-qa 只把 next.agent 改成 cursor-qa——见证集不得读新版本 next.agent）→ 拒
"""
import os
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BASE_BRANCH = "dev-workflow-workspace"

FM = """---
name: "s9-临时需求"
phase: {phase}
node: {node}
profile: toolchain
next:
  agent: {agent}
  action: "s9 夹具"
  blockers: []
terminal: false
updated_at: "2026-10-15T18:00:00+08:00"
---
{body}"""


def run(*args, cwd=None, check=False):
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"❌ 命令失败: {' '.join(args)}\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r


def make_current(clone, phase, node, agent, body=""):
    p = os.path.join(clone, "workspace", "s9-临时需求", "_state", "current.md")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(FM.format(phase=phase, node=node, agent=agent, body=body))


def commit(clone, msg, agent):
    run("git", "-C", clone, "add", "-A", "workspace", check=True)
    run("git", "-C", clone, "commit", "-m", f"{msg}\n\nAgent: {agent}", check=True)


def push_expect(clone, branch, want_ok, label, needle="越权"):
    r = run("git", "-C", clone, "push", "origin", f"HEAD:refs/heads/{branch}")
    out = r.stderr + r.stdout
    ok = (r.returncode == 0) if want_ok else (r.returncode != 0 and needle in out)
    print(("✅" if ok else "❌") + " " + label)
    if not ok:
        print(out[-600:])
    return ok


def main():
    tmp = tempfile.mkdtemp(prefix="ds-s9-")
    try:
        bare = os.path.join(tmp, "bare.git")
        run("git", "init", "--bare", "-b", BASE_BRANCH, bare, check=True)
        run("git", "-C", REPO, "push", "--no-verify", bare, f"HEAD:refs/heads/{BASE_BRANCH}", check=True)
        clone = os.path.join(tmp, "clone")
        run("git", "clone", bare, clone, check=True)
        run("git", "-C", clone, "config", "core.hooksPath", "hooks", check=True)
        run("git", "-C", clone, "config", "user.email", "s9@dev-swarm.test", check=True)
        run("git", "-C", clone, "config", "user.name", "s9", check=True)

        # 基线=cc 回改完成交回复审（node=技术方案、next=cursor-qa）
        make_current(clone, "技术方案", "技术方案", "cursor-qa")
        commit(clone, "s9 基线：cc 回改交回复审", "cc-dev")
        base = run("git", "-C", clone, "rev-parse", "HEAD").stdout.strip()

        # ① 复审放行笔（022c744 最小化）
        make_current(clone, "开发编码", "开发编码", "human")
        commit(clone, "s9-1 04 复审放行：node 03→05，停在 human 硬卡", "cursor-qa")
        ok1 = push_expect(clone, "t9-1", True, "① 复审放行笔（父 next.agent=cursor-qa）→ 放行")
        run("git", "-C", clone, "reset", "--hard", base, check=True)

        # ② 复审打回笔（5da6c9a 最小化）：先由 cc 置父态（node=开发编码、next=cursor-qa）
        make_current(clone, "开发编码", "开发编码", "cursor-qa")
        commit(clone, "s9-2a 父态：05 前一晚的复审排队", "cc-dev")
        make_current(clone, "技术方案", "技术方案", "cc-dev")
        commit(clone, "s9-2b 04 复审打回 D099：node 05→03 退回技术方案", "cursor-qa")
        ok2 = push_expect(clone, "t9-2", True, "② 复审打回笔（父 node=开发编码/父 next.agent=cursor-qa）→ 放行")
        run("git", "-C", clone, "reset", "--hard", base, check=True)

        # ③④⑤ 共享父态：node=技术方案、next=cc-dev（cc 在写 03，cursor 无份）
        make_current(clone, "技术方案", "技术方案", "cc-dev")
        commit(clone, "s9-3a 父态：cc 撰写 03 中", "cc-dev")

        make_current(clone, "技术方案", "技术方案", "cc-dev", body="- cursor 越权追加\n")
        commit(clone, "s9-3 cursor 越权写正文", "cursor-qa")
        ok3 = push_expect(clone, "t9-3", False, "③ 真越权（父 next.agent=cc-dev）→ 拒绝")
        run("git", "-C", clone, "reset", "--hard", "HEAD~1", check=True)

        make_current(clone, "方案审查", "方案审查", "cursor-qa")
        commit(clone, "s9-4 cursor 自改 node=方案审查", "cursor-qa")
        ok4 = push_expect(clone, "t9-4", False, "④ 自证一（改新 node 归自己）→ 拒绝")
        run("git", "-C", clone, "reset", "--hard", "HEAD~1", check=True)

        make_current(clone, "技术方案", "技术方案", "cursor-qa")
        commit(clone, "s9-5 cursor 自改 next.agent=cursor-qa", "cursor-qa")
        ok5 = push_expect(clone, "t9-5", False, "⑤ 自证二（改新 next.agent 指自己）→ 拒绝")

        sys.exit(0 if (ok1 and ok2 and ok3 and ok4 and ok5) else 1)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
