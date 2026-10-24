#!/usr/bin/env python3
"""
scan_terms.py — 技术文档变更后术语扫描（dev-workflow 配套）

用途：方案变更执行后的自检工具。输入变更主题，自动展开关键词变体（大小写/camelCase/中文同义/专名），
全量扫描 workflow/{需求名}/ 目录，输出命中清单供人工逐条判定（合理引用保留 / 真实残留修复）。

解决痛点：变更后 grep 单一关键词容易漏检同义词变体（如 Pub/Sub → pubSub → publish → 订阅 → status_change）。

用法：
  # 内置概念（pubsub / ttl / redis-key / ...）
  python3 scan_terms.py --dir workflow/{需求名} --concept pubsub

  # 自定义关键词 + 手动补变体
  python3 scan_terms.py --dir workflow/{需求名} --concept "窗口样例" --extra "800成功,200成功,80%"

  # 排除合理引用（版本记录历史行、说明性引用）
  python3 scan_terms.py --dir workflow/{需求名} --concept pubsub --exclude "V2\\.[0-9]|替代|不发布|废弃|历史"

退出码：0 正常完成；2 参数/目录错误。
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# 内置概念变体库：概念名 → 关键词变体列表（大小写不敏感匹配，无需重复大小写变体）
CONCEPT_TERMS: dict[str, list[str]] = {
    # Redis Pub/Sub 相关：正文写法 + camelCase + 伪代码调用 + 中文同义 + 专名
    "pubsub": [
        "Pub/Sub", "PubSub", "pubSub", "pubsub", "publish", "publishes",
        "subscribe", "subscribes", "订阅", "监听", "发布", "消息通知",
        "status_change", "statusChange", "onBreak", "onRestore",
    ],
    # Redis 计数桶 TTL
    "ttl": [
        "TTL", "ttl", "过期时间", "expire", "expireAfterWrite",
        "ofMinutes", "Duration.of",
    ],
    # Redis 计数 Key
    "redis-key": [
        "sms:cb:", "RAtomicLong", "AtomicLong", "addAndGet", "minuteBucket",
        "分钟桶",
    ],
    # 表名 / 字段（变更表结构时用）
    "schema": [
        "t_sms_circuit_breaker", "FuiStatus", "FuiWindowSize", "FuiAccountId",
    ],
    # 定时任务
    "scheduler": [
        "@Scheduled", "Scheduled", "Saturn", "定时任务", "定时轮询", "轮询",
        "每 60s", "每分钟",
    ],
    # 版本号残留（检查旧版本号是否漏改，concept 传具体版本号时用 --extra）
    "version": ["v2.", "V2.", "版本"],
}

SKIP_DIRS = {"node_modules", ".git", "target", "build", "dist", "out", ".idea", ".gradle", "learned-codebase", "history"}


def collect_md_files(root: Path) -> list[Path]:
    files = []
    for p in sorted(root.rglob("*")):
        if p.is_dir():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.suffix.lower() == ".md":
            files.append(p)
    return files


def expand_concept(concept: str, extra: list[str]) -> list[str]:
    if concept in CONCEPT_TERMS:
        terms = list(CONCEPT_TERMS[concept])
    else:
        terms = [concept]
    terms += [t for t in extra if t]
    return terms


def main() -> int:
    ap = argparse.ArgumentParser(description="技术文档变更后术语扫描")
    ap.add_argument("--dir", required=True, help="要扫描的目录（如 workflow/{需求名}）")
    ap.add_argument("--concept", required=True, help="内置概念名（pubsub/ttl/redis-key/schema/scheduler/version）或自定义关键词")
    ap.add_argument("--extra", default="", help="额外变体，逗号分隔")
    ap.add_argument("--exclude", default="", help="排除正则（命中行不输出，如版本记录历史行）")
    ap.add_argument("--max-len", type=int, default=160, help="输出行内容最大长度")
    args = ap.parse_args()

    root = Path(args.dir).expanduser().resolve()
    if not root.is_dir():
        print(f"[error] 目录不存在: {root}", file=sys.stderr)
        return 2

    terms = expand_concept(args.concept, [t.strip() for t in args.extra.split(",") if t.strip()])
    exclude_re = re.compile(args.exclude) if args.exclude else None

    files = collect_md_files(root)
    if not files:
        print(f"[warn] 目录下未找到 .md 文件: {root}", file=sys.stderr)

    print(f"== 扫描概念: {args.concept}（{len(terms)} 个变体） ==")
    print(f"   变体: {', '.join(terms)}")
    if exclude_re:
        print(f"   排除正则: {args.exclude}")
    print()

    hit_files = 0
    total_hits = 0
    excluded_hits = 0
    for f in files:
        rel = f.relative_to(root)
        file_hits = []
        try:
            lines = f.read_text(encoding="utf-8").splitlines()
        except Exception as e:
            print(f"[warn] 无法读取 {rel}: {e}", file=sys.stderr)
            continue
        for i, line in enumerate(lines, 1):
            low = line.lower()
            matched = [t for t in terms if t.lower() in low]
            if not matched:
                continue
            if exclude_re and exclude_re.search(line):
                excluded_hits += 1
                continue
            snippet = line.strip()[: args.max_len]
            file_hits.append(f"  {rel}:{i} | {snippet}  <== {','.join(matched[:3])}")
        if file_hits:
            hit_files += 1
            total_hits += len(file_hits)
            print("\n".join(file_hits))

    print()
    print(f"== 结果: {total_hits} 处命中（{hit_files} 个文件），排除 {excluded_hits} 处 ==")
    print("== 判定规则：合理引用（版本记录历史行/说明性引用如『替代 Pub/Sub』）保留；真实残留修复 ==")
    return 0


if __name__ == "__main__":
    sys.exit(main())
