#!/usr/bin/env python3
"""s11：F04/D003-v3 盘点对账（check_inventory.py）

五场景（临时目录+夹具 01）：
① 声明计数=实际 → 过
② 声明计数错（3 文件声明 4）→ 拒（C4：故意写错的计数夹具失败）
③ 同错计数 + --drift-tolerant → 过（04 复核容差，输出时点漂移）
④ 命令越白名单（sh/curl）→ 拒（安全，不容差）
⑤ 块格式错（缺声明）→ 拒
"""
import os
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CLI = os.path.join(REPO, "skill", "scripts", "check_inventory.py")


def block(cmd, declared=None):
    s = f"```inventory\ncmd: {cmd}\n当轮输出: （人读留痕）\n"
    if declared is not None:
        s += f"声明: {declared}\n"
    return s + "```\n"


def check(doc, *args):
    return subprocess.run([sys.executable, CLI, doc, *args], capture_output=True, text=True)


def main():
    tmp = tempfile.mkdtemp(prefix="ds-s11-")
    try:
        data = os.path.join(tmp, "data")
        os.makedirs(data)
        for i in range(3):
            open(os.path.join(data, f"f{i}.md"), "w", encoding="utf-8").write("x\n")
        doc = os.path.join(tmp, "01-需求分析.md")

        open(doc, "w", encoding="utf-8").write("# 01\n\n## 盘点\n\n" + block(f"find {data} -type f", 3))
        r1 = check(doc)
        ok1 = r1.returncode == 0 and "对账通过" in r1.stdout
        print(("✅" if ok1 else "❌") + " ① 声明=实际 → 过")
        if not ok1:
            print(r1.stdout, r1.stderr)

        open(doc, "w", encoding="utf-8").write("# 01\n\n" + block(f"find {data} -type f", 4))
        r2 = check(doc)
        ok2 = r2.returncode != 0 and "计数不符" in r2.stdout
        print(("✅" if ok2 else "❌") + " ② 声明 4≠实际 3 → 拒")
        if not ok2:
            print(r2.stdout, r2.stderr)

        r3 = check(doc, "--drift-tolerant")
        ok3 = r3.returncode == 0 and "时点漂移" in r3.stdout
        print(("✅" if ok3 else "❌") + " ③ 容差模式：错计数 → 漂移放行")
        if not ok3:
            print(r3.stdout, r3.stderr)

        open(doc, "w", encoding="utf-8").write("# 01\n\n" + block(f"sh -c 'echo pwned' {data}", 1))
        r4 = check(doc, "--drift-tolerant")
        ok4 = r4.returncode != 0 and "白名单" in r4.stdout
        print(("✅" if ok4 else "❌") + " ④ 命令越白名单 → 拒（容差不豁免安全）")
        if not ok4:
            print(r4.stdout, r4.stderr)

        open(doc, "w", encoding="utf-8").write("# 01\n\n" + block(f"find {data} -type f"))
        r5 = check(doc)
        ok5 = r5.returncode != 0 and "格式错" in r5.stdout
        print(("✅" if ok5 else "❌") + " ⑤ 缺声明行 → 拒")
        if not ok5:
            print(r5.stdout, r5.stderr)

        sys.exit(0 if (ok1 and ok2 and ok3 and ok4 and ok5) else 1)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
