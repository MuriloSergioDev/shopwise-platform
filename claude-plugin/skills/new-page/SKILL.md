---
name: new-page
description: Adds a page to the Shopwise storefront or admin Nuxt app — BFF server route, typed composable, page component, route rule and tests. Use when building UI that needs data from services.
---
# New page

Data always flows browser → Nitro BFF → service. Services and JWTs stay invisible to the browser.

1. **BFF route** `server/api/<area>/<name>.<method>.ts`: validate input with `zod` (`readValidatedBody` / `getValidatedQuery`), call the service through `serviceFetch(event, '<service>', path)` (adds the session's bearer token + `traceparent`), map to the view model. Types come from `@shopwise/contracts` (`paths['/...']`).
2. **Composable** `app/composables/use<Name>.ts` wrapping `useFetch('/api/...')` with a stable key.
3. **Page** `app/pages/...vue` using Nuxt UI components; loading, empty and error states are explicit.
4. **Rendering**: add a `routeRules` entry in `nuxt.config.ts` — public catalog-like pages `swr`, cart/checkout `ssr`, account/admin `ssr: false`.
5. **Tests**: Vitest for the BFF route (service mocked) and composable; component test for the error state.

Done when `pnpm check` is green and the page renders against services running under Tilt.
