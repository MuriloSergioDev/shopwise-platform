import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

export function readInput() {
  return JSON.parse(readFileSync(0, 'utf8') || '{}');
}

// Exit code 2 blocks the tool call and shows stderr to Claude.
export function block(reason) {
  process.stderr.write(`Blocked by shopwise guard: ${reason}\n`);
  process.exit(2);
}

// Walks up from a file to the repo root (first folder holding composer.json or package.json).
export function projectRoot(file) {
  let dir = dirname(file);
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'composer.json')) || existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return null;
}
