"""dev-swarm 协议检查库：跃迁权限 / 开工校验 / 台账一致性（F-10 回归共用）"""
import os
import re
import sys

STATUSES = ["待确认", "待修复", "已修复待验", "已验证", "已关闭", "作废"]
REVERIFY_ROW_STATES = ["待复验", "已复验", "已打回"]

# (agent, from, to) -> 允许。「已验证」只归复验方；打回归复验方；作废/已关闭由 human 拍板（CR-004 补全）
TRANSITIONS = {
    ("cc-dev", "待确认", "待修复"): True,
    ("cc-dev", "待修复", "已修复待验"): True,
    ("cursor-qa", "已修复待验", "已验证"): True,
    ("cursor-qa", "已修复待验", "待修复"): True,   # 打回：reverify 行同步「已打回」
    ("human", "待确认", "作废"): True,
    ("human", "待确认", "已关闭"): True,
    ("human", "待修复", "作废"): True,
    ("human", "待修复", "已关闭"): True,
    ("human", "已修复待验", "作废"): True,
    ("human", "已修复待验", "已关闭"): True,
    ("human", "已验证", "已关闭"): True,
}


def check_transition(agent, cur, target):
    """返回 (allowed, reason)。协议拒绝 = 返回 False + 原因，不靠 git 冲突。"""
    if cur not in STATUSES or target not in STATUSES:
        return False, f"非法状态词（六词之外）: {cur} -> {target}"
    if TRANSITIONS.get((agent, cur, target)):
        return True, ""
    if target == "已验证" and agent != "cursor-qa":
        return False, f"协议拒绝：{agent} 写「已验证」——已验证只由复验节点写"
    return False, f"无权跃迁: {agent} 不可执行 {cur} -> {target}"


def parse_reverify_row(line):
    """解析 reverify.md 表格行 -> dict（单号/代码根/commit/数据根/复验动作/期望/实际/实例/状态，schema v2 九列）"""
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) != 9:
        return None
    return dict(zip(["id", "repo", "commit", "data_root", "point", "expect", "actual", "instance", "state"], cells))


def can_start_reverify(row):
    """开工校验：实例为空 -> 停（V1 语义）；数据根为空 -> 停（v2 新增）；「无」=显式不涉及，不停"""
    if row is None:
        return False, "reverify 行格式非法（九列）"
    if row["state"] != "待复验":
        return False, f"行状态非待复验: {row['state']}"
    if not row["instance"]:
        return False, f"实例为空：测试节点停（{row['id']}），写阻塞原因，不猜 IP"
    if not row["data_root"]:
        return False, f"数据根为空：测试节点停（{row['id']}）（v2 新增停条件）"
    return True, ""


def parse_status(path):
    """status.md frontmatter -> {'id','status'}"""
    text = open(path, encoding="utf-8").read()
    m_id = re.search(r"^id:\s*(\S+)", text, re.M)
    m_st = re.search(r"^status:\s*(\S+)", text, re.M)
    if not m_id or not m_st:
        return None
    return {"id": m_id.group(1), "status": m_st.group(1)}


def parse_index(path):
    """INDEX.md 表格 -> [{id, status}]"""
    rows = []
    for line in open(path, encoding="utf-8"):
        if line.startswith("|") and not set(line.strip()) <= set("|- 哈油"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) >= 3 and cells[0] not in ("单号",):
                rows.append({"id": cells[0], "status": cells[2]})
    return rows


def check_consistency(req_dir):
    """INDEX vs 各 status.md 一致性 -> [不一致项]（console 阻塞视图同源逻辑；双向）"""
    issues = []
    bug_dir = os.path.join(req_dir, "bug")
    index_rows = {r["id"]: r["status"] for r in parse_index(os.path.join(bug_dir, "INDEX.md"))}
    seen = set()
    for name in sorted(os.listdir(bug_dir)):
        if not name.startswith("BUG-"):
            continue
        st = parse_status(os.path.join(bug_dir, name, "status.md"))
        idx = index_rows.get(st["id"] if st else name)
        if st is not None:
            seen.add(st["id"])
        if st is None:
            issues.append(f"{name}/status.md 解析失败")
        elif idx is None:
            issues.append(f"INDEX 缺行: {st['id']}")
        elif idx != st["status"]:
            issues.append(f"状态不一致: {st['id']} INDEX={idx} status={st['status']}")
    # 反向：INDEX 有行但 status.md 缺失
    for bid in index_rows:
        if bid not in seen:
            issues.append(f"INDEX 多行/缺 status.md: {bid}")
    return issues


def die(msg):
    print(f"❌ {msg}")
    sys.exit(1)


def ok(msg):
    print(f"✅ {msg}")
