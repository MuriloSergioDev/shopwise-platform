import { basename } from 'node:path';
import { readInput, block } from './lib.mjs';

const input = readInput().tool_input ?? {};
const file = (input.file_path ?? input.notebook_path ?? '').replace(/\\/g, '/');
const name = basename(file);

if (/^\.env(\..+)?$/.test(name) && !/\.example$/.test(name)) {
  block(`${name} holds local secrets; edit .env.example and ask the user to copy values.`);
}
if (/\.(pem|key|p12)$/.test(name) || /(^|\/)storage\/.*(private|oauth).*\.key/.test(file)) {
  block(`${name} looks like a private key; keys are generated, never written by hand.`);
}
if (/(^|\/)(vendor|node_modules)\//.test(file)) {
  block('dependencies are installed by composer/pnpm, not edited.');
}
if (/(^|\/)database\/migrations\//.test(file) && input.old_string !== undefined) {
  // Editing an existing migration is fine before it is committed; remind instead of blocking.
  process.stderr.write('Reminder: never edit a migration that is already on main; add a new one (db-migration skill).\n');
}
