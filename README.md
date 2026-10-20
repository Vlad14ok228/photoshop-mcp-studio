# Photoshop MCP Studio

[![CI](https://github.com/Vlad14ok228/photoshop-mcp-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Vlad14ok228/photoshop-mcp-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Control Adobe Photoshop from **Claude Code** and **Claude Desktop** in plain language ("cut out the girl", "make a 1080x1080 banner with this text").

This repository packages three things so you can set everything up in a few minutes:

1. **A Photoshop MCP server** (128 tools: documents, layers, selections, filters, export, background removal, ...). It is the open-source [`@alisaitteke/photoshop-mcp`](https://github.com/alisaitteke/photoshop-mcp), pinned to a tested version with its anonymous telemetry switched off.
2. **`studio-tools`, our own MCP server** with high-level, tested tools, for example `ps_cutout_polygon` (cut one specific object out of an image, non-destructively) and `ps_unstick` (close Photoshop hint popups that block scripting).
3. **Skills and guides for Claude** (Claude Code) so the AI knows which tool to use when, and which approaches do *not* work. The same key rules are built into the server instructions, so Claude Desktop gets them too.

> Unofficial community project. Not affiliated with or endorsed by Adobe or Anthropic.

## Requirements

| | |
|---|---|
| OS | **Windows 10/11** (macOS is not supported yet) |
| Photoshop | 2025 or 2026. Developed and tested on Photoshop 2026 (27.0). Photoshop must be **running** when you use the tools |
| Node.js | 18 or newer ([nodejs.org](https://nodejs.org/)) |
| Claude | [Claude Code](https://claude.com/claude-code) and/or Claude Desktop |
| Git | Needed for Claude Desktop setup (clone) |

## Install: Claude Code

```powershell
claude plugin marketplace add Vlad14ok228/photoshop-mcp-studio
claude plugin install photoshop-studio@photoshop-mcp-studio
```

Restart Claude Code, then check:

```powershell
claude mcp list
```

You should see `plugin:photoshop-studio:photoshop` and `plugin:photoshop-studio:studio-tools`, both `Connected`. The first start of `studio-tools` installs its dependencies automatically (a few seconds).

If you already added a server called `photoshop` by hand, remove it to avoid duplicates: `claude mcp remove photoshop -s user`.

## Install: Claude Desktop

```powershell
git clone https://github.com/Vlad14ok228/photoshop-mcp-studio.git
cd photoshop-mcp-studio
node scripts/claude-desktop.mjs --dry-run   # shows what will change, writes nothing
node scripts/claude-desktop.mjs             # does it
```

The script finds your Claude Desktop config (Microsoft Store build or classic installer), **makes a backup**, adds two servers (`photoshop`, `photoshop-studio-tools`) and leaves every other server and setting untouched. Then **fully quit Claude Desktop** (tray icon, Quit) and start it again.

Keep the cloned folder where it is: the config points into it. To remove everything: `node scripts/claude-desktop.mjs --uninstall`.

> Claude Desktop does not load Claude Code skills. It receives the key rules through the server instructions of `studio-tools` instead.

## Quick test

1. Start Photoshop.
2. Ask Claude: *"Open C:\Pictures\photo.jpg in Photoshop and remove the background."*
3. Or: *"Create a 800x600 document with a blue layer and the text Hello."*

More example requests are in [docs/EXAMPLES.md](docs/EXAMPLES.md).

## Strongly recommended Photoshop setting

Photoshop shows hint popups (for example the *Generative Fill* tooltip of the Contextual Task Bar). While one is open, **every scripting call fails** with `General Photoshop error`. Turn the bar off once:

**Window → Contextual Task Bar** (remove the check mark).

`ps_unstick` can close a popup that still appears. See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## What is included

| Piece | What it does |
|---|---|
| `photoshop` server | The generic 128 tools. `photoshop_recipe_remove_background` removes the background around the main subject in one call |
| `ps_cutout_polygon` | Cuts **one** object out by polygon (pixel coordinates), as a layer mask or as pixels, with Color Range cleanup. Works on a copy and rolls back on errors |
| `ps_unstick` | Closes Photoshop hint popups |
| Skills (Claude Code) | `photoshop-basics`, `photoshop-cutout`, `photoshop-troubleshooting` |

## Known limitations (read this)

- **Windows only**, tested only with Photoshop 2026 and Claude Code. The Claude Desktop installer is covered by automated tests and was dry-run against a real config, but end-to-end use in Claude Desktop has not been confirmed yet.
- `ps_cutout_polygon` needs coordinates. Color Range cleanup only catches saturated hues, so on a hard image a thin pale fringe or dark remnants can remain. Measured on one test illustration: 6.1% fringe without cleanup, 1.3% with 4 passes. Always look at the result.
- For "remove the background around the main subject" use `photoshop_recipe_remove_background`; it cannot be told which of several objects to keep.

## Privacy and security

- Everything runs **locally**. The tools talk to your Photoshop through Windows COM; no image is uploaded by this project.
- The third-party server collects anonymous usage analytics by default. **This project turns it off** (`ANALYTICS_DISABLED=1`, `PSMCP_FEEDBACK=0`). If you add that server yourself, do the same.
- The `photoshop_execute_script` tool of the generic server runs arbitrary ExtendScript inside Photoshop. This is powerful: only connect it to AI clients you trust and review what it is asked to do.
- The third-party package is pinned to `1.7.37` on purpose. Update the pin deliberately after reading its changelog.

## Uninstall

- Claude Code: `claude plugin uninstall photoshop-studio@photoshop-mcp-studio` and `claude plugin marketplace remove photoshop-mcp-studio`.
- Claude Desktop: `node scripts/claude-desktop.mjs --uninstall`, then delete the folder.
- Optional: turn the Contextual Task Bar back on in Photoshop (Window menu).

## Development and contributing

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (architecture, tests, how to add a tool, lessons learned) and [CONTRIBUTING.md](CONTRIBUTING.md).

## License and credits

[MIT](LICENSE). Uses [`@alisaitteke/photoshop-mcp`](https://github.com/alisaitteke/photoshop-mcp) (MIT) at run time; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
