---
name: run-checks
description: Runs the full quality gate (format, static analysis, tests) for the current Shopwise repo. Use before declaring work done, before a commit or PR, or when CI failed.
---
# Run checks

1. Detect the repo kind: `composer.json` → Laravel service or kit; `package.json` with `nuxt` → Nuxt app; `shopwise-contracts` → `pnpm check` (schema validation + compatibility).
2. Run the gate:
   - Laravel, host has PHP: `composer check` (Pint --test, Rector --dry-run, Larastan, Pest --parallel).
   - Laravel, no host PHP: `kubectl exec deploy/<service>-http -- composer check` (service must be running under Tilt).
   - Nuxt: `pnpm check` (ESLint, `nuxi typecheck`, Vitest).
3. Fix what fails, then rerun the **whole** gate — a fix in one tool can break another (Rector ↔ Pint, ESLint ↔ types).

Done when one full run exits 0. Report the final command and its summary line; when you stop with failures left, quote them.
