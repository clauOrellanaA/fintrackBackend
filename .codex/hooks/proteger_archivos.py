"""Codex PreToolUse hook: protect tests and local environment files, including renames."""
import re

from hook_utils import PolicyError, command_input, normalized_path, patch_paths, read_event, run_hook


def main() -> int:
    event = read_event()
    if event.get("tool_name") != "apply_patch":
        return 0
    for raw_path in patch_paths(command_input(event)):
        path = normalized_path(raw_path)
        parts = path.split("/")
        name = parts[-1]
        if "tests" in parts or "__tests__" in parts or re.search(r"\.(?:test|spec)\.[^.]+$", name):
            raise PolicyError("el parche afecta una prueba protegida; corrige la implementación")
        if name == ".env" or (name.startswith(".env.") and name != ".env.example"):
            raise PolicyError("el parche afecta un archivo de entorno protegido")
    return 0


if __name__ == "__main__":
    run_hook(main)
