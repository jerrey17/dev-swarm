#!/usr/bin/env python3
"""s6：F07 复验方「已验证」摘要校验（v2 新增分支；V1 执行方拒绝语义同测保持）

三场景（独立分支 + reset 隔离）：
① 执行方(cc-dev)写已验证 → 拒（V1 语义不变）
② cursor-qa 写已验证但缺摘要行 → 拒（F07 新增）
③ cursor-qa 写已验证且含 代码根:/数据根:/实际输出: → 放行
"""
import os
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BASE_BRANCH = "dev-workflow-workspace"


def run(*args, cwd=None, check=False):
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"❌ 命令失败: {' '.join(args)}\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r


def make_bug_status(clone, bug, status):
    p = os.path.join(clone, "workspace", "s6-临时需求", "bug", bug, "status.md")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(f"---\nid: {bug}\nstatus: {status}\nupdated_at: 2026-10-03T17:00:00+08:00\n---\n")


def main():
    tmp = tempfile.mkdtemp(prefix="ds-s6-")
    try:
        bare = os.path.join(tmp, "bare.git")
        run("git", "init", "--bare", "-b", BASE_BRANCH, bare, check=True)
        run("git", "-C", REPO, "push", "--no-verify", bare, f"HEAD:refs/heads/{BASE_BRANCH}", check=True)
        clone = os.path.join(tmp, "clone")
        run("git", "clone", bare, clone, check=True)
        run("git", "-C", clone, "config", "core.hooksPath", "hooks", check=True)
        run("git", "-C", clone, "config", "user.email", "s6@dev-swarm.test", check=True)
        run("git", "-C", clone, "config", "user.name", "s6", check=True)
        base = f"origin/{BASE_BRANCH}"

        # ① 执行方写已验证 → 拒（V1 语义）。链：待修复(cc)→已修复待验(cc)→已验证(cc)
        make_bug_status(clone, "BUG-901", "待修复")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s6-1 立待修复\n\nAgent: cc-dev", check=True)
        make_bug_status(clone, "BUG-901", "已修复待验")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s6-1 修复完成\n\nAgent: cc-dev", check=True)
        make_bug_status(clone, "BUG-901", "已验证")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s6-1 执行方写已验证\n\nAgent: cc-dev", check=True)
        r1 = run("git", "-C", clone, "push", "origin", "HEAD:refs/heads/t6-1")
        out1 = r1.stderr + r1.stdout
        ok1 = r1.returncode != 0 and "BUG-901" in out1 and "已验证" in out1
        print(("✅" if ok1 else "❌") + " 执行方写已验证 → 拒绝（V1 语义保持）")
        if not ok1:
            print(out1[-600:])

        run("git", "-C", clone, "reset", "--hard", base, check=True)

        # ② cursor-qa 缺摘要 → 拒（F07）。链同上，末段换 cursor 无摘要
        make_bug_status(clone, "BUG-902", "待修复")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s6-2 立待修复\n\nAgent: cc-dev", check=True)
        make_bug_status(clone, "BUG-902", "已修复待验")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s6-2 修复完成\n\nAgent: cc-dev", check=True)
        make_bug_status(clone, "BUG-902", "已验证")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s6-2 复验方已验证（缺摘要）\n\nAgent: cursor-qa", check=True)
        r2 = run("git", "-C", clone, "push", "origin", "HEAD:refs/heads/t6-2")
        out2 = r2.stderr + r2.stdout
        ok2 = r2.returncode != 0 and "摘要" in out2 and "BUG-902" in out2
        print(("✅" if ok2 else "❌") + " 复验方已验证缺摘要 → 拒绝（F07 新增）")
        if not ok2:
            print(out2[-600:])

        run("git", "-C", clone, "reset", "--hard", base, check=True)

        # ③ cursor-qa 带三摘要行 → 放行
        make_bug_status(clone, "BUG-903", "待修复")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s6-3 立待修复\n\nAgent: cc-dev", check=True)
        make_bug_status(clone, "BUG-903", "已修复待验")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s6-3 修复完成\n\nAgent: cc-dev", check=True)
        make_bug_status(clone, "BUG-903", "已验证")
        run("git", "-C", clone, "add", "-A", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m",
            "s6-3 复验方已验证（带摘要）\n\n代码根: /clone\n数据根: 无\n实际输出: run_all 5/5 绿\n\nAgent: cursor-qa",
            check=True)
        r3 = run("git", "-C", clone, "push", "origin", "HEAD:refs/heads/t6-3")
        ok3 = r3.returncode == 0
        print(("✅" if ok3 else "❌") + " 复验方已验证带三摘要行 → 放行")
        if not ok3:
            print((r3.stderr + r3.stdout)[-600:])

        sys.exit(0 if (ok1 and ok2 and ok3) else 1)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
