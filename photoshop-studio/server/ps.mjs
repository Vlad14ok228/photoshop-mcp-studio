// Runs ExtendScript in Photoshop via PowerShell + COM, with automatic recovery from hint popups.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(HERE, 'run-jsx.ps1');
const DISMISS = join(HERE, '..', 'skills', 'photoshop-troubleshooting', 'scripts', 'dismiss-popup.ps1');

function powershell(args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args], {
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(e) });
    });
  });
}

/**
 * A hint popup gives a bare "General Photoshop error"; a real script error also carries "Error N:" / "Line:"
 * and must not be retried (a retry would just click the screen for nothing).
 */
export function isPopupError(stderr) {
  return /General Photoshop error/i.test(stderr) && !/Error \d+:|Line:/i.test(stderr);
}

/** Closes Photoshop hint popups that make every COM call fail. Returns the script's output. */
export async function dismissPopup() {
  const r = await powershell(['-File', DISMISS], 20000);
  return (r.stdout + r.stderr).trim();
}

/**
 * Executes a JSX body (already wrapped so that it returns a JSON string) in Photoshop.
 * Retries once after dismissing a popup when Photoshop answers "General Photoshop error".
 * @returns {Promise<object>} the parsed JSON the script returned
 */
export async function runJsx(code, { timeoutMs = 60000 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'ps-studio-'));
  const file = join(dir, 'script.jsx');
  try {
    await writeFile(file, code, 'utf8');
    let r = await powershell(['-File', RUNNER, '-JsxPath', file], timeoutMs);
    let recovered = false;
    if (r.code !== 0 && isPopupError(r.stderr)) {
      await dismissPopup();
      recovered = true;
      r = await powershell(['-File', RUNNER, '-JsxPath', file], timeoutMs);
    }
    if (r.code !== 0) {
      return { ok: false, error: r.stderr.trim() || `PowerShell exited with ${r.code}`, popup_recovery_tried: recovered };
    }
    try {
      const parsed = JSON.parse(r.stdout);
      return recovered ? { ...parsed, popup_recovered: true } : parsed;
    } catch {
      return { ok: false, error: 'Photoshop returned a non-JSON result', raw: r.stdout.slice(0, 500) };
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
