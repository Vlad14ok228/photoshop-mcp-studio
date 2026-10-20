---
name: photoshop-troubleshooting
description: Fixes for Photoshop MCP failures - "General Photoshop error occurred" / error 8800 on every call (a hint popup is open), "Show is not currently available", path/JSON errors, server not connecting. Use whenever a photoshop_* call fails or Photoshop looks stuck.
---

# Photoshop troubleshooting

Reply in the user's language. Helper scripts live in `${CLAUDE_SKILL_DIR}/scripts/` (Windows PowerShell).

## "General Photoshop error occurred" on EVERY call (even trivial ones)
Cause (observed repeatedly): Photoshop shows a hint popup, e.g. the **Generative Fill tooltip** of the Contextual Task Bar (appears when the mouse rests on that bar). While it is open, all scripting through COM fails. It is not a script bug. Esc does not close it.

Do this:
1. Run `powershell -NoProfile -File "${CLAUDE_SKILL_DIR}/scripts/dismiss-popup.ps1"`. It activates Photoshop and clicks the blank part of Photoshop's own menu bar (harmless). Exit code 2 = Photoshop not running, 3 = minimized.
2. Retry the failed call once. Scripts must be idempotent because the failed run may have half-executed.
3. If it still fails, take a screenshot (`${CLAUDE_SKILL_DIR}/scripts/screenshot.ps1 <absolute-path.png>`), Read the PNG, and look for a dialog, popup or progress bar. Clicking the blank gray workspace beside the canvas also closes tooltips (this worked in testing); if a dialog needs a decision, ask the user.
4. Prevention (changes Photoshop settings, ask the user first): Window menu, turn off "Contextual Task Bar". On the author's machine this removed the problem (verified with a selection + hover test). Photoshop 2026 has no "Show Tool Tips" preference.

Tip: run the dismiss script proactively before a long scripted sequence if the mouse was last left over the task bar.

## An error DIALOG is on screen (e.g. "The command Show is not currently available")
A script error shows a modal dialog when `app.displayDialogs` is not `DialogModes.NO`, and that dialog blocks every later call just like a popup. Always run custom JSX with `app.displayDialogs = DialogModes.NO` (the `ps_*` tools of `studio-tools` do), so errors become exceptions. If a dialog is already open: screenshot, click its OK button, then fix the script.

## Other errors
- `The command "Show" is not currently available`: you set `visible = true` on an already visible layer (or `false` on a hidden one). Check the current value first.
- `copy` / selection errors: nothing is selected, or the active layer is empty or hidden. Check `photoshop_get_selection_bounds` and the active layer.
- Path errors: use forward slashes, avoid special characters, create the output folder first.
- Server "Failed to connect": run `claude mcp list`. The first `npx` run downloads the package and can be slow. `ANALYTICS_DISABLED=1` keeps telemetry off.
- Two copies of the server (this plugin plus a manually added `photoshop` server) cause confusion: keep one.

## Never
Do not restart or quit Photoshop to "fix" something without asking: the user may have unsaved documents.
