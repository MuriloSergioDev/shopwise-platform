import { readInput, block } from './lib.mjs';

const command = readInput().tool_input?.command ?? '';

const rules = [
  [/git\s+push\b.*(--force\b|--force-with-lease\b|\s-f\b)/, 'force push rewrites shared history; push normally or ask the user.'],
  [/git\s+reset\s+--hard/, 'reset --hard discards work; use git stash or ask the user.'],
  [/git\s+clean\s+-\w*f/, 'git clean -f deletes untracked files; ask the user.'],
  [/git\s+push\b.*\b(main|master)\b/, 'push to a branch and open a PR; main is protected.'],
  [/artisan\s+(migrate:fresh|migrate:reset|db:wipe)/, 'this drops every table in the service database; ask the user first.'],
  [/kubectl\s+delete\s+(ns|namespace)\b/, 'deleting a namespace wipes Kafka/Postgres data; ask the user.'],
  [/k3d\s+cluster\s+delete/, 'deleting the cluster wipes all local data; ask the user.'],
];

for (const [pattern, reason] of rules) {
  if (pattern.test(command)) block(reason);
}
