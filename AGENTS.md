# shopwise-platform

Local runtime, shared tooling and architecture records for Shopwise. No application code lives here.

## What is here
- `Tiltfile`, `services.yaml` — local environment; services are discovered from sibling `../shopwise-*` folders.
- `k3d/cluster.yaml` — the `k3d-shopwise` cluster (with local registry `shopwise-registry:5005`).
- `infra/base/` — Kafka (Strimzi, KRaft), Postgres (one DB per service), Redis, Mailpit, Apicurio, Kafka UI, Grafana LGTM.
- `charts/laravel-service/` — the single Helm chart every Laravel service deploys with (http, consumers, scheduler, optional queue worker, topics); per-service settings live in each service's `deploy/values.yaml`.
- `.github/workflows/{laravel-ci,nuxt-ci,pr-hygiene,release,claude}.yml` — reusable workflows called by every other repo. Changing an input is a breaking change for callers.
- `claude-plugin/` + `.claude-plugin/marketplace.json` — the `shopwise` Claude Code plugin (subagents, skills, hooks) every repo enables.
- `docs/adr/`, `docs/GLOSSARY.md` — architecture decisions and ubiquitous language. Read ADR-0001 before touching service boundaries.

## Conventions
- Infra images are pinned to exact versions; bump them deliberately (Renovate PRs).
- Kafka topics are owned by one service (the producer of an event, the receiver of a command) and declared in its chart
  values. `services.yaml` lists each service's owned topics too: Tilt creates any that no deployed chart declares, so a
  topic exists even when its owner isn't running. Keep the two lists in sync with `shopwise-contracts/asyncapi.yaml`.
- Local credentials are intentionally trivial (`<service>/<service>`); anything real (Stripe keys) goes in the gitignored
  `secrets/<service>.env`, which Tilt turns into the `<service>-secrets` Secret (see `secrets/README.md`).
- New ADRs: next number, same format, status + date + context/decision/consequences.

## Checks
`helm lint charts/laravel-service --set name=x,image=x` and `node --check claude-plugin/hooks/*.mjs`; CI runs both plus a guard-hook smoke test.
