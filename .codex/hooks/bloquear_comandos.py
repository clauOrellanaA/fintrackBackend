"""Codex PreToolUse hook: reject dangerous commands and gate feature pushes."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

sys.stderr.reconfigure(encoding="utf-8")

DANGEROUS = {
    r"\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r": "borrado recursivo forzado (rm -rf)",
    r"\bRemove-Item\b.*\s-Recurse\b": "borrado recursivo en PowerShell",
    r"\bgit\s+push\b.*(?:--force(?:-with-lease)?|\s-f(?:\s|$))": "git push --force",
    r"\bgit\s+reset\s+--hard\b": "git reset --hard",
    r"\bDROP\s+(?:TABLE|DATABASE)\b": "eliminación SQL de tablas o bases de datos",
    r"\bdel\s+/[sq]\b": "borrado masivo de Windows",
    r"\bdocker\s+compose\b.*\bdown\b.*(?:\s-v\b|\s--volumes\b)": "eliminación de volúmenes Docker",
}
PROTECTED_BRANCHES = {"main", "dev", "qa"}


def run_push_checks(project: Path) -> bool:
    branch = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=project,
        capture_output=True,
        text=True,
        timeout=5,
        check=False,
    )
    if branch.returncode != 0:
        print("⛔ Hook: no se pudo verificar la rama actual; push bloqueado.", file=sys.stderr)
        return False
    current = branch.stdout.strip()
    if current in PROTECTED_BRANCHES:
        print(
            f"⛔ Hook: push directo a '{current}' bloqueado. Publica una rama feature y abre un PR.",
            file=sys.stderr,
        )
        return False
    if not current.startswith(("feature/", "fix/", "chore/")):
        print(
            f"⛔ Hook: push bloqueado desde '{current or '(detached HEAD)'}'. "
            "Usa una rama feature/, fix/ o chore/.",
            file=sys.stderr,
        )
        return False

    patch = "\n".join(
        [
            "*** Begin Patch",
            "*** Update File: src/modules/dashboard/dashboard.service.ts",
            "*** Update File: src/modules/transactions/transactions.service.ts",
            "*** Update File: src/modules/budgets/budgets.service.ts",
            "*** Update File: src/database/data-source.ts",
            "*** End Patch",
        ]
    )
    payload = {
        "cwd": str(project),
        "hook_event_name": "PostToolUse",
        "tool_name": "apply_patch",
        "tool_input": {"command": patch},
    }
    runner = project / ".codex" / "hooks" / "ejecutar_tests.py"
    try:
        result = subprocess.run(
            [sys.executable, str(runner)],
            cwd=project,
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=225,
            check=False,
        )
    except subprocess.TimeoutExpired:
        print("⛔ Hook: las pruebas previas al push excedieron el tiempo límite.", file=sys.stderr)
        return False
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        print(
            "⛔ Hook: las pruebas de dashboard y movimientos no aprobaron; push bloqueado.\n"
            + detail[-3000:],
            file=sys.stderr,
        )
        return False
    print(    "✅ Hook: pruebas de módulos 1, 2 y 3 aprobadas antes del push.", file=sys.stderr)
    return True


try:
    event = json.loads(sys.stdin.buffer.read().decode("utf-8"))
except (UnicodeDecodeError, json.JSONDecodeError) as error:
    print(f"⛔ Hook: entrada JSON inválida: {error}", file=sys.stderr)
    sys.exit(2)
tool = str(event.get("tool_name", "")).lower()
if not any(name in tool for name in ("bash", "powershell", "shell", "terminal")):
    sys.exit(0)

command = event.get("tool_input", {}).get("command", "")
if not isinstance(command, str):
    command = ""
for pattern, reason in DANGEROUS.items():
    if re.search(pattern, command, re.IGNORECASE):
        message = (
            f"BLOQUEADO por hook: {reason}. "
            "Solicita confirmación y utiliza un procedimiento seguro."
        )
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "deny",
                        "permissionDecisionReason": message,
                    }
                },
                ensure_ascii=False,
            )
        )
        sys.exit(0)

if re.search(r"\bgit\s+push\b", command, re.IGNORECASE):
    project = Path(event.get("cwd") or os.getcwd()).resolve()
    sys.exit(0 if run_push_checks(project) else 2)

sys.exit(0)
