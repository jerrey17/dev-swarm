#!/usr/bin/env python3
"""current.md 状态单写（git 层门禁，被 hooks/pre-push 调用；原名 F09 状态单写，F07/D003-v3 见证集修订后去编号撞字）

规则：commit 触碰 workspace/*/_state/current.md 时，按**合法见证集**判越权——
命中任一放行：① Agent: human ② Agent==父版本 node 的配置 agent（subnodes 优先、stages 回退）
③ Agent==父版本 frontmatter 的 next.agent（交接见证：放行笔/打回笔提交时 current.md
仍指向被推进节点、next 指向审查方，属正常时序）。
见证集**仅取父版本（提交前状态）**——本提交可改写的新版本 node/next.agent 不作依据（防自证）。
文件新建（无父版本）时用本版本 node/next 校验（初始化同样受管）。
新版本 node 仍须命中 stages/subnodes（防写入配置外 node 使后续校验失效）。
防 V1 双写覆盖事故复发：另一方只追加 log.md，不改 current.md。

用法：python3 check_current_push.py <commit>...
退出码：0=合法 / 1=存在越权写入（push 应拒绝）
"""
import os
import re
import subprocess
import sys

import yaml


def git(*args):
    return subprocess.run(["git", "-c", "core.quotepath=false", *args], capture_output=True, text=True).stdout


def changed_files(commit):
    parents = git("rev-list", "--parents", "-n", "1", commit).split()[1:]
    if not parents:
        return git("show", "--name-only", "--pretty=format:", commit).split()
    files = []
    for p in parents:
        files += git("diff-tree", "--no-commit-id", "--name-only", "-r", p, commit).split()
    return sorted(set(files))


def has_obj(rev) -> bool:
    return subprocess.run(["git", "cat-file", "-e", rev], capture_output=True).returncode == 0


def parse_frontmatter_field(text, key):
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
    if not m:
        return None
    try:
        return (yaml.safe_load(m.group(1)) or {}).get(key)
    except yaml.YAMLError:
        return None


def next_agent_of(text):
    nxt = parse_frontmatter_field(text, "next")
    return nxt.get("agent") if isinstance(nxt, dict) else None


def agent_of(commit):
    m = re.search(r"^Agent:\s*(\S+)", git("log", "-1", "--pretty=%B", commit), re.M)
    return m.group(1) if m else "unknown"


def agent_for_node(repo_root, node):
    """subnodes 优先、stages 回退；两处均未命中返回 None（node 非法）"""
    cfg_path = os.path.join(repo_root, "dev-swarm.yaml")
    try:
        cfg = yaml.safe_load(open(cfg_path, encoding="utf-8").read()) or {}
    except (OSError, yaml.YAMLError):
        return None
    nodes = cfg.get("nodes") or {}
    for key in ("subnodes", "stages"):
        for name, spec in (nodes.get(key) or {}).items():
            if name == node:
                return spec.get("agent")
    return None


def check_commit(commit):
    bad = []
    root = git("rev-parse", "--show-toplevel").strip()
    for f in changed_files(commit):
        if not (f.startswith("workspace/") and f.endswith("/_state/current.md")):
            continue
        agent = agent_of(commit)
        if agent == "human":
            continue
        old_ref = f"{commit}~1:{f}"
        old_text = git("show", old_ref) if has_obj(old_ref) else None
        new_text = git("show", f"{commit}:{f}")
        # 见证集仅取父版本（提交前状态）；新建文件无父版本时用本版本（初始化同样受管）
        witness_text = old_text if old_text else new_text
        node = parse_frontmatter_field(witness_text, "node")
        if not node:
            bad.append(f"  {commit[:8]} {f}\n    agent={agent}：frontmatter 无 node 或解析失败")
            continue
        expect = agent_for_node(root, str(node))
        next_agent = next_agent_of(witness_text)
        witnesses = {w for w in (expect, next_agent) if w}
        if expect is None:
            bad.append(f"  {commit[:8]} {f}\n    agent={agent}：node「{node}」未命中 dev-swarm.yaml stages/subnodes")
        elif agent not in witnesses:
            bad.append(
                f"  {commit[:8]} {f}\n    agent={agent} 越权：提交前节点「{node}」归 {expect}、"
                f"提交前 next.agent={next_agent}（合法见证集=human/父版本 node 归属/父版本 next.agent；"
                "放行/打回推进笔由交接双方署名）"
            )
        # 跃迁目标合法性：新版本 node 必须命中 stages/subnodes（防写入配置外 node 使后续校验失效）
        new_node = parse_frontmatter_field(new_text, "node")
        if new_node and agent_for_node(root, str(new_node)) is None:
            bad.append(f"  {commit[:8]} {f}\n    agent={agent}：新 node「{new_node}」未命中 dev-swarm.yaml stages/subnodes（非法跃迁目标）")
    return bad


def main():
    bad = []
    for commit in sys.argv[1:]:
        bad += check_commit(commit)
    if bad:
        print("❌ pre-push 拒绝：current.md 存在越权写入（状态单写门禁）")
        print("\n".join(bad))
        print("  处置：改由该节点配置 agent 提交，或 human 提交（Agent: human）")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
