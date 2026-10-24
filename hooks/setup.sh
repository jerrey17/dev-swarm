#!/bin/bash
# 安装仓内 hooks（git hook 默认不随 clone 生效）
set -e
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath hooks
chmod +x hooks/pre-push hooks/pre-commit 2>/dev/null || true
echo "✅ core.hooksPath=hooks 已设置，pre-push（Approved-by: human 拦截）生效"
