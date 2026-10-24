#!/usr/bin/env python3
"""F08 workspace 只读一致性检查（本地一条命令，不依赖企微/console）

用法：python3 skill/scripts/check_workspace.py [workspace根目录，默认=本仓 workspace/] [需求名]
  - 不带需求名：仅做既有全量一致性检查（行为与历史版本一致）
  - 带需求名（开工校验第 5 步，03 §3.3/§3.6）：追加两项需求级检查——
      E-dirty  他需求脏区（workspace/{他需求}/ 下有未提交改动）→ ERROR 拒开（禁止 reset 清盘，用逃生舱 worktree）
      B-profile current.md profile 与 services.yaml 口径（kind 显式优先 → F06 R1~R3 推断）不一致或判不定 → BLOCK 推 human（开好头原则 D004）
  - 全量模式新增 P-链校验（profile场景定制 03 §3.8，B2-A 建项冻结）：current.md phases 每项须属阶段库（链序自由、可跨库号——13 排 09 前合法）；含非库成员 → BLOCK
输出：逐项 ✅/❌（ERROR，计入退出码）与 ⛔（BLOCK 提示，不计入——等部署是正常业务态）
退出码：0=无 ERROR / 1=存在 ERROR（run_all 与 console 降级期共用）
"""
import os
import re
import sys

import yaml

TESTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests")
sys.path.insert(0, TESTS_DIR)
from lib import can_start_reverify, check_consistency, parse_reverify_row  # noqa: E402

CURRENT_FIELDS = {"name", "phase", "node", "terminal", "updated_at", "phases", "next"}


def load_stage_nodes(repo_root):
    try:
        cfg = yaml.safe_load(open(os.path.join(repo_root, "dev-swarm.yaml"), encoding="utf-8").read()) or {}
    except (OSError, yaml.YAMLError):
        return {}
    nodes = cfg.get("nodes") or {}
    out = {}
    for key in ("subnodes", "stages"):
        for name, _spec in (nodes.get(key) or {}).items():
            out[name] = key
    return out


def load_stage_orders(repo_root):
    """阶段库 → {阶段名: 库编号 order}（P-链校验用；order 缺失时按枚举序兜底）"""
    try:
        cfg = yaml.safe_load(open(os.path.join(repo_root, "dev-swarm.yaml"), encoding="utf-8").read()) or {}
    except (OSError, yaml.YAMLError):
        return {}
    out = {}
    for i, (name, spec) in enumerate(((cfg.get("nodes") or {}).get("stages") or {}).items(), 1):
        try:
            out[name] = int((spec or {}).get("order", i))
        except (TypeError, ValueError):
            out[name] = i
    return out


VALID_KINDS = ("toolchain", "java-business", "data-script")


def profile_block_reason(kind, inferred, cur_profile):
    """B-profile（K0 kind 优先 → R 推断）：返回 None=通过，否则 BLOCK 文案（03 §3.8）"""
    kind = str(kind or "").strip()
    inferred = str(inferred) if inferred else "判不定"
    if kind:
        if kind not in VALID_KINDS:
            return f"kind 非法值「{kind}」——合法枚举 {'|'.join(VALID_KINDS)}"
        if cur_profile and kind != cur_profile:
            return (f"profile 口径不一致——kind 声明={kind}，current.md={cur_profile}"
                    f"（规则推断={inferred}，kind 显式优先）；human 覆盖落 decisions 或改 current.md")
        return None
    if cur_profile and inferred == "判不定":
        return "profile 规则判不定（R3）——推 human 决策，落 decisions 后开工"
    if cur_profile and inferred != cur_profile:
        return (f"profile 口径不一致——规则推断={inferred}，current.md={cur_profile}；"
                "human 覆盖落 decisions 或改 current.md")
    return None


def chain_block_reason(ph_names, orders):
    """P-链（B2-A 建项冻结）：phases 须均属阶段库；链序自由（可跨库号——data-script 链 13 位于 09 前即合法），
    顺序正确性由建项时逐项复制 profile phases 保证；返回 None=通过，否则 BLOCK 文案"""
    if not isinstance(ph_names, list) or not ph_names:
        return None
    unknown = [n for n in ph_names if n not in orders]
    if unknown:
        return f"phases 含非阶段库成员 {unknown}——手写错误或库变更波及，推 human 落 decisions"
    return None


