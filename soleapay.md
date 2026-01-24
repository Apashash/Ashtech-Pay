# soleaspay
my api key:  4O6UHCMtqewMkld4MSaZUWYr_M9-JWrlYT0oB3AZ9To-APP 
les pays et operateur solease pay prend en charge
 🇧🇯 Bénin : MTN Money, moov
 • 🇧🇫 Burkina Faso : Moov Money, Orange Money
 • 🇨🇲 Cameroun : MTN Mobile Money, Orange Money
 • 🇨🇬 Congo-Brazzaville : MTN Money, Airtel Money
 • 🇨🇩 RDC (Congo Kinshasa) : Orange Money, Vodacom, Airtel Money
 • 🇨🇮 Côte d’Ivoire : MTN Money, Wave, Moov Money, Orange Money
 mali: orange money, moov
 • 🇬🇦 Gabon : Airtel Money,
 • 🇹🇬 Togo : Moov Money, T-Money
 • 🇰🇪 Kenya : M-Pesa
 • 🇷🇼 Rwanda : MTN Mobile Money
 • 🇸🇳 Sénégal : Free Money, Wave, expresso, wizall, orange money
uganga: mobile money, airtel

la documantation

SoleasPay is a payment gateway allowing to collect and emit payments on web and mobile applications of their customers through their mobile money wallet, bank and even crypto accounts.
SoleasPay Endpoints support GET, POST, PUT or DELETE Requests.
https://soleaspay.com

Authentication
SoleasPay API require authenticated token in all header's request.
Depending on the endpoint prefixe, they accept :
Bearer Token : For all endpoints started by /api/action
x-api-key : For all endpoints started by /api/agent
Rate Limits
The number of request is limited to 500 requests per hour, per IP address. If you need a higher limit, please contact us. All IPs sending excessive requests will be down.
Callback
In asynchronous system, all requests will be processed and final state will be share to your application through your callback endpoint.

For security reason, all our request must contain a x-private-key header. its value is the hash 512 of your secret hash received after configuring your callback endpoint

calback request sample

curl --location 'https://your-callback-endpoint.com' \
--header 'x-private-key: bc0d4ddd93081cecc2770b82f37158a26083ccd07efe46a4c90d698ac481325543d46610a0bac7ea9b6a00013d800b82d0369f1ba296e16beab79e16ebdc0b9b' \
--header 'Content-Type: application/json' \
--data '{
    "success" : true || false,
    "status" : "SUCCESS" || "RECEIVED" || "REFUND",
    "created_at" : "date",
    "data" : {
        "operation" : "operation name",
        "reference" : "internal reference",
        "external_reference" : "order id",
        "transaction_reference" : "transaction Reference",
        "amount" : "transaction amount",
        "currency" : "transaction currency"
    }
}'
Get Bearer Token
The life cycle of the generate token is 60 minutes
Parameters (JSON) :
* public_apikey(string) : Your x-api-key available on your SoleasPay dashboard.
* private_secretkey(string) : Your private secret key available on your SoleasPay dashboard
post /api/action/auth

Example post
//Javascript
var myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json");

var raw = JSON.stringify({"public_apikey":"your Api key","private_secretkey":"Your private secret key"});

var requestOptions = {
  method: 'POST',
  headers: myHeaders,
  body: raw,
  redirect: 'follow'
};

fetch("https://soleaspay.com/api/action/auth", requestOptions)
  .then(response => response.text())
  .then(result => console.log(result))
  .catch(error => console.log('error', error));

