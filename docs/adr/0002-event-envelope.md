# ADR-0002: Event envelope, schemas and delivery guarantees

- Status: accepted
- Date: 2026-10-26

## Decision
- Message **value** is JSON: `{ "id", "type", "source", "time", "subject", "dataschema", "data" }` (CloudEvents 1.0 field names, structured mode).
- Message **key** is the aggregate id (`subject`) so per-aggregate ordering is preserved within a partition.
- **Headers** carry `traceparent`/`tracestate` (W3C) and `ce_type` for routing without parsing.
- Each `data` payload has a JSON Schema in `shopwise-contracts/schemas/events/<context>/<event>.v<N>.json`, registered in Apicurio with **BACKWARD** compatibility. Breaking change ⇒ new major version + new topic suffix only if consumers cannot upgrade together.
- Delivery is **at-least-once**: producers use the outbox; consumers store processed `id`s in `processed_messages` inside the same transaction as their side effects.
- Poison messages go to `<topic>.dlq` after 3 attempts.
