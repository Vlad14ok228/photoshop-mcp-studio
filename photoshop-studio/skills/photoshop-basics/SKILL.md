---
name: photoshop-basics
description: Core rules for driving Adobe Photoshop through the photoshop_* MCP tools (documents, layers, selections, export). Use at the start of ANY Photoshop task, before calling photoshop_* tools or writing ExtendScript.
---

# Photoshop basics

Reply to the user in the language they write in. These rules were verified on Photoshop 2026 (27.x), Windows, with `@alisaitteke/photoshop-mcp` 1.7.x.

## Preflight (every task)
1. `photoshop_ping`, then `photoshop_list_documents` / `photoshop_get_document_info`. Learn the document size, the active layer and whether a selection exists.
2. Photoshop must be running with a document open. If a call fails with "General Photoshop error", read the `photoshop-troubleshooting` skill first: it is usually a hint popup, not a bad script.

## Working rules
- Everything is in pixels, origin at the top-left. Get image size from `photoshop_get_document_info`, never guess it.
- Tools act on the **active layer**. Check with `photoshop_get_layers`, switch with `photoshop_select_layer_by_name`. Name layers meaningfully (`photoshop_rename_layer`).
- Prefer a dedicated tool or a `photoshop_recipe_*` over `photoshop_execute_script`. Use scripts only for what no tool does (polygon selections, Color Range, batch work).
- Batch many steps into ONE `photoshop_execute_script` call: each MCP round trip is slow.
- In scripts: always `return` a value, make the script **idempotent** (a failed run may have partly executed), and never set a property to the value it already has (`layer.visible = true` on a visible layer throws "Show is not available").
- Use forward slashes in file paths (`C:/Users/me/a.png`) so JSON escaping cannot break them.
- Prefer non-destructive edits (layer masks, duplicate layers) and remember `photoshop_undo` exists.
- Never quit Photoshop, close documents with unsaved work, or overwrite the user's files without asking. Save outputs under a new file name.

## Verify visually
After any change that matters, look at the result: `photoshop_get_preview`, or a screenshot (`photoshop-troubleshooting/scripts/screenshot.ps1`) and Read the PNG. Do not claim success from a tool's `ok: true` alone.

## Export
- Transparent PNG: hide the background layer, then `photoshop_export_as` with `format: PNG` (it exports what is visible).
- Editable file: `photoshop_save_document` with `format: PSD`.
- JPEG has no transparency.

## Where to go next
- Cutting out objects / removing backgrounds: `photoshop-cutout`.
- Anything failing or odd: `photoshop-troubleshooting`.
