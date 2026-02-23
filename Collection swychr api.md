API for creating and checking statuses of payin payment links. This specification reflects observed production responses and includes:

/admin/auth -> { token, message, email }
/create_payment_links -> { data: { id, payment_link, transaction_id }, message, status }
/payment_link_status -> nested data.data.attributes resource
webhook callback that posts PaymentLinkStatusResponse to merchant callback_url
Auth

Authentication and token management
Obtain a bearer token for admin operations

Exchange admin credentials for a JWT token. Token must be sent in Authorization header.
AUTHORIZATIONS:
AuthToken
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
400 Input validation failed
401 Authentication failed or missing token.
500 Internal server error

POST
/admin/auth
Request samples
Payload
Content type
application/json

Copy
{
"email": "admin@example.com",
"password": "strongPassword123"
}
Response samples
200400401500
Content type
application/json

Copy
{
"token": "eyJhbGciOiJIUzI1NiJ9.eyJh...",
"message": "11-28-2025 00:01",
"email": "hk2604@gmail.com"
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
Responses

200 Payment Link Successfully Created
201 Created
400 Input validation failed
401 Authentication failed or missing token.
404 Country or currency not supported
409 Conflict - duplicate transaction_id or idempotency mismatch
422 Input validation failed
429 Too Many Requests
500 Internal server error

POST
/create_payment_links
Request samples
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
Response samples
200201400401404409422429500
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
AUTHORIZATIONS:
AuthToken
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
400 Input validation failed
401 Authentication failed or missing token.
404 Resource not found
500 Internal server error
Callbacks

POSTWebhook POST to merchant callback_url when payment status updates

POST
/payment_link_status
Request samples
Payload
Content type
application/json

Copy
{
"transaction_id": "txn_20251126_0001"
}
Response samples
200400401404500
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
AUTHORIZATIONS:
AuthToken
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

POST
/merchant/webhook/payment_status
Request samples
Payload
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



TARIFS ASHTECH PAY – PAYMENT COLLECTION

Cameroun
Frais Swychr : 2.50%
Marge Ashtech Pay : 2.00%
Total facturé client : 4.50%

Kenya
Frais Swychr : 1.50%
Marge Ashtech Pay : 2.00%
Total facturé client : 3.50%

Gabon
Frais Swychr : 3.00%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.00%

Congo DRC
Frais Swychr : 3.50%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.50%

Sénégal
Frais Swychr : 2.50%
Marge Ashtech Pay : 2.00%
Total facturé client : 4.50%

Côte d’Ivoire
Frais Swychr : 3.00%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.00%

Burkina Faso
Frais Swychr : 3.00%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.00%

Mali
Frais Swychr : 3.00%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.00%

Bénin
Frais Swychr : 3.00%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.00%

Togo
Frais Swychr : 3.00%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.00%

Tanzanie
Frais Swychr : 3.00%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.00%

Ouganda
Frais Swychr : 3.00%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.00%

Nigéria
Frais Swychr : 2.00%
Marge Ashtech Pay : 2.00%
Total facturé client : 4.00%

Niger
Frais Swychr : 3.50%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.50%

Rwanda
Frais Swychr : 3.75%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.75%

Congo Brazzaville
Frais Swychr : 4.50%
Marge Ashtech Pay : 2.00%
Total facturé client : 6.50%

Guinée Conakry
Frais Swychr : 3.75%
Marge Ashtech Pay : 2.00%
Total facturé client : 5.75%

Ghana
Frais Swychr : 2.50%
Marge Ashtech Pay : 2.00%
Total facturé client : 4.50%



Cameroun – XAF
Burkina Faso – XOF
Bénin – (pas indiqué)
Congo Brazzaville – XAF
Congo DRC – (pas indiqué)
Côte d’Ivoire – XOF
Gabon – XAF
Ghana – GHS
Guinée Conakry – GNF
India – INR
Kenya – KES
Mali – XOF
Niger – XOF
Nigeria – NGN
Rwanda – RWF
Senegal – XOF
Togo – (pas indiqué)
Tanzania – (pas indiqué)
Uganda – (pas indiqué)
United States of America – USD