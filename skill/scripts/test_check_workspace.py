#!/usr/bin/env python3
"""
test_check_workspace.py — check_workspace.py 需求级检查回归测试（F04/F06，03 §3.6；C4/C7）

覆盖：
1. dirty_other_reqs：他需求脏路径命中 / 本需求与非 workspace 路径不命中 / 重命名两侧都算
2. infer_profile：R1（appid 非空→java-business）/ R2（local_path 全本仓或无 services→toolchain）/ R3（仓外无 appid→None）
3. 实跑：本仓干净态带需求名=退出 0；伪造他需求脏文件=退出 1 且指名；不存在的需求名=退出 1
4. 无参回归：不带需求名行为不变（退出 0）
5. B-profile：profile 不一致 → BLOCK（退出码仍 0，BLOCK 不计入）

用法：python3 test_check_workspace.py（在 skill/scripts/ 下执行）
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("check_workspace.py")
sys.path.insert(0, str(SCRIPT.parent))
import check_workspace as cw  # noqa: E402

PASS, FAIL = 0, 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ✅ {name}")
    else:
        FAIL += 1
        print(f"  ❌ {name} {detail}")


def run_cw(ws_root: str, req: str | None = None) -> subprocess.CompletedProcess:
    cmd = [sys.executable, str(SCRIPT), str(ws_root)]
    if req:
        cmd.append(req)
    return subprocess.run(cmd, capture_output=True, text=True)


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    print("== 1. dirty_other_reqs ==")
    lines = [
        " M workspace/需求A/01-需求分析.md",
        " M workspace/需求B/_state/current.md",
        "?? workspace/需求B/新文件.md",
        " M skill/adapters/cc/SKILL.md",
        "R  workspace/需求A/旧.md -> workspace/需求C/新.md",
        " M workspace/需求A",
    ]
    got = cw.dirty_other_reqs(lines, "需求A")
    check("他需求 B/C 命中、本需求与非 workspace 路径不命中", got == {"需求B", "需求C"}, f"got={got}")
    check("当前需求自身脏区不算他需求", cw.dirty_other_reqs([" M workspace/需求A/x.md"], "需求A") == set())

    print("== 2. infer_profile（F06 R1~R3）==")
    check("R1 appid 非空 → java-business", cw.infer_profile([{"appid": "pay.user.srv", "local_path": str(repo_root)}], repo_root) == "java-business")
    check("R2 local_path 全本仓 → toolchain", cw.infer_profile([{"appid": "", "local_path": str(repo_root)}], repo_root) == "toolchain")
    check("R2 无 services → toolchain", cw.infer_profile([], repo_root) == "toolchain")
    check("R3 仓外 local_path 且无 appid → None", cw.infer_profile([{"appid": "", "local_path": "/tmp/other-repo"}], repo_root) is None)

    print("== 3. 实跑（夹具，不依赖已有需求目录）==")
    ws = repo_root / "workspace"
    home = ws / "demo-req-a"
    other = ws / "demo-req-b"
    current = """---
name: "{name}"
phase: 需求分析
node: 需求分析
profile: toolchain
terminal: false
updated_at: "2026-10-24T00:00:00+08:00"
phases: []
next:
  agent: cc-dev
  action: x
  blockers: []
