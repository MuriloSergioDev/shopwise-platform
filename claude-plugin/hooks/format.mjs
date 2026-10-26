import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readInput, projectRoot } from './lib.mjs';

const file = readInput().tool_input?.file_path;
if (!file || !existsSync(file)) process.exit(0);
const root = projectRoot(file);
if (!root) process.exit(0);

const run = (cmd, args) => {
  try {
    execFileSync(cmd, args, { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' });
  } catch {
    // Formatting is best effort; lint gates in CI and run-checks catch real problems.
  }
};

if (file.endsWith('.php') && existsSync(join(root, 'vendor/bin/pint'))) {
  run('php', ['vendor/bin/pint', file]);
} else if (/\.(ts|vue|mjs|js)$/.test(file) && existsSync(join(root, 'node_modules/.bin'))) {
  run('pnpm', ['exec', 'eslint', '--fix', file]);
}
