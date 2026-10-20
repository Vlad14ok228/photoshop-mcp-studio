#!/usr/bin/env node
// Launcher: installs dependencies on first run (output goes to stderr so MCP stdout stays clean), then starts the server.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

if (!existsSync(join(here, 'node_modules', '@modelcontextprotocol'))) {
  process.stderr.write('[studio-tools] first run: installing dependencies...\n');
  const npmArgs = ['ci', '--omit=dev', '--no-audit', '--no-fund'];
  const [cmd, args] = process.platform === 'win32' ? ['cmd.exe', ['/d', '/c', 'npm', ...npmArgs]] : ['npm', npmArgs];
  const r = spawnSync(cmd, args, { cwd: here, stdio: ['ignore', process.stderr, process.stderr] });
  if (r.status !== 0) {
    process.stderr.write('[studio-tools] npm ci failed\n');
    process.exit(1);
  }
}

await import('./index.mjs');
