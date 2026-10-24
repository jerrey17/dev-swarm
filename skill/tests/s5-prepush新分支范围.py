#!/usr/bin/env python3
"""s5：pre-push 新分支只查远端未有的提交（B-05 回归）

复现口径：以本仓当前 HEAD 铺一个 bare + clone（hook 用仓内 hooks/pre-push），推「新分支」时
只允许检查远端还没有的提交；已在远端分支上的历史工具提交（如 README）不得重判。
同时验证门禁未被放松：新分支上确有未批准工具路径提交时仍必须拒绝。
"""
import os
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def run(*args, cwd=None, check=False):
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"❌ 命令失败: {' '.join(args)}\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r


def main():
    tmp = tempfile.mkdtemp(prefix="ds-s5-")
    try:
        bare = os.path.join(tmp, "bare.git")
        run("git", "init", "--bare", "-b", "dev-workflow-workspace", bare, check=True)
        # 铺历史：把当前分支推进 bare（--no-verify 跳过本仓 hook，仅造远端现状）
        run("git", "-C", REPO, "push", "--no-verify", bare, "HEAD:refs/heads/dev-workflow-workspace", check=True)
        clone = os.path.join(tmp, "clone")
        run("git", "clone", bare, clone, check=True)
        run("git", "-C", clone, "config", "core.hooksPath", "hooks", check=True)
        run("git", "-C", clone, "config", "user.email", "s5@dev-swarm.test", check=True)
        run("git", "-C", clone, "config", "user.name", "s5", check=True)

        # ① 新分支只新增 workspace 提交 → 必须放行（B-05 修复点：不得重判历史 README 等工具提交）
        note = os.path.join(clone, "workspace", "s5-临时需求", "note.md")
        os.makedirs(os.path.dirname(note), exist_ok=True)
        with open(note, "w", encoding="utf-8") as f:
            f.write("s5 fixture\n")
        run("git", "-C", clone, "add", "workspace", check=True)
        run("git", "-C", clone, "commit", "-m", "s5: workspace 数据\n\nAgent: cc-dev", check=True)
        r1 = run("git", "-C", clone, "push", "origin", "HEAD:refs/heads/qa-verified")
        ok1 = r1.returncode == 0
        print(("✅" if ok1 else "❌") + " 新分支只含 workspace 提交 → 放行（历史工具提交不重判）")
        if not ok1:
            print("   stderr 尾行：" + (r1.stderr.strip().splitlines() or [""])[-1])

        # ② 门禁未放松：新分支确有未批准工具路径提交 → 必须拒绝
        with open(os.path.join(clone, "README.md"), "a", encoding="utf-8") as f:
            f.write("\ns5 append\n")
        run("git", "-C", clone, "add", "README.md", check=True)
        run("git", "-C", clone, "commit", "-m", "s5: 工具路径未批准\n\nAgent: cc-dev", check=True)
        r2 = run("git", "-C", clone, "push", "origin", "HEAD:refs/heads/qa-verified-2")
        ok2 = r2.returncode != 0 and "Approved-by" in (r2.stderr + r2.stdout)
        print(("✅" if ok2 else "❌") + " 新分支含未批准工具路径提交 → 拒绝（门禁未放松）")

        # ③ 已有分支区间语义不回归：只新增 workspace 提交推已有分支 → 放行
        r3 = run("git", "-C", clone, "push", "origin", "HEAD~1:refs/heads/dev-workflow-workspace")
        ok3 = r3.returncode == 0
        print(("✅" if ok3 else "❌") + " 已有分支只新增 workspace 提交 → 放行")

        sys.exit(0 if (ok1 and ok2 and ok3) else 1)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
