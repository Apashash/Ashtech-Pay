# Ashtech Pay

## Overview

Ashtech Pay is a fintech payment collection platform for African mobile-money
markets. It supports user accounts, wallets, peer-to-peer transfers, payment
links, transaction history, KYC, support tickets, crypto deposits, and hosted
merchant checkouts.

The only supported mobile-money payment providers are:

- **AfribaPay** for deposits, withdrawals, transfers, and payment links.
- **PixPay** for deposits, withdrawals, transfers, and payment links.

There is no automatic fallback to an unknown or unavailable provider. If an
operator has no valid provider configuration, the API rejects the operation
with an explicit error and the client shows the error.

## User Preferences

Preferred communication style: Simple, everyday language.

## Running on Replit

- `npm run dev` starts the app through the **Start application** workflow on
  port 5000.
- The application uses PostgreSQL through `SUPABASE_DATABASE_URL` when it is
  configured, otherwise `DATABASE_URL`.
- `npm run check` runs the TypeScript compiler.
- `npm run build` builds the client and bundles the production server.
- `npm run db:push` applies the current Drizzle schema to the configured
  development database. Review schema changes before applying them to a
  shared or production database.

## System Architecture

### Frontend

- React 18 with TypeScript
- Wouter routing
- TanStack React Query for server state
- React Hook Form and Zod validation
- shadcn/ui and Radix UI components
- Tailwind CSS with a dark Binance-inspired theme
- Vite for development and production client builds

### Backend

- Node.js with Express and TypeScript
- Session-based authentication with bcrypt
- REST endpoints under `/api`
- Provider-specific integrations in `server/afribapay.ts`,
  `server/pixpay.ts`, and the IziChange crypto service
- Deposit and payout pollers only accept AfribaPay or PixPay
- Audit logging in `audit_logs` and admin activity logging in `admin_logs`

### Data layer

- PostgreSQL through Drizzle ORM
- Shared schema and types in `shared/schema.ts`
- Wallet helpers in `server/walletHelper.ts`
- Runtime compatibility migrations run during startup for deployments that
  may not have received the latest schema yet

## Provider rules

Provider values stored on operators are limited to `afribapay` and `pixpay`.
`paymentProvider` controls withdrawals and transfers. An optional
`depositPaymentProvider` controls deposits; when present it must also be one of
the two supported providers.

AfribaPay supports direct and OTP payment flows. OTP-required country/operator
pairs use the static safety table together with live provider information.
PixPay supports its configured USSD, OTP, and redirect flows.

Provider configuration is managed from the admin pages for countries,
operators, AfribaPay, PixPay, and fees. Fee calculation uses the configured
provider fee plus the Ashtech margin. Unknown providers are not displayed as
valid options and cannot be submitted to payment routes.

## Legacy provider cleanup

Historical records from the removed provider are not submitted again and are
never refunded automatically. The startup cleanup is idempotent:

- legacy operator provider values are normalized to AfribaPay;
- legacy transactions still pending are marked failed;
- affected users receive a notification explaining that no automatic refund
  was made;
- the cleanup is recorded in `audit_logs`;
- the old `fees.swychr_fee` database column, when present, is treated as
  unused and is removed only through a reviewed schema change.

## Wallets and currencies

Wallet credits and debits go through `server/walletHelper.ts`. CFA-family
currencies use the country-specific internal wallet codes, such as XAF, XAFC,
XAFG, XOFB, XOFC, XOFF, XOFN, XOFS, XOFT, and XOFM. Secondary wallets are
created for supported non-CFA currencies when needed.

Exchange-rate conversions use admin-configured `fx_rate_*` settings. Conversion
previews do not contact a payment provider or move funds.

## Security and operations

- `SESSION_SECRET` is required for production and multi-worker sessions.
- Keep `FIELD_ENCRYPTION_KEY` stable across restarts and deployments. During a
  rotation, set `FIELD_ENCRYPTION_KEY_PREVIOUS` to the old value so encrypted
  fields and existing Direct API key hashes remain readable. Do not remove the
  previous value until old records and API keys have been migrated or replaced.
- Admin actions require authentication, authorization, and the configured
  admin TOTP protections.
- Webhook endpoints are explicitly exempted from browser CSRF checks and are
  protected by their provider-specific verification logic.
- Bot protection keeps payment webhooks accessible to provider servers while
  rejecting scanner probes with a branded 404 response.

## Project structure

```text
├── client/                 # React application
├── server/                 # Express routes and provider services
│   ├── afribapay.ts        # AfribaPay API and OTP flows
│   ├── pixpay.ts           # PixPay API and flow handling
│   ├── paymentPoller.ts    # AfribaPay/PixPay deposit polling
│   ├── payoutPoller.ts     # AfribaPay/PixPay payout polling
│   ├── walletHelper.ts     # Wallet and currency operations
│   └── routes.ts           # REST API routes
├── shared/                 # Shared schema and types
└── migrations/             # Drizzle migration artifacts
```

## Environment

Core secrets and variables include:

| Name | Purpose |
|------|---------|
| `SESSION_SECRET` | Session and token signing |
| `PAWAPAY_CREDENTIAL_ENCRYPTION_KEY` | Optional stable key dedicated to PawaPay credential encryption; database connection secret is the automatic fallback |
| `SUPABASE_DATABASE_URL` | Supabase PostgreSQL connection |
| `AFRIBAPAY_PUBLIC_KEY` | AfribaPay public credential |
| `AFRIBAPAY_SECRET_KEY` | AfribaPay secret credential |
| `PIXPAY_API_KEY_XAF` | PixPay XAF credential |
| `RESEND_API_KEY` | Transactional email |
| `ADMIN_PIN_CODE` | Admin security control |
| `IZIPAY_API_KEY` | IziChange crypto checkout |
| `IZIPAY_WEBHOOK_SECRET` | IziChange webhook verification |

Provider credentials must be configured through the workspace secret
management flow and must never be committed to the repository.