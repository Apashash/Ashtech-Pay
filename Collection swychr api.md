Voici la vraie documentation 
API for creating and checking statuses of payin payment links. This specification reflects observed production responses and includes:

/admin/auth -> { token, message, email }
/create_payment_links -> { data: { id, payment_link, transaction_id }, message, status }
/payment_link_status -> nested data.data.attributes resource
webhook callback that posts PaymentLinkStatusResponse to merchant callback_url
Auth

Authentication and token management
Obtain a bearer token for admin operations

Exchange admin credentials for a JWT token. Token must be sent in Authorization header.
AuthToken
 HTTP: AuthToken

HTTP Authorization Scheme: bearer
Bearer format: JWT
REQUEST BODY SCHEMA: application/json
required

email
required
string <email>
password
required
string
Responses

200 Logged in, token returned
RESPONSE SCHEMA: application/json

token
required
string
JWT token to use for authenticated calls.
message
required
string
Optional message or token expiry timestamp (production shows "MM-DD-YYYY HH:mm")
email
required
string <email>
Authenticated admin email

400 Input validation failed
RESPONSE SCHEMA: application/json

status
string
message
string
validation
object
401 Authentication failed or missing token.
RESPONSE SCHEMA: application/json

status
string
Value: "error"
errors
Array of objects (ErrorItem)
500 Internal server error
RESPONSE SCHEMA: application/json

status
string
Value: "error"
errors
Array of objects (ErrorItem)
POST
/admin/auth
Production server
https://api.accountpe.com/api/payin/admin/auth

Request samples
Payload
Content type
application/json

Copy
{
"email": "admin@example.com",
"password": "strongPassword123"
}
Response samples 200
application/json

Copy
{
"token": "eyJhbGciOiJIUzI1NiJ9.eyJh...",
"message": "11-28-2025 00:01",
"email": "hk2604@gmail.com"
}
400
application/json

Copy
Expand all Collapse all
{
"status": "string",
"message": "string",
"validation": {
"property1": [],
"property2": []
}
}
401
{
"status": "error",
"errors": [
{
"code": "string",
"message": "string",
"field": "string"
}
]
}
500

Content type
application/json

{
"status": "error",
"errors": [
{
"code": "string",
"message": "string",
"field": "string"
}
]
}
Payment Link

Create and manage payment links
Create a payment link

Create a hosted payment link for collecting payment. Clients should supply an Idempotency-Key header to prevent duplicate link creation on retries.

Redirect behavior after payment completion:

On success:
If callback_url is configured, hosted UI redirects to that callback_url.
Otherwise hosted UI redirects to https://app.swychrconnect.com/payment_success
On failure:
Hosted UI always redirects to https://app.swychrconnect.com/payment_failed
Webhook behavior:

If callback_url is provided, the platform will POST the PaymentLinkStatusResponse payload to that URL whenever the status updates (header X-Swychr-Signature included for verification if configured).
AUTHORIZATIONS:
AuthToken
HEADER PARAMETERS
HTTP: AuthToken

HTTP Authorization Scheme: bearer
Bearer format: JWT
Idempotency-Key
string
Idempotency key to deduplicate requests
REQUEST BODY SCHEMA: application/json
required

country_code
required
string^[A-Za-z]{2,3}$
ISO 3166-1 alpha-2 or alpha-3 code
name
required
string
email
required
string <email>
mobile
string
E.164 recommended (but not enforced)
amount
required
number <double>
currency
string
transaction_id
required
string
description
string
pass_digital_charge
required
boolean
callback_url
string <uri>
Optional merchant callback URL to receive status updates
200 Payment Link Successfully Created
RESPONSE HEADERS
X-Request-Id
any
X-RateLimit-Limit
integer
API limit for the client
X-RateLimit-Remaining
integer
Remaining quota for the current window
RESPONSE SCHEMA: application/json

data
required
object (PaymentLinkData)
message
required
string
status
required
integer
201 Created
RESPONSE SCHEMA: application/json

data
required
object (PaymentLinkData)
message
required
string
status
required
integer
400 Input validation failed
RESPONSE SCHEMA: application/json

status
string
message
string
validation
object
401 Authentication failed or missing token.
RESPONSE SCHEMA: application/json

