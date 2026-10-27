"""Regression tests for the public Codex hook JSON/exit-code contract.

Dangerous shell commands are payload text only. Push checks stub only the test
runner; Git subprocesses are restricted to read-only repository queries.
"""
import io
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
HOOKS = ROOT / ".codex" / "hooks"
BRANCH = "fix/be-hooks-review"


def event(tool="Bash", command="git status --short", cwd=None):
    return {
        "hook_event_name": "PreToolUse",
        "tool_name": tool,
        "tool_input": {"command": command},
        "cwd": str(cwd or ROOT),
    }


def invoke(script, payload):
    return subprocess.run(
        [sys.executable, "-B", str(HOOKS / script)],
        cwd=ROOT,
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=15,
        check=False,
    )


def invoke_in_process(script, payload, run):
    """Use real stream wrappers because hook scripts configure UTF-8 streams."""
    stdin = io.TextIOWrapper(io.BytesIO(json.dumps(payload).encode()), encoding="utf-8")
    stdout = io.TextIOWrapper(io.BytesIO(), encoding="utf-8")
    stderr = io.TextIOWrapper(io.BytesIO(), encoding="utf-8")
    code = 0
    try:
        with (
            mock.patch.object(sys, "stdin", stdin),
            mock.patch.object(sys, "stdout", stdout),
            mock.patch.object(sys, "stderr", stderr),
            mock.patch.object(sys, "path", [str(HOOKS), *sys.path]),
            mock.patch("subprocess.run", side_effect=run),
        ):
            try:
                runpy.run_path(str(HOOKS / script), run_name="__main__")
            except SystemExit as error:
                code = error.code or 0
        stdout.flush()
        stderr.flush()
        return code, stdout.buffer.getvalue().decode(), stderr.buffer.getvalue().decode()
    finally:
        stdin.close()
        stdout.close()
        stderr.close()


class CommandsTests(unittest.TestCase):
    def test_dangerous_commands_are_blocked_with_git_global_options(self):
        commands = (
            "git reset --hard",
            "git -C . reset --hard",
            'git -C "src" -C .. reset --hard',
            "git -c color.ui=false reset --hard",
            "git --git-dir=.git --work-tree=. reset --hard",
            "git -C . push --force origin HEAD",
            "git -C . push --force-with-lease origin HEAD",
            "git -c color.ui=false push -f origin HEAD",
            'powershell -Command "git reset --hard"',
            'cmd /c "git push --force origin HEAD"',
            "rm -rf synthetic-directory",
            "Remove-Item synthetic-directory -Recurse",
            "DROP DATABASE synthetic_database",
            "docker compose down -v",
        )
        for command in commands:
            with self.subTest(command=command):
                result = invoke("bloquear_comandos.py", event(command=command))
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertNotIn("Traceback", result.stderr)

    def test_benign_command_passes(self):
        self.assertEqual(invoke("bloquear_comandos.py", event()).returncode, 0)

    def test_malformed_input_is_blocked_without_traceback(self):
        for raw in ("{", "[]", '{"tool_name":"Bash","tool_input":null}'):
            with self.subTest(raw=raw):
                result = subprocess.run(
                    [sys.executable, "-B", str(HOOKS / "bloquear_comandos.py")],
                    input=raw, capture_output=True, text=True, encoding="utf-8",
                    cwd=ROOT, timeout=15, check=False,
                )
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertNotIn("Traceback", result.stderr)


class PushTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix="fintrack hooks push ")
        self.addCleanup(self.folder.cleanup)
        self.project = Path(self.folder.name)
        subprocess.run(["git", "init", "-b", BRANCH, str(self.project)], check=True, capture_output=True)
        (self.project / "src").mkdir()
        (self.project / ".codex/hooks").mkdir(parents=True)

    def guarded(self, command, payload=None, runner_code=0):
        real_run = subprocess.run
        checks = []

        def run(args, *positional, **kwargs):
            if any(str(arg).endswith("ejecutar_tests.py") for arg in args):
                checks.append((args, kwargs))
                return subprocess.CompletedProcess(args, runner_code, "synthetic tests", "")
            self.assertIsInstance(args, list)
            self.assertIn(Path(str(args[0])).stem.lower(), ("git", "git.exe"))
            self.assertTrue(
                any(query in args for query in (
                    "rev-parse", "symbolic-ref", "branch", "config", "check-ref-format", "remote",
                )),
                "Only read-only Git queries may execute in hook tests",
            )
            self.assertNotIn("push", args)
            self.assertNotIn("reset", args)
            if "config" in args:
                self.assertTrue(any(str(arg).startswith("--get") for arg in args))
            return real_run(args, *positional, **kwargs)

        result = invoke_in_process("bloquear_comandos.py", payload or event(command=command, cwd=self.project), run)
        return result, checks

    def test_safe_explicit_push_runs_gate(self):
        for command in (
            f"git push -u origin {BRANCH}",
            f"git -C . push origin HEAD:refs/heads/{BRANCH}",
            f'git -C "src" -C .. push origin HEAD:{BRANCH}',
        ):
            with self.subTest(command=command):
                (code, _, detail), checks = self.guarded(command)
                self.assertEqual(code, 0, detail)
                self.assertTrue(checks, "A safe push must still run the test gate")
                self.assertTrue(all(Path(call[1]["cwd"]).resolve() == self.project for call in checks))

    def test_failed_gate_blocks_safe_push(self):
        (code, _, _), checks = self.guarded(f"git push origin {BRANCH}", runner_code=1)
        self.assertEqual(code, 2)
        self.assertTrue(checks)

    def test_protected_or_ambiguous_pushes_never_run_gate(self):
        commands = (
            "git push origin HEAD:main", "git push origin HEAD:refs/heads/dev",
            "git push origin HEAD:qa", "git push origin :main",
            "git push --delete origin main", "git push --all origin",
            "git push --mirror origin", "git push", "git push origin HEAD",
            f"git push origin +{BRANCH}:{BRANCH}",
            f"git -c remote.origin.mirror=true push origin {BRANCH}",
            f"cd src; git push origin {BRANCH}",
            f"Set-Location src; git push origin {BRANCH}",
            f"GIT_DIR=another-repository git push origin {BRANCH}",
        )
        for command in commands:
            with self.subTest(command=command):
                (code, _, detail), checks = self.guarded(command)
                self.assertEqual(code, 2, detail)
                self.assertFalse(checks, "Reject the destination before expensive test checks")

    def test_persisted_mirror_configuration_blocks_explicit_push(self):
        subprocess.run(
            ["git", "-C", str(self.project), "config", "remote.origin.mirror", "true"],
            check=True, capture_output=True,
        )
        (code, _, detail), checks = self.guarded(f"git push origin {BRANCH}")
        self.assertEqual(code, 2, detail)
        self.assertFalse(checks, "A mirror remote must be rejected before running checks")

    def test_git_c_uses_effective_repository_branch(self):
        with tempfile.TemporaryDirectory(prefix="fintrack hooks target ") as folder:
            target = Path(folder)
            subprocess.run(["git", "init", "-b", "main", str(target)], check=True, capture_output=True)
            (code, _, detail), checks = self.guarded(
                f'git -C "{target.as_posix()}" push origin HEAD:{BRANCH}'
            )
            self.assertEqual(code, 2, detail)
            self.assertFalse(checks, "A protected source branch must be rejected in the target repository")

    def test_tool_workdir_is_used(self):
        payload = event(command=f"git push origin {BRANCH}", cwd=self.project)
        payload["tool_input"]["workdir"] = str(self.project / "src")
        (code, _, detail), checks = self.guarded("", payload=payload)
        self.assertEqual(code, 0, detail)
        self.assertTrue(checks)
        self.assertEqual(Path(checks[0][1]["cwd"]).resolve(), self.project)


