#!/usr/bin/env node
// Adds (or removes) the Photoshop MCP servers in the Claude Desktop config, safely:
// it backs the config up first and never touches any other server or setting.
//
//   node scripts/claude-desktop.mjs                 install
//   node scripts/claude-desktop.mjs --dry-run       show what would change, write nothing
//   node scripts/claude-desktop.mjs --uninstall     remove our two entries
//   node scripts/claude-desktop.mjs --config <file> use a specific config file
//   node scripts/claude-desktop.mjs --force         overwrite entries that already exist with other settings
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PHOTOSHOP_PACKAGE = '@alisaitteke/photoshop-mcp@1.7.37';
export const SERVER_NAMES = ['photoshop', 'photoshop-studio-tools'];
const CONFIG_FILE = 'claude_desktop_config.json';

/** Existing Claude Desktop config files, newest first (Microsoft Store build and classic installer). */
export function findConfigs(env = process.env) {
  const found = [];
  const local = env.LOCALAPPDATA;
  const roaming = env.APPDATA;
  if (local && existsSync(join(local, 'Packages'))) {
    for (const dir of readdirSync(join(local, 'Packages'))) {
      if (/^Claude_/i.test(dir)) found.push(join(local, 'Packages', dir, 'LocalCache', 'Roaming', 'Claude', CONFIG_FILE));
    }
  }
  if (roaming) found.push(join(roaming, 'Claude', CONFIG_FILE));
  return found.filter((p) => existsSync(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

export function buildEntries(launchPath) {
  return {
    photoshop: {
      command: 'cmd',
      args: ['/c', 'npx', '-y', PHOTOSHOP_PACKAGE],
      env: { ANALYTICS_DISABLED: '1', PSMCP_FEEDBACK: '0' },
    },
    'photoshop-studio-tools': { command: 'node', args: [launchPath] },
  };
}

/** Returns a new config with our servers added; existing entries are kept unless `force` is set. */
export function mergeServers(config, entries, { force = false } = {}) {
  const next = structuredClone(config);
  next.mcpServers ??= {};
  const added = [], updated = [], skipped = [], unchanged = [];
  for (const [name, entry] of Object.entries(entries)) {
    const current = next.mcpServers[name];
    if (current === undefined) { next.mcpServers[name] = entry; added.push(name); }
    else if (JSON.stringify(current) === JSON.stringify(entry)) unchanged.push(name);
    else if (force) { next.mcpServers[name] = entry; updated.push(name); }
    else skipped.push(name);
  }
  return { config: next, added, updated, skipped, unchanged };
}

/** Returns a new config without our servers. */
export function removeServers(config) {
  const next = structuredClone(config);
  const removed = [];
  for (const name of SERVER_NAMES) {
    if (next.mcpServers && name in next.mcpServers) { delete next.mcpServers[name]; removed.push(name); }
  }
  return { config: next, removed };
}

export function parseConfig(text) {
  const clean = text.replace(/^﻿/, '').trim();
  return clean === '' ? {} : JSON.parse(clean);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

function parseArgs(argv) {
  const opts = { dryRun: false, uninstall: false, force: false, config: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--uninstall') opts.uninstall = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--config') opts.config = argv[++i];
    else throw new Error(`Unknown option: ${a}`);
  }
  return opts;
}

export function main(argv = process.argv.slice(2), env = process.env, log = console.log) {
  const opts = parseArgs(argv);
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 18) throw new Error(`Node.js 18 or newer is required (found ${process.versions.node}).`);

  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const launchPath = join(root, 'photoshop-studio', 'server', 'launch.mjs');
  if (!opts.uninstall && !existsSync(launchPath)) throw new Error(`Cannot find ${launchPath}. Run this script from a full clone of the repository.`);

  let configPath = opts.config;
  if (!configPath) {
    const found = findConfigs(env);
    if (found.length === 0) {
      throw new Error('Claude Desktop config not found. Start Claude Desktop once so it creates the file, or pass --config <path>.');
    }
    if (found.length > 1) log(`Several Claude Desktop configs found, using the most recently changed one:\n  ${found.join('\n  ')}`);
    configPath = found[0];
  }
  log(`Config: ${configPath}`);

  const original = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  let config;
  try { config = parseConfig(original); }
  catch (e) { throw new Error(`The config is not valid JSON, nothing was changed: ${e.message}`); }

  const result = opts.uninstall
    ? removeServers(config)
    : mergeServers(config, buildEntries(launchPath), { force: opts.force });

  if (opts.uninstall) log(result.removed.length ? `Removing: ${result.removed.join(', ')}` : 'Nothing to remove.');
  else {
    if (result.added.length) log(`Adding: ${result.added.join(', ')}`);
    if (result.updated.length) log(`Updating: ${result.updated.join(', ')}`);
    if (result.unchanged.length) log(`Already configured: ${result.unchanged.join(', ')}`);
    if (result.skipped.length) log(`Skipped (an entry with this name already exists with different settings; use --force to replace it): ${result.skipped.join(', ')}`);
  }

  const changed = JSON.stringify(result.config) !== JSON.stringify(config);
  if (!changed) { log('No changes needed.'); return { configPath, changed: false }; }
  if (opts.dryRun) { log('Dry run: nothing was written.'); return { configPath, changed: true, written: false }; }

  let backup;
  if (existsSync(configPath)) {
    backup = `${configPath}.bak-${timestamp()}`;
    copyFileSync(configPath, backup);
    log(`Backup: ${backup}`);
  }
  writeFileSync(configPath, JSON.stringify(result.config, null, 2) + '\n', 'utf8');
  log('Done. Fully quit Claude Desktop (tray icon > Quit) and start it again. Photoshop must be running when you use the tools.');
  return { configPath, changed: true, written: true, backup };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); }
  catch (e) { console.error(`Error: ${e.message}`); process.exit(1); }
}
