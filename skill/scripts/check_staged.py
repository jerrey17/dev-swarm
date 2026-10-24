#!/usr/bin/env python3
"""F03 点名 add 检查（D003-v3；被 hooks/pre-commit 无参调用，可带需求名手动跑）

规则：
  无参模式（pre-commit）  ：暂存区 workspace/ 下解析出的需求目录 ≥2 → 拒（多需求混存=P3 连坐形态）
  带需求名模式（手动自查）：暂存含 workspace/ 且存在 ≠该需求 的目录 → 拒
  单需求整目录 add 不硬拦（防误伤本需求多产物合法整批）；防线=点名纪律（contract §2）
豁免：DS_ALLOW_HUMAN=1（human 特批合并场景）
退出码：0=过 / 1=拒
"""
import os
import re
import subprocess
import sys


def staged_files():
    out = subprocess.run(
        ["git", "-c", "core.quotepath=false", "diff", "--cached", "--name-only"],
        capture_output=True, text=True,
    )
    return [l for l in out.stdout.splitlines() if l.strip()]


def req_dirs(files):
    dirs = set()
    for f in files:
        m = re.match(r"^workspace/([^/]+)/", f)
        if m:
            dirs.add(m.group(1))
    return dirs


def main():
    if os.environ.get("DS_ALLOW_HUMAN") == "1":
        sys.exit(0)
    dirs = req_dirs(staged_files())
    if len(sys.argv) > 1:
        cur = sys.argv[1]
        others = dirs - {cur}
        if others:
            print(f"❌ 点名 add 拒绝：暂存含他需求目录 {sorted(others)}（当前={cur}）——"
                  "git add 具体文件路径；他需求文件归其节点提交（contract §2 暂存纪律）")
            sys.exit(1)
    elif len(dirs) >= 2:
        print(f"❌ 点名 add 拒绝：暂存混存 {len(dirs)} 个需求目录 {sorted(dirs)}——"
              "点名 add（git add 具体文件路径），他需求文件归其节点提交（contract §2 暂存纪律）")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