status
string
Value: "error"
errors
Array of objects (ErrorItem)
404 Country or currency not supported
RESPONSE SCHEMA: application/json

status
string
Value: "error"
errors
Array of objects (ErrorItem)
409 Conflict - duplicate transaction_id or idempotency mismatch
RESPONSE SCHEMA: application/json

status
string
Value: "error"
errors
Array of objects (ErrorItem)
422 Input validation failed
RESPONSE SCHEMA: application/json

status
string
message
string
validation
object
429 Too Many Requests
RESPONSE HEADERS
Retry-After
any
RESPONSE SCHEMA: application/json

status
string
Value: "error"
errors
Array of objects (ErrorItem)
500 Internal server error
RESPONSE SCHEMA: application/json

status
string
Value: "error"
errors
Array of objects (ErrorItem)
POST
/create_payment_links
Production server
https://api.accountpe.com/api/payin/create_payment_links
Payload
Content type
application/json

Copy
{
"country_code": "CM",
"name": "Rahul Sharma",
"email": "rahul@example.com",
"mobile": "919876543210",
"amount": 149.5,
"currency": "XAF",
"transaction_id": "txn_20251126_0001",
"description": "Payment for order #1234",
"pass_digital_charge": true,
"callback_url": "https://merchant.example.com/webhook/payment_status"
}
200
Content type
application/json

Copy
Expand all Collapse all
{
"data": {
"id": 6682,
"payment_link": "https://app.swychrconnect.com/payment/35cfd792-66b4-4db2-940d-a694f15bd11c",
"transaction_id": "txn_20251126_0001"
},
"message": "Payment link created successfully",
"status": 200
}
2001
Content type
application/json

Copy
Expand all Collapse all
{
"data": {
"id": 6682,
"payment_link": "https://app.swychrconnect.com/payment/35cfd792-66b4-4db2-940d-a694f15bd11c",
"transaction_id": "txn_20251126_0001"
},
"message": "Payment link created successfully",
"status": 200
}
400
Content type
application/json

{
"status": "string",
"message": "string",
"validation": {
"property1": [
"string"
],
"property2": [
"string"
]
}
}
4001
Content type
application/json

{
"status": "error",
"errors": [
{
"code": "string",
"message": "string",
"field": "string"
}
]
}

404
Content type
application/json

{
"status": "error",
"errors": [
{
"code": "string",
"message": "string",
"field": "string"
}
]
}
409
Content type
application/json

{
"status": "error",
"errors": [
{
"code": "string",
"message": "string",
"field": "string"
}
]
}
422
Content type
application/json

{
"status": "string",
"message": "string",
"validation": {
"property1": [
"string"
],
"property2": [
"string"
]
}
}
429
Content type
application/json

{
"status": "error",
"errors": [
{
"code": "string",
"message": "string",
"field": "string"
}
]
}
}
500
Content type
application/json

{
"status": "error",
"errors": [
{
"code": "string",
"message": "string",
"field": "string"
}
]
}

Payment Link Status

Retrieve or poll the status of a payment link
Get status of a payment link by transaction id

Returns the current status of the payment link and payment details if completed. This endpoint accepts transaction_id created by the client when creating the link.

Redirect behavior (hosted UI):

On success (e.g. status = 1):
If callback_url set, hosted UI redirects to that URL.
If not set, hosted UI redirects to https://app.swychrconnect.com/payment_success
On failure:
Hosted UI redirects to https://app.swychrconnect.com/payment_failed
Webhook behavior:

If callback_url is configured, platform POSTs PaymentLinkStatusResponse to the callback_url on status updates.

AuthToken
 HTTP: AuthToken

HTTP Authorization Scheme: bearer
Bearer format: JWT
HEADER PARAMETERS

X-Request-Id
string <uuid>
Client trace id
REQUEST BODY SCHEMA: application/json
required

transaction_id
required
string
Responses

200 Payment link status retrieved successfully
RESPONSE SCHEMA: application/json

data
required
object (PaymentLinkStatusData)
message
required
string
status
required
integer
400 Input validation failed
RESPONSE SCHEMA: application/json

status
string
message
string
validation
object
401 Authentication failed or missing token.
RESPONSE SCHEMA: application/json

