"""Codex PreToolUse hook: reject dangerous commands and gate explicit feature pushes."""
import json
import re
import shlex
import subprocess
import sys
from pathlib import Path

from hook_utils import PolicyError, command_input, event_directory, git_query, project_root, read_event, run_hook

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
BRANCH_PREFIXES = ("feature/", "fix/", "chore/")
BOUNDARIES = {";", "&", "&&", "|", "||", "(", ")"}


def tokens_for(command: str) -> list[str]:
    try:
        lexer = shlex.shlex(command, posix=False, punctuation_chars=";&|()")
        lexer.whitespace_split = True
        lexer.commenters = ""
        tokens = list(lexer)
    except ValueError as error:
        raise PolicyError("no se pudo interpretar el comando") from error
    # posix=False preserves backslashes in Windows paths.
    return [token[1:-1] if len(token) >= 2 and token[0] == token[-1] and token[0] in "\"'" else token for token in tokens]


def git_invocations(tokens: list[str]):
    for index, token in enumerate(tokens):
        if token.replace("\\", "/").rsplit("/", 1)[-1].casefold() not in {"git", "git.exe"}:
            continue
        end = index + 1
        while end < len(tokens) and tokens[end] not in BOUNDARIES:
            end += 1
        args = tokens[index + 1:end]
        options = []
        cursor = 0
        while cursor < len(args):
            arg = args[cursor]
            if arg in ("-C", "-c", "--git-dir", "--work-tree"):
                if cursor + 1 >= len(args):
                    raise PolicyError("opción global Git incompleta")
                options.extend((arg, args[cursor + 1]))
                cursor += 2
            elif arg.startswith(("--git-dir=", "--work-tree=")) or (arg.startswith(("-C", "-c")) and len(arg) > 2):
                options.append(arg)
                cursor += 1
            elif arg in ("--no-pager", "--paginate", "--no-optional-locks", "--no-replace-objects", "--literal-pathspecs"):
                options.append(arg)
                cursor += 1
            elif arg.startswith("-"):
                if any(value in {"push", "reset"} for value in args[cursor + 1:]):
                    raise PolicyError("opción global Git no verificable antes de push/reset")
                break
            else:
                yield index, options, arg, args[cursor + 1:]
                break


def valid_branch(branch: str) -> bool:
    if branch.startswith("refs/heads/"):
        branch = branch[len("refs/heads/"):]
    return (
        branch.startswith(BRANCH_PREFIXES)
        and bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", branch))
        and not any(part in ("", ".", "..") or part.startswith(".") or part.endswith((".", ".lock")) for part in branch.split("/"))
        and ".." not in branch and "//" not in branch and "@{" not in branch
    )


def verify_push_destinations(arguments: list[str]) -> None:
    values = []
    positional = False
    allowed = {"-u", "--set-upstream", "--porcelain", "-v", "--verbose", "-q", "--quiet", "-n", "--dry-run", "--atomic"}
    for arg in arguments:
        if arg == "--" and not positional:
            positional = True
        elif arg.startswith("-") and not positional:
            if arg not in allowed:
                raise PolicyError("push con opción no permitida; indica origin y ramas explícitas sin force/delete/all/mirror")
        else:
            values.append(arg)
    if len(values) < 2 or values[0] != "origin":
        raise PolicyError("push requiere origin y al menos una rama destino explícita")
    for refspec in values[1:]:
        if refspec.startswith("+") or refspec.count(":") > 1:
            raise PolicyError("refspec de push forzado o ambiguo")
        if ":" in refspec:
            source, target = refspec.split(":", 1)
            if not source or not (source == "HEAD" or valid_branch(source)):
                raise PolicyError("origen de refspec no permitido")
        else:
            source = target = refspec
        if not valid_branch(target):
            raise PolicyError("push a destino protegido o no permitido; usa feature/, fix/ o chore/")


