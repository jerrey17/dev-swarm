#!/usr/bin/env python3
"""s3 索引不一致检测：INDEX vs status.md 状态词不一致可被检出（console 阻塞视图数据源）"""
import sys
import os
import tempfile
import shutil
sys.path.insert(0, os.path.dirname(__file__))
from lib import check_consistency, ok

base = tempfile.mkdtemp(prefix="s3-")
bug = os.path.join(base, "bug")
os.makedirs(os.path.join(bug, "BUG-001"))
os.makedirs(os.path.join(bug, "BUG-002"))

open(os.path.join(bug, "BUG-001", "status.md"), "w").write("---\nid: BUG-001\nstatus: 已验证\nupdated_at: 2026-10-03T10:00:00+08:00\n---\n")
open(os.path.join(bug, "BUG-002", "status.md"), "w").write("---\nid: BUG-002\nstatus: 已修复待验\nupdated_at: 2026-10-03T10:00:00+08:00\n---\n")
# INDEX 与 BUG-002 不一致（INDEX=已验证，status=已修复待验）
open(os.path.join(bug, "INDEX.md"), "w").write("| 单号 | 现象摘要 | 状态 | 环境 |\n|---|---|---|---|\n| BUG-001 | x | 已验证 | 测试 |\n| BUG-002 | y | 已验证 | 测试 |\n")

issues = check_consistency(base)
if len(issues) == 1 and "BUG-002" in issues[0] and "已修复待验" in issues[0]:
    ok(f"不一致被检出: {issues[0]}")
    rc = 0
else:
    print(f"❌ 检测结果不符: {issues}")
    rc = 1

shutil.rmtree(base)
sys.exit(rc)
