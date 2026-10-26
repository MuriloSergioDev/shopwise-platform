---
name: outbox-and-idempotency
description: Shopwise's transactional outbox and idempotent consumer patterns (shopwise/laravel-kit). Use when publishing or consuming Kafka events, debugging duplicate or missing events, or writing a message handler.
---
# Outbox and idempotency

**Publishing.** `Outbox::record($type, $subject, $data)` inserts into `outbox_messages` inside the caller's DB transaction, capturing the current `traceparent`. The scheduler runs `shopwise:relay-outbox` every second: it publishes unpublished rows in id order (key = `subject`), then sets `published_at`. A crash between publish and update republishes → at-least-once. Domain code only ever talks to `Outbox`, never to the Kafka producer.

**Consuming.** `shopwise:consume <topics...>` reads with consumer group = service name, decodes the envelope (ADR-0002), and per message runs one DB transaction: insert `processed_messages(id)` (unique) → mapped `MessageHandler::handle($envelope)`. Duplicate id → skipped and committed. Exception → retried 3× with backoff, then copied to `<topic>.dlq` and committed so the partition keeps moving.

**Handlers:**
- write only to their own service DB (the transaction covers dedup + effects);
- publish follow-up events via `Outbox::record` in that same transaction;
- tolerate out-of-order events: keep `source_version` / `occurred_at` on read models and ignore older updates;
- defer irreversible side effects (Stripe calls, mail) to a queued job dispatched `afterCommit`.

Testing: feed the example envelope from `shopwise-contracts/examples/` twice; assert exactly one effect.
