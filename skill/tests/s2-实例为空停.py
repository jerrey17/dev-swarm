#!/usr/bin/env python3
"""s2 停条件：实例空停（V1 语义不改）+ 数据根空停/「无」不停（v2 只增）"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from lib import parse_reverify_row, can_start_reverify, die, ok

# schema v2 九列：单号|代码根|commit|数据根|复验动作|期望|实际|实例|状态
rows = [
    ("| BUG-062 | /p/atm | abc1234 | /d/clone | 上传 URL | URL 无前缀 |  | 10.0.0.8:8080 | 待复验 |", True, "实例齐全可开工"),
    ("| BUG-063 | /p/e-seal | def5678 | /d/clone | 回调落库 | 字段X落库 |  |  | 待复验 |", False, "实例为空必须停"),
    ("| BUG-064 | /p/atm | aaa0000 | /d/clone | 前缀 | URL 无前缀 |  | 10.1.1.1 | 已复验 |", False, "非待复验状态不开工"),
    ("| BUG-065 | /p/atm | bbb1111 |  | 前缀 | URL 无前缀 |  | 10.1.1.1 | 待复验 |", False, "数据根为空必须停(v2)"),
    ("| BUG-066 | /p/tool | ccc2222 | 无 | 本地跑 run_all | 退出码 0 |  | 无 | 待复验 |", True, "实例/数据根「无」=不涉及可开工(v2)"),
    ("| BUG-067 | /p/old | ddd3333 | 10.1.1.1 | 旧六列 | 待复验 |", False, "六列旧行格式非法不开工"),
]

fail = 0
for line, expect_start, desc in rows:
    row = parse_reverify_row(line)
    startable, reason = can_start_reverify(row)
    if startable != expect_start:
        print(f"❌ {desc}: startable={startable} ({reason})")
        fail += 1
    elif not expect_start and reason:
        ok(f"{desc}: {reason}")
    else:
        ok(desc)

sys.exit(1 if fail else 0)
