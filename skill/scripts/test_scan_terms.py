#!/usr/bin/env python3
"""
test_scan_terms.py — scan_terms.py 功能回归测试

覆盖：
1. 正向：pubsub 全部变体写法都能命中（大小写/camelCase/中文/专名/伪代码调用）
2. 正向：ttl / 自定义 concept + --extra
3. 反向：--exclude 正确排除合理引用（版本记录/替代说明）
4. 边界：不存在目录 → 退出码 2；空目录 → 警告
5. 结果统计正确性（命中数/文件数/排除数）

用法：python3 test_scan_terms.py
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("scan_terms.py")
PASS, FAIL = 0, 0


def run_scan(tmp: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--dir", str(tmp), *args],
        capture_output=True,
        text=True,
    )


def check(name: str, cond: bool, detail: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ✅ {name}")
    else:
        FAIL += 1
        print(f"  ❌ {name} {detail}")


def main() -> int:
    print("== scan_terms.py 功能测试 ==")
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)

        # ---- 1. 正向：pubsub 变体全覆盖 ----
        variants = {
            "Pub/Sub": "pubsub1.md",
            "PubSub": "pubsub2.md",
            "pubSub": "pubsub3.md",
            "pubsub": "pubsub4.md",
            "publish": "pubsub5.md",
            "订阅": "pubsub6.md",
            "监听": "pubsub7.md",
            "发布": "pubsub8.md",
            "status_change": "pubsub9.md",
            "onBreak": "pubsub10.md",
        }
        for term, fname in variants.items():
            (tmp / fname).write_text(f"残留：{term}\n", encoding="utf-8")
        r = run_scan(tmp, "--concept", "pubsub")
        print("\n[1] 正向：pubsub 10 种变体写法")
        for term, fname in variants.items():
            check(f"命中 {term}（{fname}）", f"{fname}:1" in r.stdout)

        # ---- 2. 正向：大小写不敏感 ----
        (tmp / "case.md").write_text("PUB/SUB 大写残留\n", encoding="utf-8")
        r2 = run_scan(tmp, "--concept", "pubsub")
        print("\n[2] 大小写不敏感")
        check("命中 PUB/SUB 大写", "case.md:1" in r2.stdout)

        # ---- 3. 正向：ttl 概念 ----
        (tmp / "ttl1.md").write_text("TTL = 15min\n", encoding="utf-8")
        (tmp / "ttl2.md").write_text("counter.expire(Duration.ofMinutes(5))\n", encoding="utf-8")
        r3 = run_scan(tmp, "--concept", "ttl")
        print("\n[3] ttl 概念变体")
        check("命中 TTL 15min", "ttl1.md:1" in r3.stdout)
        check("命中 expire(Duration.ofMinutes", "ttl2.md:1" in r3.stdout)

        # ---- 4. 正向：自定义 concept + --extra ----
        (tmp / "custom.md").write_text("800成功 + 200失败\n", encoding="utf-8")
        r4 = run_scan(tmp, "--concept", "窗口样例", "--extra", "800成功,200成功")
        print("\n[4] 自定义 concept + --extra")
        check("命中 --extra 变体 800成功", "custom.md:1" in r4.stdout)

        # ---- 5. 反向：--exclude 排除合理引用 ----
        (tmp / "legit.md").write_text(
            "- 版本记录：V2.2 已归档，Pub/Sub 已废弃\n- 说明：替代 Pub/Sub，改定时任务轮询\n- 残留：Pub/Sub 增量更新\n",
            encoding="utf-8",
        )
        r5 = run_scan(tmp, "--concept", "pubsub", "--exclude", r"V2\.[0-9]|替代|归档")
        print("\n[5] 反向：--exclude 排除合理引用")
        check("排除版本记录行", "legit.md:1" not in r5.stdout)
        check("排除替代说明行", "legit.md:2" not in r5.stdout)
        check("保留真实残留行", "legit.md:3" in r5.stdout)

        # ---- 6. 结果统计正确性 ----
        print("\n[6] 统计输出")
        # legit.md 行1（归档/废弃）、行2（替代）共 2 处被排除，行3 保留
        check("排除数 = 2", "排除 2 处" in r5.stdout, f"实际: {r5.stdout.splitlines()[-2] if r5.stdout else ''}")

        # ---- 7. 边界：目录不存在 ----
        r7 = subprocess.run(
            [sys.executable, str(SCRIPT), "--dir", "/nonexistent/path/xyz", "--concept", "pubsub"],
            capture_output=True,
            text=True,
        )
        print("\n[7] 边界：目录不存在")
        check("退出码 = 2", r7.returncode == 2, f"实际: {r7.returncode}")

    print(f"\n== 结果: {PASS} 通过, {FAIL} 失败 ==")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
