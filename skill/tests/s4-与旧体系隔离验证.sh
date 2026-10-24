#!/bin/bash
# s4 与旧体系隔离：双向扫描互不命中（_state/ 命名承载隔离约束②）
set -u
TMP=$(mktemp -d /tmp/s4-XXXXXX)
trap 'rm -rf "$TMP"' EXIT

# 构造：新体系需求 + 旧体系需求 各一
mkdir -p "$TMP/workspace/新需求A/_state" "$TMP/.claude/workflow/旧需求B"
echo "phase: x" > "$TMP/workspace/新需求A/_state/current.md"
echo "phase: y" > "$TMP/.claude/workflow/旧需求B/current.md"

rc=0
# 旧体系扫描模式 **/.claude/workflow/*/current.md —— 不得命中新体系
OLD_HITS=$(find "$TMP" -path '*/.claude/workflow/*/current.md' 2>/dev/null)
if echo "$OLD_HITS" | grep -q '新需求A'; then
  echo "❌ 旧扫描命中了新体系需求"; rc=1
else
  echo "✅ 旧扫描（dev-workflow/claude-board 模式）不命中 _state/"
fi

# 新体系扫描模式 workspace/*/_state/current.md —— 不得命中旧体系
NEW_HITS=$(find "$TMP/workspace" -name current.md -path '*/_state/*' 2>/dev/null)
if echo "$NEW_HITS" | grep -q '旧需求B'; then
  echo "❌ 新扫描命中了旧体系需求"; rc=1
else
  echo "✅ 新扫描只认 workspace/*/_state/，不含旧 .claude/workflow/"
fi

# 双向列表完整性
[ "$(echo "$OLD_HITS" | grep -c current.md)" -eq 1 ] || { echo "❌ 旧扫描应恰命中旧需求 1 个"; rc=1; }
[ "$(echo "$NEW_HITS" | grep -c current.md)" -eq 1 ] || { echo "❌ 新扫描应恰命中新需求 1 个"; rc=1; }

exit $rc
