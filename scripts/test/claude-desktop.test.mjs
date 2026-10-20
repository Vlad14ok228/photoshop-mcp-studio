import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildEntries, findConfigs, mergeServers, parseConfig, removeServers } from '../claude-desktop.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'claude-desktop.mjs');
const entries = buildEntries('C:\\repo\\photoshop-studio\\server\\launch.mjs');
const existing = {
  mcpServers: { Other: { command: 'cmd.exe', args: ['/c', 'cd /d %X% && run.bat'] } },
  preferences: { sidebarMode: 'chat', nested: { list: [1, 2, 3] } },
};

test('merge adds both servers and keeps everything else untouched', () => {
  const { config, added } = mergeServers(existing, entries);
  assert.deepEqual(added, ['photoshop', 'photoshop-studio-tools']);
  assert.deepEqual(config.mcpServers.Other, existing.mcpServers.Other);
  assert.deepEqual(config.preferences, existing.preferences);
  assert.equal(config.mcpServers['photoshop-studio-tools'].command, 'node');
  assert.equal(existing.mcpServers.photoshop, undefined, 'input must not be mutated');
});

test('merge works on an empty config', () => {
  const { config } = mergeServers({}, entries);
  assert.deepEqual(Object.keys(config.mcpServers), ['photoshop', 'photoshop-studio-tools']);
});

test('an existing entry with other settings is skipped unless forced', () => {
  const custom = { mcpServers: { photoshop: { command: 'my-own' } } };
  const skipped = mergeServers(custom, entries);
  assert.deepEqual(skipped.skipped, ['photoshop']);
  assert.equal(skipped.config.mcpServers.photoshop.command, 'my-own');
  const forced = mergeServers(custom, entries, { force: true });
  assert.deepEqual(forced.updated, ['photoshop']);
  assert.equal(forced.config.mcpServers.photoshop.command, 'cmd');
});

test('merge is idempotent', () => {
  const once = mergeServers(existing, entries).config;
  const twice = mergeServers(once, entries);
  assert.deepEqual(twice.unchanged, ['photoshop', 'photoshop-studio-tools']);
  assert.deepEqual(twice.config, once);
});

test('remove deletes only our two servers', () => {
  const full = mergeServers(existing, entries).config;
  const { config, removed } = removeServers(full);
  assert.deepEqual(removed, ['photoshop', 'photoshop-studio-tools']);
  assert.deepEqual(config, existing);
});

test('parseConfig tolerates a BOM and an empty file', () => {
  assert.deepEqual(parseConfig('\uFEFF{"a":1}'), { a: 1 });
  assert.deepEqual(parseConfig('  '), {});
  assert.throws(() => parseConfig('{broken'));
});

test('findConfigs finds both the Store build and the classic install', () => {
  const home = mkdtempSync(join(tmpdir(), 'cd-find-'));
  const store = join(home, 'Local', 'Packages', 'Claude_abc123', 'LocalCache', 'Roaming', 'Claude');
  const classic = join(home, 'Roaming', 'Claude');
  mkdirSync(store, { recursive: true });
  mkdirSync(classic, { recursive: true });
  writeFileSync(join(store, 'claude_desktop_config.json'), '{}');
  writeFileSync(join(classic, 'claude_desktop_config.json'), '{}');
  const found = findConfigs({ LOCALAPPDATA: join(home, 'Local'), APPDATA: join(home, 'Roaming') });
  assert.equal(found.length, 2);
  assert.deepEqual(findConfigs({ LOCALAPPDATA: join(home, 'none'), APPDATA: join(home, 'none') }), []);
});

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

test('CLI: dry run writes nothing; install writes a backup and merges; uninstall restores', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cd-cli-'));
  const file = join(dir, 'claude_desktop_config.json');
  const original = JSON.stringify(existing, null, 2) + '\n';
  writeFileSync(file, original);

  const dry = run(['--config', file, '--dry-run']);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(readFileSync(file, 'utf8'), original, 'dry run must not change the file');

  const inst = run(['--config', file]);
  assert.equal(inst.status, 0, inst.stderr);
  const installed = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(installed.mcpServers.photoshop && installed.mcpServers['photoshop-studio-tools']);
  assert.deepEqual(installed.mcpServers.Other, existing.mcpServers.Other);
  assert.match(installed.mcpServers['photoshop-studio-tools'].args[0], /photoshop-studio[\\/]server[\\/]launch\.mjs$/);
  const backups = readdirSync(dir).filter((f) => f.includes('.bak-'));
  assert.equal(backups.length, 1);
  assert.equal(readFileSync(join(dir, backups[0]), 'utf8'), original, 'backup equals the original');

  const again = run(['--config', file]);
  assert.match(again.stdout, /No changes needed/);

  const un = run(['--config', file, '--uninstall']);
  assert.equal(un.status, 0, un.stderr);
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), existing);
});

test('CLI: invalid JSON is refused and the file is left alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cd-bad-'));
  const file = join(dir, 'claude_desktop_config.json');
  writeFileSync(file, '{ not json');
  const r = run(['--config', file]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /not valid JSON/);
  assert.equal(readFileSync(file, 'utf8'), '{ not json');
  assert.equal(existsSync(`${file}.bak`), false);
});

test('CLI: unknown option fails clearly', () => {
  const r = run(['--nope']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Unknown option/);
});
