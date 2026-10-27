"""Codex PostToolUse/SubagentStop hook: log tool names and changed paths only."""
from datetime import datetime

from hook_utils import event_directory, patch_paths, project_root, read_event, run_hook


def main() -> int:
    event = read_event()
    event_name = event.get("hook_event_name", "?")
    data = event.get("tool_input")
    patch = data.get("command", "") if isinstance(data, dict) else ""
    if not isinstance(patch, str):
        patch = ""
    tool = str(event.get("tool_name", "SUBAGENTE terminó" if event_name == "SubagentStop" else "?"))
    if event_name == "SubagentStop":
        detail = str(event.get("agent_type") or event.get("agent_name") or "subagente")
    elif tool == "apply_patch":
        detail = ", ".join(patch_paths(patch))
    else:
        detail = "acción registrada"
    # Keep untrusted field content on one bounded line; never log command/patch bodies.
    detail = detail.replace("\n", " ").replace("\r", " ")[:240]
    tool = tool.replace("\n", " ").replace("\r", " ")[:80]
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S} | {tool:<20} | {detail}\n"
    log = project_root(event_directory(event)) / ".codex" / "auditoria.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as stream:
        stream.write(line)
    return 0


if __name__ == "__main__":
    run_hook(main)
