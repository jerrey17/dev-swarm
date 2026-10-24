#!/usr/bin/env python3
"""s10：F03/D003-v3 点名 add（check_staged.py）

四场景（临时 git 仓，只测暂存区不 commit）：
① 整目录 add 两需求文件 → 无参拒（混存，P3 形态）
② 点名单需求文件 → 无参过
③ 带需求名自查：暂存含他需求 → 拒
④ DS_ALLOW_HUMAN=1 → 豁免过
"""
import os
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CLI = os.path.join(REPO, "skill", "scripts", "check_staged.py")


def run(*args, cwd=None, env=None, check=False):
    r = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"❌ 命令失败: {' '.join(args)}\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r


def stage(repo, *paths):
    run("git", "-C", repo, "add", *paths)


def main():
    tmp = tempfile.mkdtemp(prefix="ds-s10-")
    try:
        repo = os.path.join(tmp, "repo")
        run("git", "init", "-b", "main", repo)
        run("git", "-C", repo, "config", "user.email", "s10@dev-swarm.test")
        run("git", "-C", repo, "config", "user.name", "s10")
        for req in ("s10-需求A", "s10-需求B"):
            p = os.path.join(repo, "workspace", req)
            os.makedirs(p, exist_ok=True)
            open(os.path.join(p, "01-需求分析.md"), "w", encoding="utf-8").write("# t\n")

        def check(args=(), env_extra=None, cwd=None):
            env = os.environ.copy()
            if env_extra:
                env.update(env_extra)
            return subprocess.run([sys.executable, CLI, *args], cwd=cwd or repo,
                                  env=env, capture_output=True, text=True)

        # ① 整目录混存 → 拒
        stage(repo, "workspace")
        r1 = check()
        ok1 = r1.returncode != 0 and "混存" in r1.stdout
        print(("✅" if ok1 else "❌") + " ① 整目录 add 两需求 → 拒（混存）")
        if not ok1:
            print(r1.stdout, r1.stderr)
        run("git", "-C", repo, "reset", check=False)

        # ② 点名单需求 → 过
        stage(repo, "workspace/s10-需求A/01-需求分析.md")
        r2 = check()
        ok2 = r2.returncode == 0
        print(("✅" if ok2 else "❌") + " ② 点名单需求文件 → 过")
        if not ok2:
            print(r2.stdout, r2.stderr)
        run("git", "-C", repo, "reset", check=False)

        # ③ 带需求名：暂存含他需求 → 拒
        stage(repo, "workspace")
        r3 = check(["s10-需求A"])
        ok3 = r3.returncode != 0 and "他需求" in r3.stdout
        print(("✅" if ok3 else "❌") + " ③ 带需求名自查：混入他需求 → 拒")
        if not ok3:
            print(r3.stdout, r3.stderr)
        run("git", "-C", repo, "reset", check=False)

        # ④ 豁免 → 过
        stage(repo, "workspace")
        r4 = check(env_extra={"DS_ALLOW_HUMAN": "1"})
        ok4 = r4.returncode == 0
        print(("✅" if ok4 else "❌") + " ④ DS_ALLOW_HUMAN=1 → 豁免过")
        if not ok4:
            print(r4.stdout, r4.stderr)

        sys.exit(0 if (ok1 and ok2 and ok3 and ok4) else 1)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