Response json
// Get Bearer Token
{
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE2MzcyMjkyMjAsImV4cCI6MTYzNzIzMjgyMCwicm9sZXMiOlsiUk9MRV9BR0VOVCIsIlJPTEVfQVBJIl0sImVtYWlsIjoibXlzb2xlYXNAZ21haWwuY29tIn0.aQBVdzQ-hQbrMh2EP_s3iGjjREF7GiOTt6WMu6yKEUgZe3kQUSnNhvVeUu37SKE3zJNPevV-2ADdqpppfCnSx49_JD574PYqccVjxcV9KiCyngLH9QlpZcPSSZneq5uKFOaFGSDnbRhrAGjN6F8bmllFDKN78bqwUDwqhcJWZCmpFj10IG23k8gNIZ1lXE318i5NoVIiPLJul4vEFsFUqe4Y8QQ0hMyLuhQ-r8n7tyUNht92RgtJDoWPGydgjauAvlgcO2rXXKhVomJwTurRhp1klOYp4FUXwljUSqpUayywU8nsBMfKj0BZME7k2hMGvSEZHZzR1hjxOQCZHvXTWFwawbadd0PpAdccjkl_fwAZteL2bJL_MS2XY5outZ8cJbHeS1yJnDTPEU4bm7DGAOEIRVm1rralmIWg1AnCkksGrt4dMNFUY4VHNDbICl0wg0ZQbtszPM3LwYLXy1F0Qh6xsuy-cBAE6VrRefIv6_qsFLQv3cfOFrDXbKnDdk3XAYyDbqpcfLkF9yieHtVEChOQZXpypqmxAb0_cinLoqoci6H2Ii598QcpIrlYYbx6Vj72tiKWh_ToDSTmCaAhitDt9S5559PSBjK7cqcLQXP8jPgC02EEBUnC2nodo-Xi0F-_s0iMJ2KT3Au4EZ847uJWAdcHg3_KuNRDALYP7m0",
    "data": {
        "expireAt": "2021-11-18 10:08"
    }
}

Collect payment (Pay-In)


To collect payment by api call.
Parameters (in Headers) :
* x-api-key : your apikey
* operation(integer) : 2
* service(integer) : The service which one your customer will pay
*otp(integer) : For orange money service, you should provide otp code in hearders or not depending of your logic.
Parameters (in JSON body) :
* wallet(string) : the wallet where we proceed the payment
* amount(float) : amount of current payment
* currency(string) : it is the currency in which you proceed the current payment
* orderId(string) : The unique order id on your apps for current payment
* description(string) : A short description of current payment
* payer(string) : The name of your cystomer
* payerEmail(string) : Customer email to receive payment receipt after confirmation
* successUrl(string) : the url to notice when payment success.
* failureUrl(string) : The failure url
post /api/agent/bills/v3

Example post
//Javascript
var myHeaders = new Headers();
myHeaders.append("x-api-key", "J-Wyr6-69ATKTWGSxk8st1BaZOo7qp_wc2w-AJAFU6P");
myHeaders.append("operation", "2");
myHeaders.append("service", "2");
myHeaders.append("Content-Type", "application/json");

var raw = JSON.stringify({"wallet":690000001,
                          "amount":1000, 
                          "currency":"XAF", 
                          "order_id":"abc1234",
                          "description" : "pay for rent,
                          "payer" : "John",
                          "payerEmail": "john@mail.com",
                          "successUrl": "https://successurl.com/receive-payment",
                          "failureUrl": "https://failureurl.com/payment-fail
                          });

var requestOptions = {
  method: 'POST',
  headers: myHeaders,
  body: raw,
  redirect: 'follow'
};

fetch("https://soleaspay.com/api/agent/bills/V3", requestOptions)
  .then(response => response.text())
  .then(result => console.log(result))
  .catch(error => console.log('error', error));

Response json
// Success request
{
    'success' : true, 
    'code' : 200,  
    'status' : "PROCESSING", 
    'created_at' : "2024-12-16 10:05:01", 
    'data' : {
        'operation' : "PURCHASE",
        'reference' : "MLS2021B", 
        'external_reference' : "abc1234", 
        'transaction_reference' : null,
        'transaction_category' : "direct",
        'transaction_channel' : "MSISDN",
        'amount' : "1000",
        'currency' : "XAF",
    }, 
    'message' : "transaction processing"
}

// Invalid request
{
    "success": false,
    "message": "Invalid operation provide"
}

// Failure request 
{
    'success' : false, 
    'code' : 400,  
    'status' : "FAILURE", 
    'created_at' : "2024-12-16 10:05:01", 
    'data' : {
        'operation' : "PURCHASE",
        'reference' : "MLS2021B", 
        'external_reference' : "abc1234", 
        'transaction_reference' : null,
        'transaction_category' : "direct",
        'transaction_channel' : "MSISDN",
        'amount' : "1000",
        'currency' : "XAF",
    }, 
    'message' : "transaction processing"
}


Verify Transaction

Check if payment is validate by customer.
Parameters (in Headers) :
* x-api-key : your apikey
Parameters (in URL) :
* orderId(string) : your unique order id for checking Payment,
* payId(string) :the SoleasPay Payment reference. You receive it in the response of Pay-In API Call
get /api/agent/verif-pay

