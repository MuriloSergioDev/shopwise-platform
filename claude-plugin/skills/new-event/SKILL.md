---
name: new-event
description: Adds a Kafka domain event end to end — JSON Schema in shopwise-contracts, topic, outbox publishing in the producer, idempotent handler in each consumer. Use when a service must announce a state change or react to another service's.
---
# New event

Read `outbox-and-idempotency` first if you have not this session.

1. **Name** it `<context>.<noun>-<past-verb>` (e.g. `orders.order-placed`); the producer is the service owning `<context>` (ADR-0001). Events state past facts; commands exist only for the checkout saga.
2. **Schema** `shopwise-contracts/schemas/events/<context>/<event>.v1.json` + an envelope example in `examples/`; register in `asyncapi.yaml`; run `pnpm check` there (BACKWARD compatibility against Apicurio).
3. **Topic**: add to the producer's `deploy/values.yaml` → `topics:` (the chart creates topic + `.dlq`).
4. **Producer**: inside the Action's transaction, `Outbox::record('<context>.<event>', $aggregateId, $payload)`. Payload = the schema's `data` exactly; PII only where the schema lists it.
5. **Consumer**, per consuming service: handler `app/Messaging/Handlers/<Event>Handler.php` implementing `MessageHandler`; map it in `config/messaging.php`; add the topic to a consumer in `deploy/values.yaml`. Handlers tolerate replays and out-of-order delivery (compare versions/timestamps on the read model).
6. **Tests**: producer test asserts the outbox row; consumer test feeds the example envelope twice and asserts one effect.

Done when both sides' tests pass and Kafka UI (localhost:8082) shows the event flowing under Tilt.
