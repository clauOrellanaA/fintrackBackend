"""Codex PostToolUse hook: build and test affected backend modules."""
import json
import os
import subprocess
import sys
from pathlib import Path

from hook_utils import PolicyError, command_input, event_directory, normalized_path, patch_paths, project_root, read_event, run_hook


def run_npm(project: Path, arguments: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    if os.name == "nt":
        command = ["cmd.exe", "/d", "/s", "/c", f"npm {' '.join(arguments)}"]
    else:
        command = ["npm", *arguments]
    return subprocess.run(
        command, cwd=project, capture_output=True, text=True, encoding="utf-8", timeout=timeout, check=False
    )


def require_success(result, message: str) -> None:
    if result.returncode:
        print((result.stdout + result.stderr)[-3000:], file=sys.stderr)
        raise PolicyError(message)


def main() -> int:
    event = read_event()
    if event.get("tool_name") != "apply_patch":
        return 0
    paths = patch_paths(command_input(event))
    backend_area = (
        "src/modules/dashboard/", "src/modules/transactions/", "src/modules/budgets/",
        "src/modules/savings-goals/", "src/modules/auth/", "src/modules/users/",
        "src/database/", "tests/", "docs/openapi/",
    )
    # Resolve root even when Codex is started from a repository subdirectory.
    if not paths:
        return 0
    directory = event_directory(event)
    project = project_root(directory)
    normalized_root = Path(normalized_path(str(project)))
    relative_paths = []
    for path in paths:
        candidate = Path(normalized_path(path))
        # Check both repo-relative and session-relative forms conservatively.
        candidates = [candidate] if candidate.is_absolute() else [candidate, Path(normalized_path(str(directory / path)))]
        for candidate in candidates:
            path = candidate.as_posix()
            if not candidate.is_absolute():
                relative_paths.append(path)
                continue
            try:
                path = candidate.relative_to(normalized_root).as_posix()
            except ValueError:
                continue
            relative_paths.append(path)
    if not any(path.startswith(backend_area) for path in relative_paths):
        return 0
    if not (project / "package.json").is_file() or not (project / "package-lock.json").is_file():
        raise PolicyError("no se encontró package.json/package-lock.json en la raíz backend")
    try:
        if os.environ.get("TEST_DATABASE_URL"):
            result = run_npm(project, ["test"], 210)
            require_success(result, "falló npm test con TEST_DATABASE_URL configurada")
            summary = "Hook de pruebas: build y suite backend con PostgreSQL aprobados"
        else:
            build = run_npm(project, ["run", "build"], 45)
            require_success(build, "falló npm run build")
            arguments = ["node", "--test", "tests/contract.test.cjs", "tests/period.test.cjs"]
            if os.name == "nt":
                arguments = ["cmd.exe", "/d", "/s", "/c", "node --test tests/contract.test.cjs tests/period.test.cjs"]
            result = subprocess.run(
                arguments, cwd=project, capture_output=True, text=True, encoding="utf-8", timeout=30, check=False
            )
            require_success(result, "fallaron las pruebas de contrato y periodos")
            summary = "Hook de pruebas: build y contract/period aprobados; PostgreSQL no configurado"
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PolicyError("no se pudieron completar las comprobaciones backend") from error
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": summary}}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    run_hook(main)