---
"""
    services = (
        "kind: toolchain\nservices:\n  - name: demo\n    appid: \"\"\n"
        f"    local_path: {repo_root}\n    role: 主责\n"
    )

    def make_req(path: Path, name: str) -> None:
        (path / "_state").mkdir(parents=True, exist_ok=True)
        (path / "_state" / "current.md").write_text(current.format(name=name), encoding="utf-8")
        (path / "services.yaml").write_text(services, encoding="utf-8")

    try:
        make_req(home, "demo-req-a")
        r = run_cw(str(ws), "demo-req-a")
        check("干净态+profile 一致（toolchain）→ 退出 0", r.returncode == 0, r.stdout[-400:])
        make_req(other, "demo-req-b")
        (other / ".tmp_dirty_test_e2e").write_text("tmp", encoding="utf-8")
        r = run_cw(str(ws), "demo-req-a")
        check("他需求脏区 → 退出 1 且指名拒开", r.returncode == 1 and "demo-req-b" in r.stdout and "拒开" in r.stdout, r.stdout[-400:])
    finally:
        import shutil
        for path in (home, other):
            if path.exists():
                shutil.rmtree(path)
    r = run_cw(str(repo_root / "workspace"), "不存在的需求")
    check("需求目录不存在 → 退出 1", r.returncode == 1 and "不存在" in r.stdout)

    print("== 4. 无参回归 ==")
    r = subprocess.run([sys.executable, str(SCRIPT), str(repo_root / "workspace")], capture_output=True, text=True)
    check("无需求名 → 退出 0（历史行为不变）", r.returncode == 0, r.stdout[-200:])

    print("== 5. B-profile（BLOCK 不计退出码）==")
    with tempfile.TemporaryDirectory() as td:
        tdp = Path(td)
        (tdp / "_state").mkdir()
        (tdp / "services.yaml").write_text(
            "services:\n  - name: dev-swarm-workspace\n    appid: \"\"\n"
            f"    local_path: {repo_root}\n    role: 主责\n", encoding="utf-8")
        (tdp / "_state" / "current.md").write_text(
            "---\nname: fixture\nphase: 需求分析\nnode: 需求分析\nprofile: java-business\nnext: {agent: cc-dev, action: x, blockers: []}\n"
            "terminal: false\nupdated_at: \"2026-10-09T00:00:00+08:00\"\nphases: []\n---\n", encoding="utf-8")
        fm = cw.parse_fm((tdp / "_state" / "current.md").read_text(encoding="utf-8"))
        inferred = cw.infer_profile([{"appid": "", "local_path": str(repo_root)}], repo_root)
        check("夹具：规则推断 toolchain ≠ current.md java-business → 应产 BLOCK", inferred == "toolchain" and fm["profile"] == "java-business")

    print("== 6. worktree 逃生舱语义（03 已知缺口实证：worktree 内只见本 worktree 改动）==")
    with tempfile.TemporaryDirectory() as td:
        main = Path(td) / "main"
        (main / "workspace" / "需求A").mkdir(parents=True)
        (main / "workspace" / "需求A" / "f.txt").write_text("x", encoding="utf-8")

        def git(*a, cwd=main):
            subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True)

        git("init", "-q")
        git("config", "user.email", "t@t.local")
        git("config", "user.name", "t")
        git("add", ".")
        git("commit", "-q", "-m", "init")
        wt = Path(td) / "wt"
        git("worktree", "add", str(wt), "-b", "wt-test")
        (main / "workspace" / "需求B").mkdir()
        (main / "workspace" / "需求B" / "g.txt").write_text("y", encoding="utf-8")
        lines_wt = cw.git_porcelain(str(wt))
        check("worktree 内跑检查：主工作区他需求脏区不可见（恒过）", cw.dirty_other_reqs(lines_wt or [], "需求A") == set())
        lines_main = cw.git_porcelain(str(main))
        check("对照组：主工作区跑检查命中他需求 B", cw.dirty_other_reqs(lines_main or [], "需求A") == {"需求B"})

    print("== 7. kind 路由（K0 显式优先，03 §3.8）==")
    check("kind 合法且与 current 一致 → 通过", cw.profile_block_reason("toolchain", "toolchain", "toolchain") is None)
    check("kind 覆盖推断（appid 信号→java 但 kind=toolchain）→ 以 kind 判一致=通过", cw.profile_block_reason("toolchain", "java-business", "toolchain") is None)
    check("kind≠current → BLOCK（文案含推断值）", (lambda r: r and "kind 声明=toolchain" in r and "java-business" in r)(cw.profile_block_reason("toolchain", "java-business", "java-business")))
    check("kind 非法值 → BLOCK", (lambda r: r and "非法值" in r)(cw.profile_block_reason("data-ops", "toolchain", "toolchain")))
    check("kind=data-script 声明路由（无 appid 信号）→ 与 current 不一致 BLOCK", (lambda r: r and "data-script" in r)(cw.profile_block_reason("data-script", "toolchain", "toolchain")))
    check("缺 kind + R3 判不定 → BLOCK 推 human", (lambda r: r and "R3" in r)(cw.profile_block_reason("", None, "toolchain")))
    check("缺 kind + 推断一致 → 通过", cw.profile_block_reason("", "toolchain", "toolchain") is None)

    print("== 8. P-链校验（B2-A 建项冻结，03 §3.8）==")
    orders = cw.load_stage_orders(repo_root)
    check("库 14 项且 13=编写脚本和验证脚本、14=发布验证与观测", len(orders) == 14 and orders.get("编写脚本和验证脚本") == 13 and orders.get("发布验证与观测") == 14)
    chain12 = ["需求分析", "服务拆分", "技术方案", "方案审查", "开发编码", "代码审查", "单元测试", "提测", "Agent自动化测试", "发布CheckList", "复盘", "知识库更新"]
    check("合法冻结链 12 项（本需求在途）→ 通过", cw.chain_block_reason(chain12, orders) is None)
    chain9 = ["需求分析", "技术方案", "方案审查", "开发编码", "代码审查", "单元测试", "Agent自动化测试", "复盘", "知识库更新"]
    check("合法子集链 9 项（toolchain 新链）→ 通过", cw.chain_block_reason(chain9, orders) is None)
    chain7 = ["需求分析", "技术方案", "方案审查", "编写脚本和验证脚本", "Agent自动化测试", "复盘", "知识库更新"]
    check("合法子集链 7 项（data-script，13 跨库号排在 09 前）→ 通过", cw.chain_block_reason(chain7, orders) is None)
    check("非库成员 → BLOCK", (lambda r: r and "非阶段库成员" in r)(cw.chain_block_reason(["需求分析", "神秘阶段"], orders)))
    check("链序重排（成员合法）→ 通过（顺序由建项复制保证，机器不判单调）", cw.chain_block_reason(["技术方案", "需求分析"], orders) is None)
    check("java 12 链+13 追加（成员全合法）→ 通过（机器只判库成员，不判链序来源）",
          cw.chain_block_reason(chain12 + ["编写脚本和验证脚本"], orders) is None)
    chain13 = ["需求分析", "服务拆分", "技术方案", "方案审查", "开发编码", "代码审查", "单元测试", "提测", "Agent自动化测试", "发布CheckList", "发布验证与观测", "复盘", "知识库更新"]
    check("java 13 链（14 于 10 与 11 之间）→ 通过（S2 注：本用例证明的是成员合法；链位由建项复制与 C1 phases grep 保证，机器不判单调）",
          cw.chain_block_reason(chain13, orders) is None)

    print(f"\n{'✅ 全过' if FAIL == 0 else '💥 有失败'}：PASS={PASS} FAIL={FAIL}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
