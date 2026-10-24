#!/usr/bin/env python3
"""s1 状态并发冲突：协议层拒绝无权/非法跃迁（不依赖 git 冲突行为）"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from lib import check_transition, die, ok

cases = [
    # (agent, from, to, expect_allowed, 描述)
    ("cc-dev", "待修复", "已修复待验", True, "开发修复完成跃迁"),
    ("cc-dev", "已修复待验", "已验证", False, "开发写已验证——协议拒绝（核心红线）"),
    ("cursor-qa", "已修复待验", "已验证", True, "复验通过"),
    ("cursor-qa", "已修复待验", "待修复", True, "复验打回（reverify 同步已打回）"),
    ("cc-dev", "待确认", "已关闭", False, "开发无权关闭"),
    ("cc-dev", "待修复", "done", False, "六词之外的状态词拒绝"),
    ("cc-dev", "已验证", "待修复", False, "已验证不可回退"),
    ("human", "待修复", "已关闭", True, "human 关单（CR-004）"),
    ("human", "已修复待验", "作废", True, "human 作废（CR-004）"),
    ("human", "已验证", "待修复", False, "human 也不可回退已验证"),
]

fail = 0
for agent, cur, tgt, expect, desc in cases:
    allowed, reason = check_transition(agent, cur, tgt)
    if allowed != expect:
        print(f"❌ {desc}: got allowed={allowed} reason={reason}")
        fail += 1
    else:
        ok(f"{desc}")

# 模拟「第二次写入」场景：两个 agent 先后跃迁同一单，后者无权
a1, _ = check_transition("cc-dev", "待修复", "已修复待验")
a2, reason = check_transition("cc-dev", "已修复待验", "已验证")
if a1 and not a2:
    ok(f"第二次无权写入被协议拒绝: {reason}")
else:
    print(f"❌ 第二次写入拦截失败")
    fail += 1

sys.exit(1 if fail else 0)
