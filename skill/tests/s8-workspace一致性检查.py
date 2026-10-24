#!/usr/bin/env python3
"""s8：F08 workspace 一致性 CLI（check_workspace.py）退出码语义

① 夹具 INDEX 与 status 不一致 → 退出码非 0，输出含「状态不一致」
② 修正后 → 退出码 0
③ current.md node 非法 → 退出码非 0
④ 本仓真实 workspace → 退出码 0
⑤ E-dirty 拒开文案含 worktree 默认路径命令（F05/D003-v3；直接断言 e_dirty_error，git 状态解耦）
"""
import os
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CLI = os.path.join(REPO, "skill", "scripts", "check_workspace.py")

STATUS = "---\nid: {bid}\nstatus: {st}\nupdated_at: 2026-10-03T17:00:00+08:00\n---\n"


def run_cli(ws_root):
    r = subprocess.run([sys.executable, CLI, ws_root], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def make_fixture(ws, idx_status, node="需求分析"):
    req = os.path.join(ws, "s8-临时需求")
    os.makedirs(os.path.join(req, "bug", "BUG-910"), exist_ok=True)
    os.makedirs(os.path.join(req, "_state"), exist_ok=True)
    with open(os.path.join(req, "bug", "BUG-910", "status.md"), "w", encoding="utf-8") as f:
        f.write(STATUS.format(bid="BUG-910", st="已修复待验"))
    with open(os.path.join(req, "bug", "INDEX.md"), "w", encoding="utf-8") as f:
        f.write("# idx\n\n| 单号 | 标题 | 状态 | 最近更新 |\n|------|------|------|----------|\n"
                f"| BUG-910 | t | {idx_status} | 2026-10-03 |\n")
    with open(os.path.join(req, "reverify.md"), "w", encoding="utf-8") as f:
        f.write("# rv\n\n| 单号 | 代码根 | commit | 数据根 | 复验动作 | 期望 | 实际 | 实例 | 状态 |\n"
                "|------|--------|--------|--------|----------|------|------|------|------|\n")
    with open(os.path.join(req, "_state", "current.md"), "w", encoding="utf-8") as f:
        f.write("---\nname: \"s8-临时需求\"\nphase: " + node + "\nnode: " + node +
                "\nprofile: toolchain\nnext:\n  agent: cc-dev\n  action: \"夹具\"\n  blockers: []\n"
                "terminal: false\nupdated_at: \"2026-10-03T17:00:00+08:00\"\nphases:\n  - name: 需求分析\n    completed: true\n---\n")
    return req


def main():
    tmp = tempfile.mkdtemp(prefix="ds-s8-")
    try:
        # ① 不一致 → 非 0
        ws1 = os.path.join(tmp, "ws1")
        os.makedirs(ws1)
        make_fixture(ws1, idx_status="已验证")
        rc1, out1 = run_cli(ws1)
        ok1 = rc1 != 0 and "状态不一致" in out1
        print(("✅" if ok1 else "❌") + " INDEX 与 status 不一致 → 退出码非 0")
        if not ok1:
            print(out1)

        # ② 修正 → 0
        ws2 = os.path.join(tmp, "ws2")
        shutil.copytree(ws1, ws2)
        p = os.path.join(ws2, "s8-临时需求", "bug", "INDEX.md")
        open(p, "w", encoding="utf-8").write(
            "# idx\n\n| 单号 | 标题 | 状态 | 最近更新 |\n|------|------|------|----------|\n"
            "| BUG-910 | t | 已修复待验 | 2026-10-03 |\n")
        rc2, out2 = run_cli(ws2)
        ok2 = rc2 == 0
        print(("✅" if ok2 else "❌") + " 修正后 → 退出码 0")
        if not ok2:
            print(out2)

        # ③ node 非法 → 非 0
        ws3 = os.path.join(tmp, "ws3")
        shutil.copytree(ws2, ws3)
        cp = os.path.join(ws3, "s8-临时需求", "_state", "current.md")
        txt = open(cp, encoding="utf-8").read().replace("node: 需求分析", "node: 非法节点")
        open(cp, "w", encoding="utf-8").write(txt)
        rc3, out3 = run_cli(ws3)
        ok3 = rc3 != 0 and "未命中" in out3
        print(("✅" if ok3 else "❌") + " current.md node 非法 → 退出码非 0")
        if not ok3:
            print(out3)

        # ④ 本仓真实 workspace → 0
        rc4, out4 = run_cli(os.path.join(REPO, "workspace"))
        ok4 = rc4 == 0
        print(("✅" if ok4 else "❌") + " 本仓真实 workspace → 退出码 0")
        if not ok4:
            print(out4)

        # ⑤ E-dirty 文案：默认路径=worktree（F05），含命令样例
        sys.path.insert(0, os.path.join(REPO, "skill", "scripts"))
        import check_workspace as cw
        msg = cw.e_dirty_error("s8-临时需求", {"s8-别的需求"})
        ok5 = ("worktree add ../dev-swarm-workspace.wt/s8-临时需求" in msg
               and "wt/s8-临时需求" in msg and "禁止 reset 清盘" in msg)
        print(("✅" if ok5 else "❌") + " E-dirty 拒开文案含 worktree 默认路径命令（F05）")
        if not ok5:
            print(msg)

        sys.exit(0 if (ok1 and ok2 and ok3 and ok4 and ok5) else 1)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
