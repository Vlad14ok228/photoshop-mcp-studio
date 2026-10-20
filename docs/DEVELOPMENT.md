# Development

## Layout
```
.claude-plugin/marketplace.json      marketplace that lists the plugin
photoshop-studio/                    the Claude Code plugin
  .claude-plugin/plugin.json
  .mcp.json                          starts the two MCP servers
  skills/                            Claude Code skills + helper scripts (popup dismiss, screenshot)
  server/                            `studio-tools` MCP server (Node, ESM)
    launch.mjs                       installs dependencies on first run, then starts index.mjs
    index.mjs                        tool definitions + server instructions
    jsx.mjs                          builds ExtendScript (pure functions, unit-tested)
    ps.mjs, run-jsx.ps1              runs ExtendScript in Photoshop via PowerShell + COM, recovers from popups
    test/                            unit tests; test/integration/ tests against a real Photoshop
scripts/claude-desktop.mjs           Claude Desktop installer (+ tests in scripts/test)
```

## Run the tests
```powershell
npm --prefix photoshop-studio/server ci
npm test                     # unit tests, no Photoshop needed (this is what CI runs)
npm run test:integration     # needs Photoshop running; creates and closes its own document
```
The integration tests build a synthetic document, run the tool, export a PNG through *Save for Web* and decode real pixels, so they verify what the user actually gets.

## Adding a tool
1. Write a builder in `jsx.mjs` that returns a script wrapped by `wrap()`. Validate inputs in JavaScript before anything reaches Photoshop.
2. Register it in `index.mjs` (zod schema, a description that says *when to use it and when not to*).
3. Unit-test the generated script (parse check, escaping, validation) and add an integration test with real pixel assertions, including a failure and rollback case.
4. Document it in the README, the relevant skill and `CHANGELOG.md`.

## Lessons learned (do not repeat)
- **A hint popup blocks all COM scripting.** Even `1+1` fails with "General Photoshop error occurred". Close it (click blank workspace) and retry; prevent it by turning the Contextual Task Bar off. Retry only for the *bare* message; a real script error also contains `Error N:` / `Line:`.
- **Scripts must run with `app.displayDialogs = DialogModes.NO`.** Otherwise a script error opens a modal dialog that blocks every later call.
- **Never set `layer.visible` to its current value.** Photoshop reports "The command Show is not currently available".
- **ExtendScript has no `JSON`.** `wrap()` includes a small polyfill.
- **Color Range character IDs:** `Rds `, `Ylws`, `Grns`, `Cyns`, `Bls `, `Mgnt` (blue is `Bls `, not `Blus`). The integration test checks all of them against Photoshop.
- **Color Range with a mask targeted selects nothing, and filling with no selection blackens the whole mask.** Sample the RGB pixels, fill the mask only if there is a selection, and treat an empty result as an error.
- **Pastel pixels are only partly selected per pass.** Repeat the cleanup (measured: 1 pass 4.1% fringe, 2 passes 2.8%, 4 passes 1.3%); a larger fuzziness changed nothing.
- **What does not work for cutting out one object:** magic wand on stippled textures (selects only the outlines), Select Subject on an already cut-out layer (selects the whole layer), and native Remove Background on a roughly cropped layer (treats the crop as the subject).
- **The UXP bridge of the generic server only serves Neural Filters.** All other tools use COM. Loading UXP plugins without Creative Cloud is not possible (manually copied plugins are ignored by Photoshop).
- **A tool that says `ok` can still be wrong.** Always verify the result (empty-result guard, exported-pixel tests).
- Tooling notes (Windows): in Git Bash use `MSYS_NO_PATHCONV=1` when passing `/c`; PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM.

## Releasing an update
1. Change code, docs and skills; run `npm test` (and `npm run test:integration` with Photoshop running).
2. Bump the version in **all three** places: `package.json`, `photoshop-studio/.claude-plugin/plugin.json`, `photoshop-studio/server/package.json` (and the `version` in `photoshop-studio/server/index.mjs`).
   Claude Code updates an installed plugin only when its version changes.
3. Add an entry to `CHANGELOG.md`.
4. Commit and push to `main`; wait for CI to pass.
5. Tag and publish: `git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z`, then `gh release create vX.Y.Z --notes-file ...`.
6. Users update with `claude plugin update photoshop-studio@photoshop-mcp-studio` (restart Claude Code) or `git pull` for the Claude Desktop installation.

Before publishing, check that nothing personal is staged (no images, absolute user paths, credentials) and that commits use a GitHub noreply address.
