"""Codex PreToolUse hook: detect high-confidence credentials in added patch lines."""
import json
import re
import sys

from hook_utils import command_input, read_event, run_hook

SECRET_PATTERNS = (
    ("AWS access key ID", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    (
        "AWS secret access key",
        re.compile(
            r"""(?i)\b(?:aws[_-]?)?secret[_-]?access[_-]?key\b\s*[:=]\s*["'][A-Za-z0-9/+=]{40}["']"""
        ),
    ),
    ("GitHub token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
    ("Stripe live secret", re.compile(r"\bsk_live_[A-Za-z0-9]{16,}\b")),
    ("private key", re.compile(r"-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----")),
)


def added_patch_lines(patch: str) -> list[tuple[str, str]]:
    path = ""
    added = []
    for line in patch.splitlines():
        if line.startswith(("*** Add File: ", "*** Update File: ", "*** Delete File: ")):
            path = line.split(": ", 1)[1].strip()
        elif line.startswith("+++ "):
            continue
        elif line.startswith("+") and path:
            added.append((path, line[1:]))
    return added


def find_credentials(patch: str) -> list[tuple[str, str]]:
    findings = []
    for path, line in added_patch_lines(patch):
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(line):
                findings.append((path, label))
    return findings


def main() -> int:
    event = read_event()
    if event.get("tool_name") != "apply_patch":
        return 0
    patch = command_input(event)

    findings = find_credentials(patch)
    if findings:
        locations = ", ".join(f"{path} ({label})" for path, label in findings[:5])
        print(
            "Parche bloqueado: parece incluir credenciales reales. "
            f"Revisa los archivos indicados; no se imprime el valor detectado: {locations}",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    run_hook(main)
