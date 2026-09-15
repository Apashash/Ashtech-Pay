# Threat Model

## Project Overview

AshTechPay is a Node.js/Express payment platform with a React SPA, a dual
PostgreSQL/MySQL persistence layer, server-side sessions and Bearer API keys.
Authenticated merchants can create Mobile Money and crypto payments, payment
links, transfers, withdrawals and merchant webhooks. Customers use public
checkout pages. Administrators manage users, payment configuration, KYC and
financial operations. Payment providers, Telegram, geolocation services and
merchant callback endpoints are external dependencies.

The application is deployed behind a reverse proxy and also has a Plesk/Apache
deployment path. Provider callbacks are public server-to-server endpoints;
customer and merchant browser traffic is not trusted.

## Assets

- **Accounts and sessions** — passwords, session cookies, Bearer API keys,
  hosted checkout keys, webhook secrets and device sessions. Compromise enables
  impersonation or unauthorized payment operations.
- **Balances and transaction state** — wallet balances, deposits, withdrawals,
  transfers, fees, provider references and idempotency metadata. Integrity
  failures can cause financial loss or double-crediting.
- **KYC and personal data** — identity documents, names, phone numbers, email
  addresses, locations and review notes. Disclosure creates privacy and fraud
  risk.
- **Payment-provider credentials and application secrets** — database,
  encryption, session, provider and Telegram credentials. Disclosure enables
  data access, payment actions or account takeover.
- **Merchant webhook payloads** — signed event bodies containing transaction and
  customer details. They must be delivered only to an approved merchant
  endpoint and must remain authentic and idempotent.
- **Availability and operational evidence** — upload processing, provider
  callbacks, rate-limit state, audit records and admin alerts. Attackers can
  target these to block payments or hide financial activity.

## Trust Boundaries

- **Browser or mobile/PWA client to Express API** — clients control all input,
  headers and displayed state. Authentication, authorization, CSRF and business
  rules must be enforced server-side.
- **Public checkout to authenticated merchant data** — public payment pages may
  create or observe a narrowly scoped payment session, but must not expose
  merchant accounts, private KYC documents or unrelated transactions.
- **Merchant API key to financial operations** — Bearer keys identify a
  merchant, but cannot be treated as user sessions or as authorization for
  another merchant's records.
- **Provider/Telegram callback to the API** — callbacks are unauthenticated at
  the browser layer and require provider-specific signature, token or
  authenticity checks plus idempotent state transitions.
- **Express API to database and session store** — queries and mutations cross
  into durable financial and personal data. Every query must be parameterized
  and every mutation must preserve transaction and authorization invariants.
- **Express API to external services** — provider APIs, geolocation, Telegram
  and merchant webhooks receive or influence sensitive data. Outbound URLs and
  responses are untrusted.
- **Admin to regular user** — admin routes and financial controls require
  server-side role checks, mandatory TOTP and appropriate audit records.
- **Reverse proxy to Node process** — client IP, host, scheme and forwarded
  headers are security inputs only when the production proxy is the configured
  trusted hop.
