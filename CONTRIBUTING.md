# Contributing

Thanks for helping! Bug reports with the exact steps, your Photoshop version and the tool output are the most valuable contribution.

## Ground rules
- Every new `ps_*` tool needs unit tests for its script generation **and** an integration test that checks real pixels in Photoshop (see `photoshop-studio/server/test/integration`).
- Tools must verify their result and return `ok: false` (after rolling back) instead of reporting success on an empty or wrong result.
- Scripts sent to Photoshop must run inside `wrap()` (it disables dialogs, sets pixel units and returns JSON) and be idempotent.
- Do not commit images you do not own, personal paths or credentials.

## Workflow
1. Fork, create a branch, make the change.
2. `npm --prefix photoshop-studio/server ci` then `npm test`. With Photoshop running also `npm run test:integration`.
3. Open a pull request describing what changed and how you verified it.

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the architecture and lessons learned.
