---
name: ashtech
description: Use when integrating AshTech Pay Mobile Money or cryptocurrency payments, hosted checkout, payment webhooks, transaction verification, or payment troubleshooting.
metadata:
  version: "1.0"
  homepage: https://doc.ashtechpay.com
---

# AshTech Pay Integration Skill

You are an AI coding agent integrating AshTech Pay into an existing merchant
website or application.

## How to use this Skill

When a developer asks for an AshTech Pay integration:

1. Inspect the project before editing it. Identify the framework, language,
   server, database, authentication, order model, and environment-variable
   convention.
2. Ask only the questions needed to choose the integration. Use Hosted Checkout
   for a hosted payment page, Direct API for a custom payment form, and the
   Mobile Money, crypto, or webhooks instructions for those specific flows.
3. Read the relevant pages on `https://doc.ashtechpay.com` before writing
   requests. The documentation is the authority for endpoint names, fields,
   response shapes, statuses, and provider catalogues.
4. Keep all credentials on the server. Never put an API key or webhook secret
   in browser code, a mobile bundle, logs, or a Git commit.
5. Implement the complete server-side payment lifecycle, not only the initial
   request: create, pending, status verification, webhook processing,
   confirmation, failure, expiry, and idempotent order fulfillment.
6. Explain what was integrated, which environment variables are required, how
   the merchant must configure the account, and how to test the result.

If the merchant receives `api_not_enabled`, explain that the API key may be
valid but Direct API access is not activated on the merchant account. Do not
try to bypass this status or replace the key without a reason.

Do not claim that installation of this Skill activates an API account, creates
credentials, or enables a payment provider. Those actions require the merchant
dashboard or AshTech Pay support.

## Source of truth

Always consult the current official documentation:

https://doc.ashtechpay.com

Do not invent AshTech Pay endpoints, parameters, authentication methods,
webhook payloads, SDK methods, currencies, crypto networks, or response fields.
If the documentation does not provide the required information, say so instead
of guessing.

The API base URL is:

https://www.ashtechpay.com

## When to use

Use this Skill when:

- adding Hosted Checkout to a website;
- integrating Direct API payments;
- accepting Mobile Money payments;
- handling the documented Mobile Money flows: USSD Push, Wave, OTP SMS, and
  OTP USSD;
- accepting cryptocurrency payments;
- implementing payment webhooks;
- verifying transaction status;
- handling OTP, pending, failed, expired, or duplicate payment states;
- troubleshooting AshTech Pay API errors.

## Integration workflow

1. Inspect the existing project before changing it:
   - language and framework;
   - frontend and backend;
   - package manager;
   - existing payment system;
   - database and authentication;
   - environment-variable convention;
   - existing API and order structure.
2. Read the relevant pages on `https://doc.ashtechpay.com`.
3. Choose the documented method that fits the project:
   - Hosted Checkout;
   - Direct API;
   - Mobile Money;
   - crypto;
   - webhooks.
4. Follow the existing project architecture, naming, error handling, and UI
   conventions.
5. Keep secret keys and webhook secrets on the server.
6. Implement the complete flow:

   Merchant website → AshTech Pay → payment → webhook or server verification
   → update the order status.
7. Explain the integration method, files changed, environment variables,
   endpoints, webhook route, tests, and remaining merchant configuration.

## Authentication and credentials

- Keep Direct API keys in a server environment variable.
- Keep Hosted Checkout keys on the server.
- Keep `whsec_...` webhook secrets on the server.
- Never expose credentials in browser JavaScript, mobile apps, logs, or Git.
- Never commit real production credentials.
- Use only the key type documented for the selected integration.

## Payment and order rules

- Generate a unique merchant reference for each order.
- Do not consider a browser redirect or initial API response proof of payment.
- A `202` or pending response means AshTech Pay accepted the request, not that
  the customer has paid.
- Wait for the documented completed webhook or verify the transaction server
  side before crediting an account or delivering an order.
