# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2026-10-20

First public release (Windows, Claude Code and Claude Desktop).

### Added
- Claude Code plugin `photoshop-studio` with a local marketplace (`.claude-plugin/marketplace.json`).
- Photoshop MCP server (`@alisaitteke/photoshop-mcp@1.7.37`), pinned, with analytics disabled.
- `studio-tools` MCP server: `ps_cutout_polygon` (mask or pixels mode, Color Range cleanup with repeated passes, rollback on errors, idempotent) and `ps_unstick`.
- Skills: `photoshop-basics`, `photoshop-cutout`, `photoshop-troubleshooting`; scripts to dismiss Photoshop hint popups and take screenshots.
- Claude Desktop installer `scripts/claude-desktop.mjs` (backup, merge without touching other servers, `--dry-run`, `--uninstall`).
- Server instructions delivered to every MCP client.
- Tests: unit tests (script generation, popup detection, installer) and Photoshop integration tests that check real exported pixels.
- GitHub Actions CI for the unit tests.

### Known issues
- Windows only; tested with Photoshop 2026 and Claude Code. End-to-end use in Claude Desktop is not yet confirmed.
- Color Range cleanup does not remove dark or low-saturation background remnants.
