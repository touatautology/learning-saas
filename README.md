# MetaLearningSaaS

AI-first safe SaaS that teaches users to build SaaS by learning the process, not by buying templates. Agents can operate the UI in staging, and humans approve promotions to production.

## Features

- Learning modules (Markdown + checklist JSON) with staging/prod separation
- RBAC: `ADMIN`, `LEARNER`, `AGENT`
- Stripe Checkout + Webhook subscription tracking
- Run/Diff/Evaluation tracking for every content change
- Audit logs for both success and failure events
- AI-friendly UI instrumentation (`data-page`, `data-action`, `data-form`)

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Database**: [Postgres](https://www.postgresql.org/)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **Payments**: [Stripe](https://stripe.com/)
- **UI Library**: [shadcn/ui](https://ui.shadcn.com/)

## Getting Started

```bash
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill values:

- `POSTGRES_URL`
- `BASE_URL`
- `AUTH_SECRET`
- `STRIPE_MODE` (`test` or `live`)
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET_TEST`
- `STRIPE_WEBHOOK_SECRET_LIVE`
- `ENABLE_TEST_ENDPOINTS` (`true` only for local testing)
- `SKIP_STRIPE_SEED` (`true` to avoid Stripe product creation in CI)

### Database Setup

```bash
pnpm db:setup
pnpm db:migrate
pnpm db:seed
```

Seeded users:

- `admin@test.com` / `admin123`
- `agent@test.com` / `admin123`
- `learner@test.com` / `admin123`

### Run the App

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stripe Test Flow

1. Install and log in to the Stripe CLI: `stripe login`
2. Forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

3. Use test card `4242 4242 4242 4242` with any future date + CVC.

## Staging vs Prod

- All learning modules are created in `staging` by default.
- `AGENT` can only write to `staging`.
- `ADMIN` approves runs and promotes changes to `prod`.
- `LEARNER` can only view `prod` modules with an active subscription.

## Tests

Playwright E2E:

```bash
ENABLE_TEST_ENDPOINTS=true pnpm test:e2e
```

RBAC-only test:

```bash
ENABLE_TEST_ENDPOINTS=true pnpm test:rbac
```

Unit tests (webhook signature verification):

```bash
pnpm test:unit
```

Lint + typecheck:

```bash
pnpm lint
pnpm typecheck
```

CI records evaluation results into the latest Run:

```bash
CI_E2E_STATUS=passed CI_RBAC_STATUS=passed pnpm ci:record
```

## Production Notes

- Use `STRIPE_MODE=live` and populate the `*_LIVE` keys.
- Webhook secrets are environment-specific.
- Do not expose Stripe secret keys in the UI; set via environment variables only.