def verify_push_options(options: list[str]) -> None:
    for index, option in enumerate(options):
        if option == "-c":
            value = options[index + 1]
        elif option.startswith("-c"):
            value = option[2:]
        else:
            continue
        if value.split("=", 1)[0].casefold() not in {"core.quotepath", "color.ui"}:
            raise PolicyError("push con configuración -c no verificable; usa solo opciones de presentación")


def run_push_checks(directory: Path, options: list[str]) -> bool:
    project = project_root(directory, options)
    current = git_query(directory, options, ["symbolic-ref", "--quiet", "--short", "HEAD"])
    if current in PROTECTED_BRANCHES or not valid_branch(current):
        raise PolicyError("push desde rama protegida o no permitida; usa feature/, fix/ o chore/")
    mirror = git_query(directory, options, ["config", "--bool", "--get", "remote.origin.mirror"], allow_missing=True)
    if mirror == "true":
        raise PolicyError("push bloqueado: origin está configurado como mirror")
    payload = {
        "cwd": str(project), "hook_event_name": "PostToolUse", "tool_name": "apply_patch",
        "tool_input": {"command": "*** Begin Patch\n*** Update File: src/database/data-source.ts\n*** End Patch"},
    }
    try:
        result = subprocess.run(
            [sys.executable, str(project / ".codex" / "hooks" / "ejecutar_tests.py")],
            cwd=project, input=json.dumps(payload), capture_output=True, text=True,
            encoding="utf-8", timeout=225, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PolicyError("no se pudieron completar las comprobaciones previas al push") from error
    if result.returncode:
        detail = (result.stderr or result.stdout).strip()
        print("Hook: fallaron las comprobaciones previas al push.\n" + detail[-3000:], file=sys.stderr)
        return False
    # The runner reports whether PostgreSQL was available; do not claim full module coverage.
    print(result.stdout.strip() or "Hook: comprobaciones previas al push aprobadas.", file=sys.stderr)
    return True


def main() -> int:
    event = read_event()
    tool = str(event.get("tool_name", "")).casefold()
    if not any(name in tool for name in ("bash", "powershell", "shell", "terminal")):
        return 0
    command = command_input(event)
    for pattern, reason in DANGEROUS.items():
        if re.search(pattern, command, re.IGNORECASE | re.DOTALL):
            raise PolicyError(reason)
    tokens = tokens_for(command)
    # Preserve the original policy for wrappers, without trying to execute or parse nested shells.
    for token in tokens:
        if re.search(r"\bgit(?:\.exe)?\b\s+.*\b(?:push|reset)\b", token, re.IGNORECASE):
            raise PolicyError("git push/reset embebido en otro comando; usa una invocación Git directa")
    pushes = []
    for index, options, operation, arguments in git_invocations(tokens):
        if operation == "reset" and any(arg == "--hard" or arg.startswith("--hard=") for arg in arguments):
            raise PolicyError("git reset --hard")
        if operation != "push":
            continue
        if any(arg.startswith("--force") or (arg.startswith("-") and not arg.startswith("--") and "f" in arg[1:]) for arg in arguments):
            raise PolicyError("git push --force")
        if (index != 0 and not (index == 1 and tokens[0] == "&")) or any(token in BOUNDARIES for token in tokens[index + 1:]):
            raise PolicyError("push requiere una única invocación Git directa")
        # A general shell parser is out of scope. Reject contexts whose cwd/arguments can change at runtime.
        if any(value.casefold() in {"cd", "chdir", "set-location", "pushd", "popd"} for value in tokens[:index]):
            raise PolicyError("push con cambio de directorio shell previo; usa workdir o git -C")
        if any(character in command for character in ("$", "`", "%", "\n", "\r", ">", "<")):
            raise PolicyError("push con expansión, redirección o varias líneas no verificable")
        verify_push_options(options)
        verify_push_destinations(arguments)
        pushes.append(options)
    for options in pushes:
        if not run_push_checks(event_directory(event), options):
            return 2
    return 0


if __name__ == "__main__":
    run_hook(main)
