---
name: new-service
description: Creates a new Shopwise Laravel microservice repo from shopwise-service-template and wires it into Tilt, Postgres, CI and the Claude plugin. Use when a bounded context needs its own service.
---
# New service

1. Confirm the boundary with the `domain-architect` agent; a new service needs an ADR.
2. From the workspace folder: `gh repo create MuriloSergioDev/shopwise-<name> --template MuriloSergioDev/shopwise-service-template --clone` (same visibility as the other repos).
3. Replace `ping` with `<name>` in `deploy/values.yaml`, `composer.json` (`name`), `AGENTS.md`, `README.md`; delete the `Ping*` example classes, their tests and the `platform.pinged` topic.
4. Register in `shopwise-platform`: `services.yaml` (next free port) and the database list in `infra/base/postgres.yaml`. On an existing cluster the init script will not rerun, so also: `kubectl exec postgres-0 -- psql -U postgres -c "CREATE ROLE <name> LOGIN PASSWORD '<name>'" -c "CREATE DATABASE <name> OWNER <name>"`.
5. Write the service's `AGENTS.md`: what it owns, events in/out, REST dependencies.

Done when `tilt up -- --only=<name>` shows the service green and CI passes on its first PR.