def parse_fm(text):
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
    try:
        return (yaml.safe_load(m.group(1)) or {}) if m else None
    except yaml.YAMLError:
        return "unparsable"


def check_current_md(repo_root, stage_nodes, req, req_dir, errors, blocks):
    p = os.path.join(req_dir, "_state", "current.md")
    if not os.path.exists(p):
        errors.append(f"{req}: _state/current.md 缺失")
        return
    fm = parse_fm(open(p, encoding="utf-8").read())
    if fm in (None, "unparsable"):
        errors.append(f"{req}: current.md frontmatter 缺失或不可解析")
        return
    missing = CURRENT_FIELDS - set(fm)
    if missing:
        errors.append(f"{req}: current.md 缺字段 {sorted(missing)}")
        return
    if fm["name"] != req:
        errors.append(f"{req}: current.md name≠目录名（{fm['name']}）")
    if str(fm["node"]) not in stage_nodes:
        errors.append(f"{req}: node「{fm['node']}」未命中 dev-swarm.yaml stages/subnodes")
    nxt = fm.get("next") or {}
    if not isinstance(nxt, dict) or not nxt.get("agent") or not nxt.get("action"):
        errors.append(f"{req}: next 缺 agent/action")
    if not isinstance(fm.get("phases"), list) or not all(
        isinstance(x, dict) and {"name", "completed"} <= set(x) for x in fm["phases"]
    ):
        errors.append(f"{req}: phases 结构非法（须为 [{name, completed}] 数组）")


def git_porcelain(repo_root):
    """git status --porcelain 行列表；git 不可用返回 None"""
    import subprocess

    try:
        out = subprocess.run(
            ["git", "-C", repo_root, "status", "--porcelain"],
            capture_output=True, text=True,
        )
    except OSError:
        return None
    return out.stdout.splitlines() if out.returncode == 0 else None


def dirty_other_reqs(lines, current_req):
    """E-dirty：从 porcelain 行提取他需求名（workspace/{他需求}/ 下脏路径的归属需求）"""
    reqs = set()
    for line in lines:
        s = line.strip()
        if len(s) <= 3:
            continue
        for part in s[3:].split("->"):  # 重命名两侧都算
            p = part.strip().strip('"')
            m = re.match(r"^workspace/([^/]+)/", p)
            if m and m.group(1) != current_req:
                reqs.add(m.group(1))
    return reqs


def infer_profile(services, repo_root):
    """F06 规则表（03 §3.6）：R1 任一 appid 非空→java-business；R2 local_path 全在本仓（或无 services）→toolchain；R3 判不定→None（推 human）"""
    if not services:
        return "toolchain"
    for sv in services:
        if str(sv.get("appid") or "").strip():
            return "java-business"
    root = os.path.realpath(repo_root)
    for sv in services:
        lp = str(sv.get("local_path") or "").strip()
        if lp:
            rp = os.path.realpath(lp)
            if rp != root and not rp.startswith(root + os.sep):
                return None
    return "toolchain"


def e_dirty_error(req, others):
    """E-dirty 拒开文案（F05/D003-v3）：他需求脏区时第二需求默认路径=worktree（含命令样例）"""
    return (f"{req}: 开工拒开——存在他需求脏区 {sorted(others)}"
            f"（禁止 reset 清盘；本需求默认进 worktree：git worktree add "
            f"../dev-swarm-workspace.wt/{req} -b wt/{req}，见 SPEC §1.1 / ops/05；或先让他需求收口）")


