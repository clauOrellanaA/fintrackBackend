"""Codex PostToolUse/SubagentStop hook: log tool names and changed paths only."""
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

event = json.loads(sys.stdin.buffer.read().decode("utf-8"))
event_name = event.get("hook_event_name", "?")
input_data = event.get("tool_input", {}) or {}
tool = event.get("tool_name", "SUBAGENTE terminó" if event_name == "SubagentStop" else "?")
patch = input_data.get("command", "")
if not isinstance(patch, str):
    patch = ""

if event_name == "SubagentStop":
    detail = str(event.get("agent_type") or event.get("agent_name") or "subagente")
elif tool == "apply_patch":
    detail = ", ".join(
        re.findall(r"^\*\*\* \w+ File: (.+)$", patch, re.MULTILINE)
    )
else:
    detail = "acción registrada"

detail = detail.replace("\n", " ")[:240]
line = f"{datetime.now():%Y-%m-%d %H:%M:%S} | {tool:<20} | {detail}\n"
project = Path(event.get("cwd") or os.getcwd()).resolve()
log = project / ".codex" / "auditoria.log"
log.parent.mkdir(parents=True, exist_ok=True)
with log.open("a", encoding="utf-8") as stream:
    stream.write(line)

sys.exit(0)
