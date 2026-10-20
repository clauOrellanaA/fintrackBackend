"""Codex PostToolUse hook: build and test affected backend modules."""
import json
import os
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def fail(message: str, detail: str = "") -> None:
    print(
        "❌ El hook ejecutó las pruebas después del cambio y fallaron.\n"
        f"{message}\n{detail[-3000:]}",
        file=sys.stderr,
    )
    sys.exit(2)


def run_npm(project: Path, arguments: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    if os.name == "nt":
        command = ["cmd.exe", "/d", "/s", "/c", f"npm {' '.join(arguments)}"]
    else:
        command = ["npm", *arguments]
    return subprocess.run(
        command, cwd=project, capture_output=True, text=True, encoding="utf-8", timeout=timeout, check=False
    )


event = json.loads(sys.stdin.buffer.read().decode("utf-8"))
patch = event.get("tool_input", {}).get("command", "")
if not isinstance(patch, str):
    patch = ""
paths = [
    line.split(": ", 1)[1].strip().replace("\\", "/")
    for line in patch.splitlines()
    if line.startswith(("*** Add File: ", "*** Update File: ", "*** Delete File: "))
]
backend_area = (
    "src/modules/dashboard/",
    "src/modules/transactions/",
    "src/modules/budgets/",
    "src/modules/savings-goals/",
    "src/modules/auth/",
    "src/modules/users/",
    "src/database/",
    "tests/",
    "docs/openapi/",
)
if not any(path.startswith(backend_area) for path in paths):
    sys.exit(0)

project = Path(event.get("cwd") or os.getcwd()).resolve()
if not (project / "package.json").is_file() or not (project / "package-lock.json").is_file():
    fail("No se encontró package.json/package-lock.json en el repositorio backend.")

try:
    if os.environ.get("TEST_DATABASE_URL"):
        result = run_npm(project, ["test"], 210)
        detail = result.stdout + result.stderr
        if result.returncode != 0:
            fail("Falló npm test con TEST_DATABASE_URL configurada.", detail)
        summary = "✅ Hook de pruebas: build y suite backend con PostgreSQL → OK"
    else:
        build = run_npm(project, ["run", "build"], 45)
        if build.returncode != 0:
            fail("Falló npm run build.", build.stdout + build.stderr)
        if os.name == "nt":
            command = ["cmd.exe", "/d", "/s", "/c", "node --test tests/contract.test.cjs tests/period.test.cjs"]
        else:
            command = ["node", "--test", "tests/contract.test.cjs", "tests/period.test.cjs"]
        tests = subprocess.run(
            command, cwd=project, capture_output=True, text=True, encoding="utf-8", timeout=30, check=False
        )
        if tests.returncode != 0:
            fail("Fallaron las pruebas unitarias de contrato y periodos.", tests.stdout + tests.stderr)
        detail = build.stdout + build.stderr + tests.stdout + tests.stderr
        summary = "✅ Hook de pruebas: build y pruebas contract/period → OK (PostgreSQL no configurado)"
except subprocess.TimeoutExpired as error:
    fail("Las comprobaciones excedieron el tiempo límite.", str(error))

print(
    json.dumps(
        {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": summary,
            }
        },
        ensure_ascii=False,
    )
)
sys.exit(0)
