---
name: debug-service
description: Inspects and debugs the local Shopwise cluster — pod status, logs, Kafka topics and consumer lag, traces in Grafana, Postgres data. Use when a service is unhealthy, an event did not arrive, or a request fails across services.
---
# Debug the local cluster

Everything runs in the `k3d-shopwise` kube context under Tilt (`shopwise-platform/Tiltfile`).

| Look at | How |
|---|---|
| Resource status | `tilt get uiresources`, or the Tilt UI at localhost:10350 |
| Pods | `kubectl get pods -l app=<service>` |
| Logs | `kubectl logs deploy/<service>-http` / `-consumer-<name>` / `-scheduler` (`--previous` after a crash) |
| Topics, lag, messages | Kafka UI at localhost:8082; `kubectl get kafkatopics` |
| Unrelayed events | `select * from outbox_messages where published_at is null` in the producer DB: `psql -h localhost -U <service> <service>` (password = service name) |
| Failed messages | the `<topic>.dlq` topic in Kafka UI |
| Traces and logs | Grafana at localhost:3030 → Explore → Tempo, filter `service.name` |
| Mail | Mailpit at localhost:8025 |

Work from the symptom inward: find the trace for the failing request, see which span errored, then read that pod's logs. Prove the cause with evidence (a log line, a row, a span) before changing code. Report the evidence chain and the fix.