class ProtectedFilesTests(unittest.TestCase):
    def protect(self, patch):
        return invoke("proteger_archivos.py", event("apply_patch", patch))

    def test_protected_paths_and_move_destinations_are_blocked(self):
        paths = (".env", "config/.env.local", "tests/demo.cjs", "src/__tests__/demo.ts", "src/demo.spec.ts")
        for path in paths:
            for patch in (
                f"*** Begin Patch\n*** Update File: {path}\n+x\n*** End Patch",
                f"*** Begin Patch\n*** Update File: src/demo.ts\n*** Move to: {path}\n+x\n*** End Patch",
            ):
                with self.subTest(patch=patch):
                    result = self.protect(patch)
                    self.assertEqual(result.returncode, 2, result.stderr)

    def test_normalized_parent_path_is_protected(self):
        result = self.protect("*** Begin Patch\n*** Update File: src/../.env\n+x\n*** End Patch")
        self.assertEqual(result.returncode, 2, result.stderr)

    def test_windows_case_variants_are_protected(self):
        for path in (".ENV", "Tests/demo.cjs", "src/__Tests__/demo.ts", "CONFIG/.ENV.LOCAL"):
            with self.subTest(path=path):
                result = self.protect(f"*** Begin Patch\n*** Update File: {path}\n+x\n*** End Patch")
                self.assertEqual(result.returncode, 2, result.stderr)

    def test_examples_and_source_changes_pass(self):
        for path in (".env.example", "src/demo.ts", "docs/notes.md"):
            with self.subTest(path=path):
                result = self.protect(f"*** Begin Patch\n*** Update File: {path}\n+placeholder\n*** End Patch")
                self.assertEqual(result.returncode, 0, result.stderr)


class LocationTests(unittest.TestCase):
    def test_configured_launchers_work_from_root_and_subdirectory(self):
        config = json.loads((ROOT / ".codex/hooks.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory(prefix="fintrack hooks launch ") as folder:
            project = Path(folder)
            subprocess.run(["git", "init", "-b", BRANCH, str(project)], check=True, capture_output=True)
            scripts = project / ".codex/hooks"
            scripts.mkdir(parents=True)
            for source in HOOKS.glob("*.py"):
                shutil.copyfile(source, scripts / source.name)
            (project / "src").mkdir()
            for cwd in (project, project / "src"):
                for name, groups in config["hooks"].items():
                    for group in groups:
                        for handler in group["hooks"]:
                            command = handler.get("commandWindows", handler["command"]) if os.name == "nt" else handler["command"]
                            payload = event("apply_patch", "*** Begin Patch\n*** End Patch", cwd=cwd)
                            payload["hook_event_name"] = name
                            with self.subTest(cwd=cwd.name, event=name, command=command):
                                result = subprocess.run(
                                    command, shell=True, cwd=cwd, input=json.dumps(payload),
                                    capture_output=True, text=True, encoding="utf-8", timeout=20, check=False,
                                )
                                self.assertEqual(result.returncode, 0, result.stderr)

    def test_runner_from_subdirectory_uses_root_for_checks(self):
        calls = []
        real_run = subprocess.run

        def run(args, *positional, **kwargs):
            if Path(str(args[0])).stem.lower() == "git":
                return real_run(args, *positional, **kwargs)
            calls.append((args, kwargs))
            return subprocess.CompletedProcess(args, 0, "synthetic check", "")

        for path in (
            "src/modules/dashboard/dashboard.service.ts",
            "modules/dashboard/dashboard.service.ts",
        ):
            with self.subTest(path=path):
                calls.clear()
                payload = event("apply_patch", f"*** Begin Patch\n*** Update File: {path}\n+x\n*** End Patch", cwd=ROOT / "src")
                payload["hook_event_name"] = "PostToolUse"
                with mock.patch.dict(os.environ):
                    os.environ.pop("TEST_DATABASE_URL", None)
                    code, _, detail = invoke_in_process("ejecutar_tests.py", payload, run)
                self.assertEqual(code, 0, detail)
                self.assertTrue(calls)
                self.assertTrue(all(Path(call[1]["cwd"]).resolve() == ROOT for call in calls))

    def test_audit_from_subdirectory_logs_paths_without_payload_contents(self):
        with tempfile.TemporaryDirectory(prefix="fintrack hooks audit ") as folder:
            project = Path(folder)
            subprocess.run(["git", "init", "-b", BRANCH, str(project)], check=True, capture_output=True)
            (project / "src").mkdir()
            private_text = "synthetic-private-payload-do-not-log"
            payload = event("apply_patch", f"*** Begin Patch\n*** Update File: src/demo.ts\n+{private_text}\n*** End Patch", cwd=project / "src")
            payload["hook_event_name"] = "PostToolUse"
            result = invoke("auditoria.py", payload)
            self.assertEqual(result.returncode, 0, result.stderr)
            log = (project / ".codex/auditoria.log").read_text(encoding="utf-8")
            self.assertIn("src/demo.ts", log)
            self.assertNotIn(private_text, log)
            self.assertNotIn("*** Begin Patch", log)
            self.assertFalse((project / "src/.codex/auditoria.log").exists())


if __name__ == "__main__":
    unittest.main()
