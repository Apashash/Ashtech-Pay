# Ashtech Pay

## Overview

Ashtech Pay is a fintech payment collection platform targeting African mobile money markets. The application enables merchants to collect payments, create payment links, and manage their digital wallet. The platform uses Swychr as its exclusive payment gateway, supporting 22 countries across Africa and Asia.

Key payment gateway: **Swychr** — creates hosted payment links (redirect-based flow), supports per-country fee structure (Swychr base fee + Ashtech margin = total client fee).

Key features include:
- User registration and authentication
- Wallet balance management
- Peer-to-peer transfers between users
- Payment link generation with unique slugs
- Transaction history tracking
- Mobile Money and crypto payment methods
- WhatsApp-style chat support system with tickets
- KYC verification with document uploads and address fields
- **Hosted Payment Page**: Full API for merchant-hosted checkouts with pk_live/sk_live/hp_live keys, `/hpay/:id` public checkout page, `POST /api/v1/hosted-payment/create` endpoint

## User Preferences

Preferred communication style: Simple, everyday language.

## Running on Replit

- `npm run dev` starts the app (bound to the "Start application" workflow) on port 5000.
- Database is already provisioned via `DATABASE_URL`/`SUPABASE_DATABASE_URL`; run `npm run db:push` after schema changes.
- Country/operator reference data is seeded via `npx tsx scripts/seed-countries.ts` (already run once). Note: `afribapay_operator_code` is NULL for all seeded operators — the app falls back to guessing the AfribaPay code from the operator's display name (see `resolveAfribaPayOperatorCode` in `server/routes.ts`).
- Optional secrets not yet configured (see full list below) — related features are disabled/degraded until set. Notably: `ADMIN_PIN_CODE` fail-secure blocks all admin mutations without it; `FIELD_ENCRYPTION_KEY` absent means sensitive fields are stored in cleartext (security-sensitive, not just a feature toggle) — set it before handling real user data; `SWYCHR_EMAIL`/`SWYCHR_PASSWORD` disable the payment gateway; `SUPABASE_*` fall back to local file storage; `RESEND_API_KEY` disables email sending.
- `db:push` applies the current Drizzle schema directly to whatever database `DATABASE_URL` points to — safe for this dev database, but do not run it against a production/shared database without reviewing the diff first.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Form Handling**: React Hook Form with Zod validation
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with dark mode default (Binance-inspired dark theme)
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **Session Management**: Express-session with MemoryStore (development) / connect-pg-simple (production ready)
- **Authentication**: Session-based auth with bcrypt password hashing
- **API Pattern**: REST API endpoints prefixed with `/api`

### Data Layer
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `db:push` command