- Do not blindly retry an initiation after a timeout; check the transaction
  status first.
- Make order fulfillment idempotent.

## Documented endpoint selection

Use the live documentation and current catalogues rather than hardcoding
provider or network assumptions. The currently documented Direct API includes:

- `GET /v1/countries` — active countries and operators;
- `GET /v1/fees` — applicable fees;
- `POST /v1/collect` — Mobile Money collection;
- `GET /v1/transaction/:id` — transaction status;
- `GET /v1/crypto/assets` — active crypto assets and networks;
- `POST /v1/crypto/collect` — crypto payment creation.

Hosted Checkout endpoints and fields must be taken from the current Hosted
Checkout documentation.

## Mobile Money

Before creating a Mobile Money collection:

1. Load the active country and operator catalogue.
2. Validate the amount, currency, country, operator, phone, and reference on
   the server.
3. Use the exact operator and currency values returned by AshTech Pay.
4. Configure the documented HTTPS `notify_url` when webhooks are required.
5. Handle pending, completed, failed, cancelled, OTP-required, and timeout
   states only as documented.

Consult the payment-flow documentation for the exact USSD Push, Wave, OTP SMS,
and OTP USSD request and retry rules. Do not reuse an OTP reference or retry
an expired payment unless the current documentation explicitly allows it.

Never hardcode a provider code when the live catalogue provides it.

## Cryptocurrency payments

When crypto is requested or is the appropriate method:

1. Load the active catalogue with `GET /v1/crypto/assets`.
2. Select only an `asset_code` returned by AshTech Pay. Never invent a coin or
   network.
3. Create the payment server side with `POST /v1/crypto/collect`.
4. Require the current documented customer fields:
   - `customer.email`;
   - `customer.firstName`;
   - `customer.lastName`.
5. Preserve the exact asset, network, address, memo/tag, expiry, and status
   returned by AshTech Pay.
6. Display the returned payment address and use only a network-compatible QR
   format.
7. Keep address and memo/tag as separate values.
8. Treat the server status and webhook as the source of truth.
9. Do not credit or deliver an order until the transaction is confirmed.
10. Enforce the documented crypto pending-expiry rule. The current
    documentation uses a 15-minute server timeout for crypto pending payments;
    do not apply that rule to Mobile Money.
11. Test pending, completed, failed, expired, invalid-input, and duplicate
    webhook paths when supported by the current documentation.

Never invent crypto wallet parameters, exchange-rate logic, confirmation
counts, expiry rules, memo/tag formats, addresses, or webhook payloads.

## Webhooks

If the selected integration uses webhooks:

- create the documented HTTPS endpoint;
- read the raw request body before JSON parsing when signature verification
  requires it;
- verify `X-Ashtech-Timestamp`, `X-Ashtech-Signature`, and the webhook secret
  exactly as documented;
- reject stale or invalid signatures;
- acknowledge quickly with HTTP 2xx;
- deduplicate by the documented event ID, transaction ID, and merchant
  reference;
- reload the transaction status server side before fulfillment;
- make duplicate delivery safe.

Never fulfill an order from an unverified browser status.

## Security rules

Never:

- hardcode or expose secret keys;
- trust client-side payment status;
- mark an order paid without server verification;
- log API keys, webhook secrets, OTPs, private keys, full phone numbers, or
  unnecessary payment/customer data;
- invent undocumented APIs or parameters;
- send merchant credentials to a customer device.

## Testing checklist

After implementation:

- run the existing tests;
- run the build and type checks;
- verify the selected API requests and error paths;
- verify transaction status handling;
- verify webhook signature and idempotency behavior;
- verify timeout behavior without blind retries;
- verify crypto asset/network validation when crypto is selected;
- verify customer fields required by the crypto API;
- verify that existing payment functionality still works.

Use the current official documentation for every exact request and response:

https://doc.ashtechpay.com