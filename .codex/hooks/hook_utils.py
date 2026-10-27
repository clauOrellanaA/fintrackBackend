"""Shared input, path and repository handling for the local Codex hooks."""
import json
import os
import posixpath
import re
import subprocess
import sys
from pathlib import Path


class PolicyError(Exception):
    """A hook cannot safely interpret or verify the requested operation."""


def configure_output() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def read_event() -> dict:
    try:
        stream = getattr(sys.stdin, "buffer", sys.stdin)
        raw = stream.read()
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8-sig")
        event = json.loads(raw)
    except (ValueError, UnicodeError, OSError) as error:
        raise PolicyError("entrada JSON inválida") from error
    if not isinstance(event, dict):
        raise PolicyError("el evento debe ser un objeto JSON")
    return event


def command_input(event: dict) -> str:
    data = event.get("tool_input")
    if not isinstance(data, dict) or not isinstance(data.get("command"), str):
        raise PolicyError("tool_input.command debe ser texto")
    return data["command"]


def event_directory(event: dict) -> Path:
    cwd = event.get("cwd") or os.getcwd()
    if not isinstance(cwd, str):
        raise PolicyError("directorio de trabajo inválido")
    base = Path(cwd)
    data = event.get("tool_input")
    if isinstance(data, dict):
        override = data.get("workdir") or data.get("cwd")
        if override:
            if not isinstance(override, str):
                raise PolicyError("directorio de trabajo inválido")
            base = base / override
    return base.resolve()


def git_query(directory: Path, options: list[str], arguments: list[str], allow_missing: bool = False) -> str:
    try:
        result = subprocess.run(
            ["git", *options, *arguments], cwd=directory, capture_output=True,
            text=True, encoding="utf-8", timeout=5, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PolicyError("no se pudo consultar el repositorio Git") from error
    if allow_missing and result.returncode == 1:
        return ""
    if result.returncode:
        raise PolicyError("Git no pudo verificar el repositorio o la rama")
    return result.stdout.strip()


def project_root(directory: Path, options: list[str] | None = None) -> Path:
    root = git_query(directory, options or [], ["rev-parse", "--show-toplevel"])
    if not root:
        raise PolicyError("Git no devolvió la raíz del repositorio")
    return Path(root).resolve()


def patch_paths(patch: str) -> list[str]:
    return re.findall(r"^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)$", patch, re.MULTILINE)


def normalized_path(path: str) -> str:
    # Case-folding is deliberately conservative on case-sensitive systems too.
    path = posixpath.normpath(path.strip().replace("\\", "/"))
    return "/".join(part.rstrip(" .") for part in path.split("/")).casefold()


def run_hook(main) -> None:
    configure_output()
    try:
        code = main()
    except PolicyError as error:
        print(f"Hook: {error}; operación bloqueada.", file=sys.stderr)
        code = 2
    sys.exit(code)
