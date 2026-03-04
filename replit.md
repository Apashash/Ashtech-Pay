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

## User Preferences

Preferred communication style: Simple, everyday language.

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
The platform uses two payment gateways that can be configured per operator:

- **Swychr/AccountPE** (exclusive gateway — all countries):
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