### Database Schema
Three main tables:
1. **users**: Account info, balance, verification status
2. **transactions**: All financial movements (deposits, withdrawals, transfers)
3. **payment_links**: Shareable payment links with slugs

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/ui/  # shadcn/ui components
│       ├── pages/          # Route pages
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities and query client
├── server/           # Express backend
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Database operations interface
│   ├── walletHelper.ts   # Smart wallet crediting: loadFxRates, convertFromXAF, convertToXAF, creditUserWallet, cleanupEmptyWallets
│   ├── paymentPoller.ts  # Polls Swychr payment status, credits wallets on completion
│   ├── payoutPoller.ts   # Polls Swychr payout status
│   ├── swychr.ts         # Swychr payin API (deposits, payment links)
│   ├── swychrPayout.ts   # Swychr/AccountPE payout API (withdrawals, transfers)
│   └── db.ts             # Database connection
├── shared/           # Shared code (schemas, types)
└── migrations/       # Database migrations
```

### Wallet Crediting Logic (`server/walletHelper.ts`)

All payment credits (deposits, payment links, conversions) go through `creditUserWallet`:
1. **CFA franc payments** (XAF, XOF, XAFC, XAFG, XOFC, XOFF, XOFB, XOFT, XOFS, etc.) → always credit `users.balance` (primary wallet, 1:1 parity)
2. **Same currency as `preferredCurrency`** → credit `users.balance`
3. **Different non-CFA currency** → auto-create secondary wallet in payment currency via `upsertWallet`

After any wallet deduction, `cleanupEmptyWallets` removes zero-balance secondary wallets.

Exchange rate conversions use admin-configured rates (`fx_rate_XXX` settings from "Devises & Taux de change" panel) loaded via `loadFxRates()`. Swychr country-specific codes (XOFB, XAFC, etc.) are normalized to standard XAF/XOF via `normalizeCurrency()`.

### Performance Optimizations
- **`GET /api/dashboard`**: Combined endpoint — fetches user, transactions, paymentLinks, wallets, stats, notifications in parallel with `Promise.all`. Returns all data in one round trip (~5ms). Dashboard index uses this instead of 5 separate queries.
- **Cache population**: Dashboard response sets query cache for `/api/user`, `/api/transactions`, `/api/payment-links`, `/api/wallets`, `/api/user/stats` via `useEffect`. Navigating to sub-pages is instant.
- **Prefetch on layout mount**: `DashboardLayout` prefetches `/api/dashboard`, `/api/transactions`, `/api/payment-links` as soon as the user is known.
- **Skeleton loaders**: All key pages (dashboard, transactions, wallets, KYC) show animated skeleton during initial load.

### Design System
- Dark mode default with Binance-inspired color palette
- Primary accent: Golden yellow (#F0B90B)
- Background colors: #0B0E11, #1E2329
- Text: Light gray (#EAECEF)
- CSS variables for theming in `client/src/index.css`

## External Dependencies

### Payment Gateways
The platform actually supports three payment gateways, configured per operator via `operators.paymentProvider` / `operators.depositPaymentProvider` (`shared/schema.ts`): **Swychr** (default/fallback), **AfribaPay**, and **PixPay**. The overview above mentions Swychr as the historical default, but new countries/operators are increasingly routed to AfribaPay or PixPay — check the `operators` table, not just this doc, to see what's live for a given country.

- **Swychr/AccountPE** (default/fallback gateway):
  - Credentials: `SWYCHR_EMAIL`, `SWYCHR_PASSWORD`
  - Payin API URL: `https://app.swychrconnect.com` (deposits)
  - Payout API URL: `https://api.accountpe.com/api/payout` (withdrawals/transfers)
  - Services: `server/swychr.ts` (payin), `server/swychrPayout.ts` (payout)
  - Webhook: `POST /api/swychr/webhook`
  - Manual verify: `GET /api/swychr/verify/:transactionId`
  - Payin flow: Creates hosted payment link → user redirects → Swychr posts webhook callback
  - Payout flow: User submits withdrawal/transfer → API call to AccountPE immediately →
    If success: added to poller for status tracking. If Swychr wallet insufficient: stays pending for admin retry.
    Admin can retry by clicking "Approve" on pending transactions.
  - Payout poller: `server/payoutPoller.ts` — checks status every 30s, auto-marks completed/refunds on failure
  - Currency routing: payout uses the wallet matching the destination country (BJ→XOF, CM→XAF, etc.)
  - No automatic currency conversion — admin handles conversions on Swychr manually if needed

Fee structure per country (db table: fees):
  - `swychrFee`: Swychr base fee (read-only for admin)
  - `ashtechMargin`: Ashtech margin (admin editable, default 2%)
  - `feeValue`: Total = swychrFee + ashtechMargin (auto-calculated)

Countries supported: CM, GA, CG, CD, SN, CI, BF, ML, BJ, TG, TZ, UG, NG, NE, RW, GN, GH, KE + others