status
string
Value: "error"
errors
Array of objects (ErrorItem)
404 Resource not found
RESPONSE SCHEMA: application/json

status
string
Value: "error"
errors
Array of objects (ErrorItem)
500 Internal server error
RESPONSE SCHEMA: application/json

status
string
Value: "error"
errors
Array of objects (ErrorItem)
POSTWebhook POST to merchant callback_url when payment status updates
Platform POSTs the same payload as the PaymentLinkStatusResponse to the merchant's configured callback_url whenever the payment status updates. Merchants should verify X-Swychr-Signature header if configured.
post
{$request.body#/data/data/attributes/callback_url}
data
required
object (PaymentLinkStatusData)
message
required
string
status
required
integer
Callback responses

200 Merchant acknowledged webhook successfully
post Production server
https://api.accountpe.com/api/payin/payment_link_status
Content type
application/json

Copy
{
"transaction_id": "txn_20251126_0001"
}
200

Content type
application/json

{
"status": "string",
"message": "string",
"validation": {
"property1": [
"string"
],
"property2": [
"string"
]
}
}
Callback payload samples
Callback
POST: Webhook POST to merchant callback_url when payment status updates
Content type
application/json

Copy
Expand all Collapse all
{
"data": {
"data": {
"type": "payment-links",
"id": "6682",
"attributes": {
"id": 6682,
"name": "Rahul Sharma",
"email": "rahul@example.com",
"mobile": "919876543210",
"amount": 149.5,
"currency_code": "XAF",
"country": "Cameroon",
"country_code": "CM",
"status": 0,
"created_at": "2025-11-27T00:04:05.835+05:30",
"description": "Payment for order",
"expired_at": "2025-11-27T01:04:05.833+05:30",
"payment_uuid": "https://app.swychrconnect.com/payment/35cfd792-66b4-4db2-940d-a694f15bd11c",
"transaction_id": "txn_20251126_0001",
"pass_digital_charge": true,
"net_payable": 153.2375,
"admin_name": "harshit",
"admin_email": "hk2604@gmail.com",
"callback_url": "https://merchant.example.com/webhook/payment_status",
"redirect_behavior": {
"success": {
"when_callback_set": "Redirects to the callback_url if set.",
"when_callback_not_set": "Redirects to https://app.swychrconnect.com/payment_success when callback_url not set."
},
"failure": {
"default_failure_url": "https://app.swychrconnect.com/payment_failed"
}
}
},
"links": {
"self": "/payment-links/6682"
}
}
},
"message": "Payment link details retrieved successfully",
"status": 200
}
400
Content type
application/json

{
"status": "string",
"message": "string",
"validation": {
"property1": [
"string"
],
"property2": [
"string"
]
}
}
Callback payload samples
Callback
POST: Webhook POST to merchant callback_url when payment status updates
Content type
application/json

Copy
Expand all Collapse all
{
"data": {
"data": {
"type": "payment-links",
"id": "6682",
"attributes": {
"id": 6682,
"name": "Rahul Sharma",
"email": "rahul@example.com",
"mobile": "919876543210",
"amount": 149.5,
"currency_code": "XAF",
"country": "Cameroon",
"country_code": "CM",
"status": 0,
"created_at": "2025-11-27T00:04:05.835+05:30",
"description": "Payment for order",
"expired_at": "2025-11-27T01:04:05.833+05:30",
"payment_uuid": "https://app.swychrconnect.com/payment/35cfd792-66b4-4db2-940d-a694f15bd11c",
"transaction_id": "txn_20251126_0001",
"pass_digital_charge": true,
"net_payable": 153.2375,
"admin_name": "harshit",
"admin_email": "hk2604@gmail.com",
"callback_url": "https://merchant.example.com/webhook/payment_status",
"redirect_behavior": {
"success": {
"when_callback_set": "Redirects to the callback_url if set.",
"when_callback_not_set": "Redirects to https://app.swychrconnect.com/payment_success when callback_url not set."
},
"failure": {
"default_failure_url": "https://app.swychrconnect.com/payment_failed"
}
}
},
"links": {
"self": "/payment-links/6682"
}
}
},
"message": "Payment link details retrieved successfully",
"status": 200
}
401
Content type
application/json

{
"status": "error",
"errors": [
{
"code": "string",
"message": "string",
"field": "string"
}
]
}
Callback payload samples
Callback
POST: Webhook POST to merchant callback_url when payment status updates
Content type
application/json

Copy
Expand all Collapse all
{
"data": {
"data": {
"type": "payment-links",
"id": "6682",
"attributes": {
"id": 6682,
"name": "Rahul Sharma",
"email": "rahul@example.com",
"mobile": "919876543210",
"amount": 149.5,
"currency_code": "XAF",
"country": "Cameroon",
"country_code": "CM",
"status": 0,
"created_at": "2025-11-27T00:04:05.835+05:30",
"description": "Payment for order",
"expired_at": "2025-11-27T01:04:05.833+05:30",
"payment_uuid": "https://app.swychrconnect.com/payment/35cfd792-66b4-4db2-940d-a694f15bd11c",
"transaction_id": "txn_20251126_0001",
"pass_digital_charge": true,
"net_payable": 153.2375,
"admin_name": "harshit",
"admin_email": "hk2604@gmail.com",
"callback_url": "https://merchant.example.com/webhook/payment_status",
"redirect_behavior": {
"success": {
"when_callback_set": "Redirects to the callback_url if set.",
"when_callback_not_set": "Redirects to https://app.swychrconnect.com/payment_success when callback_url not set."
},
"failure": {
"default_failure_url": "https://app.swychrconnect.com/payment_failed"
}
}
},
"links": {
"self": "/payment-links/6682"
}
}
},
"message": "Payment link details retrieved successfully",
"status": 200
}
404
Content type
application/json

Copy
Expand all Collapse all
{
"status": "error",
"errors": [
{}
]
}
Callback payload samples
Callback
POST: Webhook POST to merchant callback_url when payment status updates
Content type
application/json

Copy
Expand all Collapse all
{
"data": {
"data": {}
},
"message": "Payment link details retrieved successfully",
"status": 200
}
500
Content type
application/json

Copy
Expand all Collapse all
{
"status": "error",
"errors": [
{}
]
}
Callback payload samples
Callback
POST: Webhook POST to merchant callback_url when payment status updates
Content type
application/json

Copy
Expand all Collapse all
{
"data": {
"data": {}
},
"message": "Payment link details retrieved successfully",
"status": 200
}
Webhook

Merchant webhook receiver (example)
Example merchant webhook receiver (documentation)

Example endpoint showing what merchants should implement to receive webhook events. The POST body is identical to PaymentLinkStatusResponse.
AuthToken
 HTTP: AuthToken

HTTP Authorization Scheme: bearer
Bearer format: JWT
REQUEST BODY SCHEMA: application/json
required

data
required
object (PaymentLinkStatusData)
message
required
string
status
required
integer
Responses

200 Merchant must respond 200 to acknowledge receipt
400 Invalid payload
post Production server
https://api.accountpe.com/api/payin/merchant/webhook/payment_status
Request samples
Payload
Content type
application/json

{
"data": {
"data": {
"type": "payment-links",
"id": "6682",
"attributes": {
"id": 6682,
"name": "Rahul Sharma",
"email": "rahul@example.com",
"mobile": "919876543210",
"amount": 149.5,
"currency_code": "XAF",
"country": "Cameroon",
"country_code": "CM",
"status": 0,
"created_at": "2025-11-27T00:04:05.835+05:30",
"description": "Payment for order",
"expired_at": "2025-11-27T01:04:05.833+05:30",
"payment_uuid": "https://app.swychrconnect.com/payment/35cfd792-66b4-4db2-940d-a694f15bd11c",
"transaction_id": "txn_20251126_0001",
"pass_digital_charge": true,
"net_payable": 153.2375,
"admin_name": "harshit",
"admin_email": "hk2604@gmail.com",
"callback_url": "https://merchant.example.com/webhook/payment_status",
"redirect_behavior": {
"success": {
"when_callback_set": "Redirects to the callback_url if set.",
"when_callback_not_set": "Redirects to https://app.swychrconnect.com/payment_success when callback_url not set."
},
"failure": {
"default_failure_url": "https://app.swychrconnect.com/payment_failed"
}
}
},
"links": {
"self": "/payment-links/6682"
}
}
},
"message": "Payment link details retrieved successfully",
"status": 200
}