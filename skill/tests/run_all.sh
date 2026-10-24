#!/bin/bash
# F-10 回归入口（s1~s4 + B-05 增补 s5 + v2 增补 s6/s7 + D003-v3 增补 s9/s10/s11）：全绿为工具迭代/tag 前置条件
cd "$(dirname "$0")"
rc=0
for t in "s1-状态并发冲突.py" "s2-实例为空停.py" "s3-索引不一致检测.py" "s4-与旧体系隔离验证.sh" "s5-prepush新分支范围.py" "s6-复验方摘要校验.py" "s7-状态单写校验.py" "s8-workspace一致性检查.py" "s9-推进笔认可校验.py" "s10-点名add校验.py" "s11-盘点对账校验.py"; do
  echo "=== $t ==="
  if [[ $t == *.py ]]; then python3 "$t" || rc=1; else bash "$t" || rc=1; fi
done
if [ $rc -eq 0 ]; then echo "🎉 回归 11/11 绿"; else echo "💥 回归存在失败"; fi
exit $rc