Example get
//Javascript
var myHeaders = new Headers();
myHeaders.append("x-api-key", "g-fFowNzY7t2Yk-osvI8qmZ18BNL5TF-OwQNfANd6_ss");
myHeaders.append("operation", "2");
myHeaders.append("service", "1");
myHeaders.append("Content-Type", "application/json");

var requestOptions = {
  method: 'GET',
  headers: myHeaders,
  body: raw,
  redirect: 'follow'
};

fetch("https://soleaspay.com/api/agent/verif-pay?orderId=3234173428&payId=MLS383B", requestOptions)
  .then(response => response.text())
  .then(result => console.log(result))
  .catch(error => console.log('error', error));

Response json
// payment approve by customer
{
    'success' : true, 
    'code' : 200,  
    'status' : "STATUS", 
    'created_at' : "2024-12-16 10:05:01", 
    'data' : {
        'operation' : "OPERATION NAME",
        'reference' : "MLS2021B", 
        'external_reference' : "abc1234", 
        'transaction_reference' : "transaction partner reference",
        'amount' : 1000,
        'currency' : "XAF",
    }, 
    'message' => "Transaction is completed successfully"
    
}
// Bad informationns provide
{
    "success": false,
    "message": "Invalid Transaction informations"
}
Get transaction details
To get detail of one specific payment.
Parameters (Headers) :
* Authorization : Bearer Token.
Parameters (URL) :
* document : the internal transaction reference.
get /api/user/history/{document}

Example get
//Javascript
var myHeaders = new Headers();
myHeaders.append("Authorization", "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE2MzczMzU3ODYsImV4cCI6MTYzNzMzOTM4Niwicm9sZXMiOlsiUk9MRV9BR0VOVCIsIlJPTEVfQVBJIl0sImVtYWlsIjoibXlzb2xlYXNAZ21haWwuY29tIn0.Y5Ww34LT3eBbOtd7K2leYzdl_ImXrxOK5cnaeKo2EKRMKjRUqLeFROwdobxBuhHwKl-rmAZRMGXxlID26rrkJKW5xVO_AzYzEeonfkeCtH0UpyZrVQtd3qJP1paFkT6xoWk9HFDBpkLCzZWeJUyExr_L1AWvbCiDtjGMJkT1KkxJoa87Tw1puWw0_6LZ0-pl2kEiv_f9sxHmlrpEGJnA_KaHpbz5G6f8PsqLfJo5r0t4fCe238X63qj00KdP-N6zCQqFqEK7EvNSIE1ohkY0m6-IBVBZpIoDc6v_2Jhhy38xxvqc1yT7UDyEt-BMKU4IhKDqPTFjlLZpk3xriHqEOJGvDHYZEBREwnXZIXlYqsaH97MAntnwq_XzyvYPe9GlLSG4Fi9D9d_LOhjvGRsVKoXPe134F0TGZ5Q5Vdv2qU-xs3-3SgKbSfrjXWdUp3-l2OAdvfbH0_ouXdFQFLxm-6MKKLW2Zhl6kTtojH2azWaK3SrWBTtMGnoYPaTRS3mR8xUPOlg-MVdpMOv7uVLQb7S_jYYeI5bY5TCy0m13NymChpiOaX9HLwmLs_MaSr6wcbaU7f3mXHnkgmwQbtQ9hhS90ZeUb7y5swDtY3SgXfW8sg24Cp_e19Rc_YaxaicePZkWBcEmJtoXkz8sywp3KR0IyGcstVjS50NAEtPEa90");

var requestOptions = {
  method: 'GET',
  headers: myHeaders,
  redirect: 'follow'
};

fetch("https://soleaspay.com/api/user/history/MLS109P", requestOptions)
  .then(response => response.text())
  .then(result => console.log(result))
  .catch(error => console.log('error', error));

