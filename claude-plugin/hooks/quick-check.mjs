// Stop hook: syntax/type check only files changed in the working tree, so it stays fast.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readInput } from './lib.mjs';

const input = readInput();
if (input.stop_hook_active) process.exit(0);
const cwd = input.cwd ?? process.cwd();

let changed = [];
try {
  changed = execSync('git status --porcelain', { cwd, encoding: 'utf8' })
    .split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
} catch {
  process.exit(0);
}

const has = (cmd) => {
  try {
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const errors = [];
const phpFiles = has('php -v') ? changed.filter((f) => f.endsWith('.php') && existsSync(join(cwd, f))) : [];
for (const f of phpFiles) {
  try {
    execSync(`php -l "${f}"`, { cwd, stdio: 'pipe' });
  } catch (e) {
    errors.push(String(e.stdout || e.message));
  }
}
if (changed.some((f) => /\.(ts|vue)$/.test(f)) && existsSync(join(cwd, 'node_modules/.bin'))) {
  try {
    execSync('pnpm exec nuxi typecheck', { cwd, stdio: 'pipe' });
  } catch (e) {
    errors.push(String(e.stdout || e.message).slice(0, 4000));
  }
}
if (errors.length) {
  process.stderr.write(`Quick check failed on changed files:\n${errors.join('\n')}\n`);
  process.exit(2);
}