- **Production to development/deployment filesystem** — Plesk/Apache static
  fallback and public upload paths can bypass Node middleware if not aligned
  with the application security rules.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`,
  `server/static.ts`, provider modules under `server/`, and the built
  `dist/`/`client/` static assets.
- **Highest-risk areas:** payment initiation and settlement in
  `server/routes.ts`, provider callbacks, `server/merchantWebhook.ts`,
  `server/kycPrivateDocuments.ts`, upload handlers, session/API-key
  middleware, and database storage implementations.
- **Public surfaces:** `/api/ping`, public checkout/payment-link routes,
  `/api/public/*`, provider callback/webhook routes, `/v1/*` API routes with
  merchant keys, and static assets.
- **Authenticated surfaces:** user account, transactions, wallets, transfers,
  withdrawals, KYC uploads and merchant configuration.
- **Admin surfaces:** `/api/admin/*` and the admin SPA; these require a
  database-backed admin role, mandatory TOTP and admin-session controls.
- **Usually dev-only:** Vite development plugins, local test files and
  development-only server fallbacks. Treat them as production-relevant if
  included in the deployment bundle or reachable through static fallback.

## Threat Categories

### Spoofing

An attacker may forge browser headers, steal a session or API key, or submit a
fake provider callback. The system must validate session and Bearer credentials
server-side, separate API-key identity from cookie sessions, enforce admin role
and TOTP checks on every admin action, and verify each provider callback with
the provider's authenticity mechanism. Callback handlers must be idempotent and
must not trust client-supplied payment status.

Forwarded IP and scheme headers must be accepted only from a correctly
configured trusted proxy. A directly reachable Node process must not allow a
client to choose the IP used by rate limits, bans, audit records or geolocation
decisions.

### Tampering

Clients and merchants can alter amounts, currencies, references, operator
names, callback URLs and payment status fields. Amounts, fees, wallet currency,
country/operator compatibility, ownership and settlement transitions MUST be
recomputed and validated on the server. Idempotency keys or merchant
references MUST be scoped to the authenticated merchant and conflicting
replays MUST fail closed. Only verified provider callbacks or authorized admin
actions may finalize financial state.

Merchant webhook events MUST be persisted before delivery, signed over the
exact body and timestamp, delivered idempotently, and retried without creating
duplicate financial effects.

### Repudiation

Payment, payout, transfer, refund, account-role, KYC-review, API-key and
admin-impersonation actions need durable audit evidence with actor, target,
timestamp, result and correlation/reference identifiers. Audit evidence must
avoid storing raw secrets and must not be removable by the same untrusted
actor. Operational logs should use redacted identifiers so forensic value does
not require exposing full phone numbers, emails, IP addresses or payment
details.

### Information Disclosure

API responses and logs must not expose session secrets, API keys, webhook
secrets, database credentials, raw provider responses or private KYC files.
KYC documents MUST remain outside webroot or behind authenticated document
routes; browsers must fetch them with the appropriate authorization rather than
using unauthenticated resource URLs.

Public status, health and error endpoints should return only the minimum
operational detail. `/api/ping` and similar endpoints MUST NOT reveal
environment names, migration/bootstrap internals or failure diagnostics to
unauthenticated callers. Merchant webhook payloads must contain only the
documented fields and must be sent only to a validated merchant destination.

The payment-link HTML shell may be populated with stored merchant metadata, so
all interpolated values MUST be HTML-escaped. A static-analysis warning on
`res.send(html)` is not sufficient evidence of XSS when the shell and all
dynamic fields are controlled and escaped, but this invariant must be covered
by tests.

### Denial of Service

Unauthenticated and authenticated payment, login, OTP, callback and upload
routes require bounded request bodies, rate limits, provider timeouts and
idempotent retries. Multipart limits MUST be enforced by a current, patched
Multer release; image/PDF processing MUST use patched `sharp`/libvips
dependencies and bounded dimensions/work. Malformed ZIP/PDF/image inputs must
not cause unbounded CPU, memory or descriptor use.

Rate limits must account for both merchant identity and client IP where
appropriate. A single failed request or shared mobile-network address must not
cause a whole IP range to be banned or lock out unrelated users.

### Elevation of Privilege

Every user-owned query MUST be scoped by the authenticated user or merchant
identity, and every admin route MUST re-check the role server-side rather than
trusting frontend state or stale session fields. IDs, references and payment
link slugs are not authorization. KYC, transaction, wallet, device-session
and webhook-delivery access must fail closed on missing ownership or database
errors.

User-controlled `notify_url` values cause the server to make outbound HTTP
requests. URL validation MUST require HTTPS, reject encoded/alternate
representations of loopback, link-local, private, CGNAT and IPv6-local
addresses, resolve DNS safely, and re-check resolved addresses to prevent DNS
rebinding. Redirects must be disabled or validated at every hop. Otherwise a
merchant can turn webhook delivery into SSRF against internal services.

All uploads MUST use allowlisted content types and magic-byte validation,
bounded names and sizes, and storage outside the public webroot for sensitive
documents. Static-server and Apache/Plesk fallbacks MUST not serve dotfiles,
probe paths, private uploads or arbitrary user-controlled files.