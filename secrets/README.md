# Local secrets

Real credentials never go in git or in the chart. For any service, `secrets/<service>.env` (gitignored, `KEY=value`
lines) becomes the `<service>-secrets` Kubernetes Secret, which the `laravel-service` chart loads into every pod of
that service with `envFrom`. Tilt watches the file and re-applies the Secret when it changes. Pods read env vars only
at startup, so restart them afterwards: `kubectl rollout restart deploy -l app=<service>`.

## Stripe (payments)

1. `cp secrets/payments.env.example secrets/payments.env` and fill in `STRIPE_KEY` / `STRIPE_SECRET` with **test-mode**
   keys (`pk_test_...`, `sk_test_...`).
2. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) (`winget install Stripe.StripeCli`).
3. In the Tilt UI, start the `stripe-listen` resource (it's off by default). It runs
   `stripe listen --forward-to localhost:8107/api/webhooks/stripe`, signing in with `STRIPE_SECRET`.
4. Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`, then restart payments:
   `kubectl rollout restart deploy -l app=payments`. The secret stays the same across `stripe listen` runs for the
   same account, so this is a one-off.

Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 9995` declines.
