# shopwise-platform

Local platform for **Shopwise**, a learning-oriented ecommerce built as Laravel microservices + Nuxt.

## Prerequisites (Windows 11)
Docker Desktop (WSL2 backend, ≥ 12 GB memory), `k3d`, `kubectl`, `helm`, `tilt`, `pnpm`, `gh`.

## Start
```sh
k3d cluster create --config k3d/cluster.yaml   # once
tilt up                                         # infra + all cloned services
tilt up -- --only=ping                          # infra + a subset
```

| UI | URL |
|---|---|
| Tilt | http://localhost:10350 |
| Grafana (traces/logs/metrics) | http://localhost:3030 |
| Kafka UI | http://localhost:8082 |
| Mailpit | http://localhost:8025 |
| Apicurio registry API | http://localhost:8081 |

Clone the other repos next to this one (`../shopwise-<name>`); Tilt picks up every service with a `Dockerfile`.

## Claude Code
Every Shopwise repo enables the `shopwise` plugin from this repo's marketplace (see `.claude/settings.json` in each repo):
subagents `code-reviewer`, `security-reviewer`, `test-writer`, `api-contract-keeper`, `domain-architect`;
skills for scaffolding, checks, contracts, migrations, debugging and domain patterns; guard + format hooks.