Response json
// about transaction no MLS109P
{
    "ext_id": "MLS109P",
    "amount": 250.0,
    "wallet": "677347922",
    "currency": "XAF",
    "operation": {
        "id": 4,
        "name": "WITHDRAW",
        "description": "WITHDRAW FUND TO PERSONAL ACCOUNT"
    },
    "service": {
        "id": 1,
        "name": "MOMO",
        "type": "TRUSTEECURRENCY",
        "is_active": true
    },
    "status": "SUCCESS",
    "short_description": null,
    "proceed_at": "2021-11-19T14:32:45+00:00",
    "is_verif": true,
    "other": "bfb168dd-2f1c-409b-a156-ad3aaee6d8e7"
}
others mapping ,  {
    "success": true,
    "data": [
        {
            "id": 1,
            "name": "MOMO CM",
            "description": "MTN MOBILE MONEY CM",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 1,
                "code": "CM",
                "name": "CAMEROON"
            }
        },
        {
            "id": 2,
            "name": "OM CM",
            "description": "ORANGE MONEY CM",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 1,
                "code": "CM",
                "name": "CAMEROON"
            }
        },
        {
            "id": 5,
            "name": "EUM CM",
            "description": "EXPRESS UNION MOBILE MONEY CM",
            "is_active": false,
            "withdrawable": false,
            "country": {
                "id": 1,
                "code": "CM",
                "name": "CAMEROON"
            }
        },
        {
            "id": 6,
            "name": "SPC",
            "description": "SoPay Payment",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 2,
                "code": "INT",
                "name": "INTERNATIONAL"
            }
        },
        {
            "id": 13,
            "name": "EU CASH",
            "description": "WITHDRAW CASH BY EXPRESS UNION",
            "is_active": false,
            "withdrawable": false,
            "country": {
                "id": 1,
                "code": "CM",
                "name": "CAMEROON"
            }
        },
        {
            "id": 14,
            "name": "BANK OPERATION",
            "description": "DEPOSIT/WITHDRAW CASH BY BANK TRANSFERT",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 2,
                "code": "INT",
                "name": "INTERNATIONAL"
            }
        },
        {
            "id": 15,
            "name": "XAF",
            "description": "XAF TRADE SERVICE",
            "is_active": true,
            "withdrawable": true,
            "country": null
        },
        {
            "id": 16,
            "name": "USD",
            "description": "US DOLLARS TRADE SERVICE",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 2,
                "code": "INT",
                "name": "INTERNATIONAL"
            }
        },
        {
            "id": 17,
            "name": "EUR",
            "description": "EURO TRADE SERVICE",
            "is_active": true,
            "withdrawable": true,
            "country": null
        },
        {
            "id": 18,
            "name": "SPC",
            "description": "SOPAY COIN TRADE SERVICE",
            "is_active": true,
            "withdrawable": true,
            "country": null
        },
        {
            "id": 23,
            "name": "CARD",
            "description": "VISA | MASTERCARD PAYMENTS",
            "is_active": false,
            "withdrawable": false,
            "country": {
                "id": 2,
                "code": "INT",
                "name": "INTERNATIONAL"
            }
        },
        {
            "id": 24,
            "name": "OM SN",
            "description": "ORANGE MONEY SENEGAL",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 4,
                "code": "SN",
                "name": "SENEGAL"
            }
        },
        {
            "id": 25,
            "name": "WAVE SN",
            "description": "WAVE SENEGAL",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 4,
                "code": "SN",
                "name": "SENEGAL"
            }
        },
        {
            "id": 26,
            "name": "FREE MONEY SN",
            "description": "FREE MONEY SENEGAL",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 4,
                "code": "SN",
                "name": "SENEGAL"
            }
        },
        {
            "id": 27,
            "name": "EXPRESSO SN",
            "description": "EXPRESSO SENEGAL",
            "is_active": false,
            "withdrawable": false,
            "country": {
                "id": 4,
                "code": "SN",
                "name": "SENEGAL"
            }
        },
        {
            "id": 28,
            "name": "WIZALL SN",
            "description": "WIZALL MONEY SENEGAL",
            "is_active": false,
            "withdrawable": false,
            "country": {
                "id": 4,
                "code": "SN",
                "name": "SENEGAL"
            }
        },
        {
            "id": 29,
            "name": "OM CI",
            "description": "ORANGE MONEY COTE D'IVOIRE",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 3,
                "code": "CI",
                "name": "COTE D'IVOIRE"
            }
        },
        {
            "id": 30,
            "name": "MOMO CI",
            "description": "MTN MONEY COTE D'IVOIRE",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 3,
                "code": "CI",
                "name": "COTE D'IVOIRE"
            }
        },
        {
            "id": 31,
            "name": "MOOV CI",
            "description": "MOOV COTE D'IVOIRE",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 3,
                "code": "CI",
                "name": "COTE D'IVOIRE"
            }
        },
        {
            "id": 32,
            "name": "WAVE CI",
            "description": "WAVE COTE D'IVOIRE",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 3,
                "code": "CI",
                "name": "COTE D'IVOIRE"
            }
        },
        {
            "id": 33,
            "name": "MOOV BF",
            "description": "MOOV BURKINA FASO",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 6,
                "code": "BF",
                "name": "BURKINA FASO"
            }
        },
        {
            "id": 34,
            "name": "OM BF",
            "description": "ORANGE MONEY BURKINA FASO",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 6,
                "code": "BF",
                "name": "BURKINA FASO"
            }
        },
        {
            "id": 35,
            "name": "MOMO BJ",
            "description": "MTN MONEY BENIN",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 5,
                "code": "BJ",
                "name": "BENIN"
            }
        },
        {
            "id": 36,
            "name": "MOOV BJ",
            "description": "MOOV BENIN",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 5,
                "code": "BJ",
                "name": "BENIN"
            }
        },
        {
            "id": 37,
            "name": "T-MONEY TG",
            "description": "T-MONEY TOGO",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 7,
                "code": "TG",
                "name": "TOGO"
            }
        },
        {
            "id": 38,
            "name": "MOOV TG",
            "description": "MOOV TOGO",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 7,
                "code": "TG",
                "name": "TOGO"
            }
        },
        {
            "id": 41,
            "name": "XOF",
            "description": "XOF TRADE SERVICE",
            "is_active": true,
            "withdrawable": true,
            "country": null
        },
        {
            "id": 42,
            "name": "CDF",
            "description": "CDF TRADE SERVICE",
            "is_active": true,
            "withdrawable": true,
            "country": null
        },
        {
            "id": 43,
            "name": "UGX",
            "description": "UGX TRADE SERVICE",
            "is_active": true,
            "withdrawable": true,
            "country": null
        },
        {
            "id": 52,
            "name": "VODACOM COD",
            "description": "VODACOM RDC",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 9,
                "code": "COD",
                "name": "RD CONGO"
            }
        },
        {
            "id": 53,
            "name": "AIRTEL COD",
            "description": "AIRTEL RDC",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 9,
                "code": "COD",
                "name": "RD CONGO"
            }
        },
        {
            "id": 54,
            "name": "OM COD",
            "description": "ORANGE MONEY RDC",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 9,
                "code": "COD",
                "name": "RD CONGO"
            }
        },
        {
            "id": 55,
            "name": "AIRTEL COG",
            "description": "AIRTEL CONGO",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 10,
                "code": "COG",
                "name": "CONGO"
            }
        },
        {
            "id": 56,
            "name": "MOMO COG",
            "description": "MOMO CONGO",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 10,
                "code": "COG",
                "name": "CONGO"
            }
        },
        {
            "id": 57,
            "name": "AIRTEL GAB",
            "description": "AIRTEL GABON",
            "is_active": true,
            "withdrawable": true,
            "country": {
                "id": 11,
                "code": "GAB",
                "name": "GABON"
            }
        },
        {
            "id": 58,
            "name": "AIRTEL UGA",
            "description": "AIRTEL UGANDA",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 16,
                "code": "UGA",
                "name": "UGANDA"
            }
        },
        {
            "id": 59,
            "name": "MOMO UGA",
            "description": "MOMO UGANDA",
            "is_active": true,
            "withdrawable": false,
            "country": {
                "id": 16,
                "code": "UGA",
                "name": "UGANDA"
            }
        },
        {
            "id": 60,
            "name": "AIRTEL ZMB",
            "description": "AIRTEL ZAMBIE",
            "is_active": false,
            "withdrawable": false,
            "country": {
                "id": 17,
                "code": "ZMB",
                "name": "ZAMBIA"
            }
        },
        {
            "id": 61,
            "name": "MOMO ZMB",
            "description": "MOMO ZAMBIE",
            "is_active": false,
            "withdrawable": false,
            "country": {
                "id": 17,
                "code": "ZMB",
                "name": "ZAMBIA"
            }
        },
        {
            "id": 62,
            "name": "ZAMTEL ZMB",
            "description": "ZAMTEL ZAMBIE",
            "is_active": false,
            "withdrawable": false,
            "country": {
                "id": 17,
                "code": "ZMB",
                "name": "ZAMBIA"
            }
        }
    ],
    "message": "SoleasPay Services list"
}