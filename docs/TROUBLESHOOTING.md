# Troubleshooting

## Every Photoshop call fails with "General Photoshop error occurred"
Photoshop is showing a hint popup or a dialog. Even `1 + 1` fails while it is open, and Esc does not close it. Typical source: the *Generative Fill* tooltip of the Contextual Task Bar.

1. Ask Claude to run `ps_unstick`, or click an empty gray area of the Photoshop workspace.
2. Prevent it: **Window → Contextual Task Bar** (remove the check mark). This was enough on the author's machine; Photoshop 2026 has no separate "Show Tool Tips" preference.
3. A real script error dialog (for example *The command "Show" is not currently available*) must be closed with its OK button. Custom scripts should set `app.displayDialogs = DialogModes.NO` so errors become exceptions instead of dialogs.

## `Failed to connect to Photoshop` / ping fails
Photoshop is not running or has no main window yet. Start it, wait until the home screen is visible, retry.

## `claude mcp list` shows no `studio-tools`, or it says `Failed`
- Check Node.js: `node --version` (18+).
- The first start installs dependencies (`npm ci`). Check that `npm` works and that you are online.
- Run manually to see the error: `node photoshop-studio/server/launch.mjs` (it waits for MCP messages on stdin; Ctrl+C to stop).

## Two servers named `photoshop`
You added the server by hand earlier and also installed the plugin. Remove the manual one: `claude mcp remove photoshop -s user`.

## Claude Desktop does not show the tools
- Fully quit Claude Desktop (tray icon → Quit) and start it again; closing the window is not enough.
- `node` must be on your PATH for the app. Check with `node --version` in a new terminal.
- Re-run `node scripts/claude-desktop.mjs --dry-run` to see which config file is used. Backups are next to it (`*.bak-<timestamp>`).
- If an entry named `photoshop` already existed with different settings, the installer skipped it; use `--force` to replace it.

## The cutout has pale or dark fringes
Color Range presets only catch saturated hues. Tighten the polygon near problem areas, raise `passes` (3–4), and always inspect the result on a dark and a light backdrop. For a whole-subject cutout use `photoshop_recipe_remove_background` instead.

## Where are my files?
Tools never modify the source layer; `ps_cutout_polygon` works on a duplicate. Exported files go where you tell them to; choose a new file name to avoid overwriting.
