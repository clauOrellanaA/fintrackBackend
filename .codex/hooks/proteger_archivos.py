"""Codex PreToolUse hook: protect tests and local environment files."""
import json
import re
import sys

sys.stderr.reconfigure(encoding="utf-8")
event = json.loads(sys.stdin.buffer.read().decode("utf-8"))
patch = event.get("tool_input", {}).get("command", "")
if not isinstance(patch, str):
    patch = ""

paths = re.findall(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$", patch, re.MULTILINE)
for raw_path in paths:
    path = raw_path.strip().replace("\\", "/")
    while path.startswith("./"):
        path = path[2:]
    name = path.rsplit("/", 1)[-1]
    protected_test = (
        path.startswith("tests/")
        or "/tests/" in f"/{path}"
        or "/__tests__/" in f"/{path}"
        or bool(re.search(r"\.(?:test|spec)\.[^.]+$", name, re.IGNORECASE))
    )
    if protected_test:
        print(
            f"⛔ BLOQUEADO por hook: '{name}' es una prueba protegida. "
            "Corrige la implementación, no modifiques las pruebas.",
            file=sys.stderr,
        )
        sys.exit(2)

    if name == ".env" or (name.startswith(".env.") and name != ".env.example"):
        print(
            f"⛔ BLOQUEADO por hook: '{name}' puede contener secretos y no se puede modificar.",
            file=sys.stderr,
        )
        sys.exit(2)

sys.exit(0)
