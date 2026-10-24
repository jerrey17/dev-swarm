#!/usr/bin/env python3
"""F04 盘点对账检查（D003-v3）

解析 01（或任意产物文档）中的 ```inventory 围栏块，重放命令比对声明计数。
块格式（ops/01 定义）：
    ```inventory
    cmd: find /abs/path -maxdepth 1 -type f -name "*.md"
    当轮输出：（可选行，人读留痕，脚本忽略）
    声明: 2
    ```
规则：
  - 命令白名单=find / ls（只读列表；禁止把围栏内容交给任意 shell——硬校验，不容差）
  - 重放命令取非空输出行数 vs 声明计数；不符默认 exit 1
  - --drift-tolerant：04 复核模式——不符输出「时点漂移」不判失败（文件已合法变更属正常）
  - 块格式错（无 cmd/无声明/声明非整数）= exit 1（不容差）
命令以仓库根为 cwd（01 书写约定：绝对路径或仓库根相对路径）。
用法：python3 check_inventory.py <01文档路径> [--drift-tolerant]
退出码：0=全对（或容差模式全漂移）/ 1=格式错|越白名单|计数不符
"""
import os
import re
import shlex
import subprocess
import sys

BLOCK_RE = re.compile(r"```inventory\n(.*?)```", re.S)
DANGEROUS = re.compile(r"[;|&`$()<>\n]")


def repo_root(path):
    d = os.path.dirname(os.path.abspath(path))
    r = subprocess.run(["git", "-C", d, "rev-parse", "--show-toplevel"],
                       capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else d


def parse_blocks(text):
    """返回 [(cmd, declared, block_lineno)]；格式错项以 ("!fmt", 描述, 行号) 入列"""
    out = []
    for m in BLOCK_RE.finditer(text):
        lineno = text[:m.start()].count("\n") + 1
        cmd = declared = None
        for ln in m.group(1).splitlines():
            s = ln.strip()
            if s.startswith("cmd:"):
                cmd = s[4:].strip()
            elif s.startswith("声明:") or s.startswith("声明："):
                v = s.split(":", 1)[-1].split("：", 1)[-1].strip()
                declared = v
        if not cmd or declared is None or not declared.isdigit():
            out.append(("!fmt", f"cmd={cmd} 声明={declared}", lineno))
        else:
            out.append((cmd, int(declared), lineno))
    return out


def main():
    if len(sys.argv) < 2:
        print("用法: check_inventory.py <文档路径> [--drift-tolerant]")
        sys.exit(1)
    doc = sys.argv[1]
    tolerant = "--drift-tolerant" in sys.argv[2:]
    text = open(doc, encoding="utf-8").read()
    blocks = parse_blocks(text)
    if not blocks:
        print("❌ 未发现 ```inventory 围栏块（01 声称文件数/清单时必须留对账块，ops/01）")
        sys.exit(1)
    root = repo_root(doc)
    bad = drift = 0
    for cmd, declared, lineno in blocks:
        if cmd == "!fmt":
            print(f"❌ 第{lineno}行块格式错：{declared}（须 cmd:/声明: 且声明为整数）")
            bad += 1
            continue
        if not re.match(r"^(find|ls)(\s|$)", cmd) or DANGEROUS.search(cmd):
            print(f"❌ 第{lineno}行命令越白名单（仅 find/ls 且无 shell 元字符）：{cmd}")
            bad += 1
            continue
        r = subprocess.run(shlex.split(cmd), cwd=root, capture_output=True, text=True)
        actual = len([l for l in r.stdout.splitlines() if l.strip()])
        if actual == declared:
            print(f"✅ 第{lineno}行对账通过：声明 {declared} = 实际 {actual}")
        else:
            msg = f"第{lineno}行计数不符：声明 {declared} ≠ 实际 {actual}（cmd: {cmd}）"
            if tolerant:
                print(f"⚠️ 时点漂移（容差放行，04 复核）：{msg}")
                drift += 1
            else:
                print(f"❌ {msg}")
                bad += 1
    if bad:
        sys.exit(1)
    print(f"对账完成（通过 {len(blocks) - drift - bad}，漂移 {drift}，失败 {bad}）")
    sys.exit(0)


if __name__ == "__main__":
    main()