- **AfribaPay**:
  - Credentials: `AFRIBAPAY_PUBLIC_KEY`, `AFRIBAPAY_SECRET_KEY` (plus merchant/agent config not yet in the secrets table above — check `server/afribapay.ts` for the full list expected at runtime).
  - Service: `server/afribapay.ts` — token fetch/cache with circuit breaker, `initiateAfribaPayin` (`/v1/pay/payin`), `initiateAfribaPayOtp`/`confirmAfribaPayOtp` (`/v1/pay/otp`), `checkAfribaPayStatus`, `parseAfribaPayWebhook`, fee computation.
  - Operator code resolution: AfribaPay expects specific `operator_code` values (e.g. "orange", "moov", "mtn"). `resolveAfribaPayOperatorCode()` in `server/routes.ts` derives this from `operators.afribapayOperatorCode` if set, else guesses from the operator's display name (strips "Money" suffix, lowercases). **Always use this helper** — never re-derive the operator code ad hoc; a past bug used a raw lowercased name in one code path and it silently broke OTP detection for that path only.
  - **OTP handling (critical, previously buggy)**: Some operator/country pairs (Orange in CI/SN/BF/GN, Moov in CI/BF) require an OTP flow — AfribaPay rejects a direct `/v1/pay/payin` call for them with "This operation requires an OTP code." `getAfribaPayOtpInfo()` in `server/afribapay.ts` decides whether to route through the OTP flow (call `/v1/pay/otp` first, then confirm with the code) instead of `/v1/pay/payin` directly. It unions live `/v1/countries` data with a static fallback table (`AFRIBAPAY_STATIC_OTP_REQUIRED`) — never trust live data alone, since a failed/empty countries fetch or an operator-code mismatch can silently make it think no operator needs OTP. As a last-resort safety net, if AfribaPay's payin call rejects with an OTP-required-style message despite the pre-check saying no, the deposit, payment-link, and public `/v1/collect` flows all reactively switch into the OTP flow instead of failing the transaction (see `isAfribaPayOtpRequiredMessage`).
  - When adding a new OTP-required operator/country pair, add it to `AFRIBAPAY_STATIC_OTP_REQUIRED` in `server/afribapay.ts` rather than relying solely on the live API.

- **PixPay**:
  - Credentials: `PIXPAY_API_KEY_XAF` (per-currency keys — check for others like `PIXPAY_API_KEY_XOF` if PixPay is enabled for XOF countries).
  - Service functions referenced from `server/routes.ts`: `getPixPayServiceId`, `detectPixPayFlowType` — supports USSD, OTP, and Wave-style redirect flows similar to AfribaPay.

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database queries and schema management

### Authentication & Security
- **bcrypt**: Password hashing
- **express-session**: Session management

### Frontend Libraries
- **@tanstack/react-query**: Data fetching and caching
- **@radix-ui/***: Accessible UI primitives
- **react-hook-form**: Form state management
- **zod**: Schema validation (shared client/server)
- **date-fns**: Date formatting with French locale support

### Build & Development
- **Vite**: Frontend build tool and dev server
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development

## Running on Replit

### First-time setup
```bash
npm install          # install all dependencies
npm run db:push      # push Drizzle schema to the local PostgreSQL database
```

### Development
The "Start application" workflow runs `npm run dev`, which starts the Express + Vite dev server on port 5000. The app is served at the Replit preview URL.

### Required environment secrets
Set these in Replit Secrets before connecting to live services:

| Secret | Description |
|--------|-------------|
| `SESSION_SECRET` | Random 64-char string for session signing (already set) |
| `SUPABASE_DATABASE_URL` | Supabase PostgreSQL connection string (Transaction pooler, port 6543) |
| `SUPABASE_URL` | Supabase project URL (for file uploads) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SWYCHR_EMAIL` | Swychr account email (payment gateway) |
| `SWYCHR_PASSWORD` | Swychr account password |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `ADMIN_PIN_CODE` | 6-digit PIN for admin panel access |
| `AFRIBAPAY_PUBLIC_KEY` | AfribaPay public key |
| `AFRIBAPAY_SECRET_KEY` | AfribaPay secret key |
| `PIXPAY_API_KEY_XAF` | PixPay XAF key |
| `IZIPAY_API_KEY` | IziChange Pay API key (crypto checkout) |
| `IZIPAY_WEBHOOK_SECRET` | IziChange Pay webhook signing secret |

Without Supabase secrets, the app falls back to Replit's local PostgreSQL and local file storage — fine for development.

### Production build
```bash
npm run build        # bundles server to dist/index.cjs + client assets
npm run db:push      # ensure schema is up to date
node dist/index.cjs  # run production server
```