def check_req_startup(repo_root, ws_root, req, errors, blocks):
    """开工校验第 5 步「工作区自检」（03 §3.6）：E-dirty + B-profile"""
    req_dir = os.path.join(ws_root, req)
    if not os.path.isdir(req_dir):
        errors.append(f"{req}: 需求目录不存在（workspace/ 下无此目录）")
        return
    # E-dirty：他需求脏区 → 拒开（SPEC §1.1 收尾时序第 2 步）
    lines = git_porcelain(repo_root)
    if lines is None:
        errors.append(f"{req}: git status 不可用，脏区检查无法执行")
    else:
        others = dirty_other_reqs(lines, req)
        if others:
            errors.append(e_dirty_error(req, others))
    # B-profile：current.md profile 与 services.yaml 口径一致性（K0 kind 显式优先 → R1~R3 推断；开好头原则 D004）
    try:
        svc = yaml.safe_load(open(os.path.join(req_dir, "services.yaml"), encoding="utf-8").read()) or {}
    except (OSError, yaml.YAMLError):
        svc = None
    cm = os.path.join(req_dir, "_state", "current.md")
    fm = parse_fm(open(cm, encoding="utf-8").read()) if os.path.exists(cm) else None
    cur_profile = fm.get("profile") if isinstance(fm, dict) else None
    if svc is None:
        blocks.append(f"{req}: services.yaml 缺失或不可解析——profile 无法核对（R3：推 human 决策，落 decisions 后开工）")
        return
    kind = svc.get("kind")
    inferred = infer_profile(svc.get("services") or [], repo_root)
    reason = profile_block_reason(kind, inferred, cur_profile)
    if reason:
        blocks.append(f"{req}: {reason}")


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    ws_root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(repo_root, "workspace")
    req_name = sys.argv[2] if len(sys.argv) > 2 else None
    stage_nodes = load_stage_nodes(repo_root)
    stage_orders = load_stage_orders(repo_root)
    errors, blocks = [], []
    reqs = sorted(d for d in os.listdir(ws_root) if os.path.isdir(os.path.join(ws_root, d))) if os.path.isdir(ws_root) else []

    for req in reqs:
        req_dir = os.path.join(ws_root, req)
        # ① INDEX vs status.md（双向；无 bug 目录视为无缺陷，跳过）
        if os.path.isdir(os.path.join(req_dir, "bug")):
            issues = check_consistency(req_dir)
            for i in issues:
                errors.append(f"{req}: {i}")
        # ② reverify.md 行格式与停条件标记
        rv = os.path.join(req_dir, "reverify.md")
        if os.path.exists(rv):
            for ln, line in enumerate(open(rv, encoding="utf-8"), 1):
                s = line.strip()
                if not s.startswith("|") or set(s) <= set("|- "):
                    continue
                cells0 = s.strip("|").split("|")
                if cells0 and cells0[0].strip() == "单号":
                    continue
                row = parse_reverify_row(s)
                if row is None:
                    errors.append(f"{req}: reverify.md 第{ln}行非九数据列（schema v2）")
                    continue
                ok, reason = can_start_reverify(row)
                if not ok and "停" in reason:
                    blocks.append(f"{req}: {row['id']} {reason}")
        # ③ current.md 合法性
        check_current_md(repo_root, stage_nodes, req, req_dir, errors, blocks)
        # ④ P-链（B2-A 建项冻结）：phases 均属阶段库即过（链序自由可跨库号，不判单调、不与 profile yaml 比对——03 §3.8）
        cm4 = os.path.join(req_dir, "_state", "current.md")
        if os.path.exists(cm4):
            fm4 = parse_fm(open(cm4, encoding="utf-8").read())
            if isinstance(fm4, dict):
                ph4 = [p.get("name") for p in (fm4.get("phases") or []) if isinstance(p, dict)]
                creason = chain_block_reason(ph4, stage_orders)
                if creason:
                    blocks.append(f"{req}: [P-链] {creason}")

    # ⑤/⑥ 带需求名时：开工级检查（E-dirty + B-profile）
    if req_name:
        check_req_startup(repo_root, ws_root, req_name, errors, blocks)

    for b in blocks:
        print(f"⛔ BLOCK {b}")
    if errors:
        for e in errors:
            print(f"❌ {e}")
        print(f"💥 workspace 一致性检查未过（{len(errors)} 项 ERROR）")
        sys.exit(1)
    print(f"✅ workspace 一致性检查通过（{len(reqs)} 需求，{len(blocks)} 项 BLOCK 提示）")
    sys.exit(0)


if __name__ == "__main__":
    main()
