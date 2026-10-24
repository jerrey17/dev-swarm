#!/usr/bin/env python3
"""CR-001 + CC 复核加固：workspace/**/status.md 跃迁校验（git 层门禁，被 hooks/pre-push 调用）

加固（CC 复核 2026-10-03）：
- merge commit 用 diff-tree 对每个 parent 求并集（combined diff 会漏单侧合并文件，绕过校验）
- 统一 core.quotepath=false（防其他 clone 环境中文路径转义导致匹配失效）

用法：python3 check_status_push.py <commit>...
退出码：0=合法 / 1=存在无权跃迁（push 应拒绝）
"""
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests"))
from lib import check_transition, STATUSES


def git(*args):
    return subprocess.run(["git", "-c", "core.quotepath=false", *args], capture_output=True, text=True).stdout


def changed_files(commit):
    """commit 变更文件：merge 对每个 parent 的 diff 求并集"""
    parents = git("rev-list", "--parents", "-n", "1", commit).split()[1:]
    if not parents:
        return git("show", "--name-only", "--pretty=format:", commit).split()
    files = []
    for p in parents:
        files += git("diff-tree", "--no-commit-id", "--name-only", "-r", p, commit).split()
    return sorted(set(files))


def has_obj(rev) -> bool:
    return subprocess.run(["git", "cat-file", "-e", rev], capture_output=True).returncode == 0


def parse_status(text):
    m = re.search(r"^status:\s*(\S+)", text, re.M)
    return m.group(1) if m else None


def agent_of(commit):
    m = re.search(r"^Agent:\s*(\S+)", git("log", "-1", "--pretty=%B", commit), re.M)
    return m.group(1) if m else "unknown"


def check_commit(commit):
    bad = []
    for f in changed_files(commit):
        if not (f.startswith("workspace/") and f.endswith("/status.md")):
            continue
        new_st = parse_status(git("show", f"{commit}:{f}"))
        old_ref = f"{commit}~1:{f}"
        old_st = parse_status(git("show", old_ref)) if has_obj(old_ref) else None
        frm = old_st if old_st in STATUSES else "待确认"
        agent = agent_of(commit)
        ok, reason = check_transition(agent, frm, new_st or "")
        if not ok:
            bad.append(f"  {commit[:8]} {f}\n    agent={agent} {frm} -> {new_st}：{reason}")
            continue
        # F07（v2 新增分支，不动上方既有判定）：复验方「已验证」提交须附三摘要行
        if new_st == "已验证":
            body = git("log", "-1", "--pretty=%B", commit)
            missing = [k for k in ("代码根:", "数据根:", "实际输出:") if not re.search(rf"^\s*{k}", body, re.M)]
            if missing:
                bad.append(
                    f"  {commit[:8]} {f}\n    agent={agent} {frm} -> {new_st}："
                    f"已验证提交缺摘要关键词 {missing}（须附 代码根:/数据根:/实际输出: 原始摘录行）"
                )
    return bad


def main():
    bad = []
    for commit in sys.argv[1:]:
        bad += check_commit(commit)
    if bad:
        print("❌ pre-push 拒绝：status.md 存在无权/非法跃迁（协议门禁）")
        print("\n".join(bad))
        print("  处置：改由有权限的 agent 提交（已验证只由复验节点写），或修正跃迁目标")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
