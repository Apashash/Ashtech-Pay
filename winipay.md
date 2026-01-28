Paramètre API Token

Toute requête vers l'API WiniPayer doit contenir les tokens d'authentification du compte marchand dans le Header de la requête. Les Tokens de l'API sont disponibles sur la page de detail de chaque compte marchand dans votre Manager.
Paramètres Headers	Obligatoire	Exemple
X-Merchant-Apply	Oui	5NqZlFTai12YsSWbGbS6
X-Merchant-Token	Oui	828209b9-a457-4a06-9635-35dc46187330
NB : Il est tout à fait possible de générer des liens de paiement en TEST ou en PROD en fonction de l'environnement du compte marchand :
- Si le compte marchand est en TEST vous ne pouvez générer que des liens de paiements en TEST en utilisant les Tokens de TEST.
- Si le compte marchand est en PROD vous ne pouvez générer que des liens de paiement en PROD en utilisant les Tokens de PROD.
Générer un lien de paiement

Pour générer un lien de paiement vous aurez besoin des éléments suivants :
1 - Endpoint API Standard

Pour générer un lien de paiement standard, vous devez effectuer une requête HTTP POST sur l'URL suivant :
https://api-v2.winipayer.com/checkout/standard/create
Copy
2 - Paramètres Body de base

En plus des parametres Headers, vous devez utiliser en paramètres Body les clés suivantes:
Paramètres Body	Type	Obligatoire	Exemple
env	string	Oui	test pour un paiement en TEST et
prod pour un paiement en PRODUCTION
amount	int	Oui	3500 Le montant de la transaction.
description	string	Oui	Facture Client Mariam N° 2563584
items	json	Non	Le paramètre items est un tableau d'objet. Exemple ci-dessous
custom_data	json	Non	{"user_id":33,"order_id":365}
client_pay_fee	boolean	Non	true Permets de specifier si le client payé les frais de transaction.
cancel_url	url	Oui	https://tester.winipayer.com/cancel
return_url	url	Oui	https://tester.winipayer.com/return
callback_url	url	Oui	https://tester.winipayer.com/callback
NB : Pour les paramètres supplémentaires facultatif, veuillez vous référer à la section Paramètres supplémentaires
Exemple de paramètre items

[
    {
        "name": "Boubou marocain",
        "quantity": 1,
        "price_unit": 3500,
        "description": "Qualité supérieur",
        "price_total": 3500
    },
    ...
]
Copy
NB : Les montants des items n'ont aucun impact sur le montant à payer par le client . ses informations sont à titre indicatif pour votre client.
Exemple de requête cURL

curl --location 'https://api-v2.winipayer.com/checkout/standard/create' \
--header 'X-Merchant-Apply: 5NqZlFTai12YsSWbGbS6' \
--header 'X-Merchant-Token: 828209b9-a457-4a06-9635-35dc46187330' \
--form 'env="prod"' \
--form 'amount="3500"' \
--form 'description="Facture Client Mariam N° 2563584"' \
--form 'items="[{\"name\":\"Boubou marocain\",\"quantity\":1,\"price_unit\":3500,\"description\":"Qualité supérieur",\"price_total\":3500}]"' \
--form 'custom_data="{\"user_id\":33,\"order_id\":365}"' \
--form 'client_pay_fee="true"' \
--form 'cancel_url="https://tester.winipayer.com/cancel"' \
--form 'return_url="https://tester.winipayer.com/return"' \
--form 'callback_url="https://tester.winipayer.com/callback"'
Copy
Exemple de réponse succès

Si les paramètres sont valides vous devez obtenir une réponse au format JSON :
{
    "success": true,
    "results": {
        "uuid": "2f1e1d74-78f3-4759-96a4-1ff6bc409d91",
        "crypto": "invoice_prod_9d6b71764a1f20cfe851f00f57908e599439e7c548fa1eae8bc4f53b00e5f571a0e8923e725bae4a1a86e191cb7911b1e08ad8e3",
        "env": "prod",
        "amount": 500,
        "currency": "xof",
        "operator": null,
        "operator_process": null,
        "operator_message": null,
        "checkout_process": "https://checkout-v2.winipayer.com/process/tng/invoice_prod_9d6b71764a1f20cfe851f00f57908e599439e7c548fa1eae8bc4f53b00e5f571a0e8923e725bae4a1a86e191cb7911b1e08ad8e3",
        "expired_at": "2024-07-08 21:35:55"
    },
    "errors": [],
    "messages": []
}
Copy
Après avoir obtenu l'URL de paiement checkout_process vous devez rediriger l'utilisateur sur ce lien (Portail de paiement) pour effectuer le paiement.

Attention !
Il est recommandé de sauvegarder la réponse de l'API pour des vérifications ultérieures après le paiement du client.
uuid est la référence permanente de la facture. Elle vous servira pour obtenir les informations détaillées du paiement.
crypto est la référence temporaire de la facture. Elle est valide uniquement durant la transaction.
expired_at est la date d'expiration du lien de paiement. Elle a une durée de validité de 30 minutes
Exemple de réponse erreur

{
    "success": false,
    "results": [],
    "errors": {
        "code": 2000,
        "key": "amount",
        "msg": "The amount field is required."
    },
    "messages": []
}
Copy
Portail de paiement (Checkout)

Portail de paiment client.
image
Vérifier un lien de paiement

Endpoint API de vérification

Pour obtenir les détails d'un lien de paiement, vous devez effectuer une requête HTTP POST sur l'URL suivant :
https://api-v2.winipayer.com/checkout/standard/detail/:uuid
Copy

Attention !
:uuid remplacer cette clé par la valeur de la reference UUID de la facture :
Exemple : `https://api-v2.winipayer.com/checkout/standard/detail/2f1e1d74-78f3-4759-96a4-1ff6bc409d91`
Copy
Paramètres Body

En plus des parametres Headers, vous devez utiliser en paramètres Body les clés suivantes:
Paramètres Body	Type	Obligatoire	Exemple
env	string	Oui	test pour un paiement en TEST et
prod pour un paiement en PRODUCTION
Exemple de réponse succès

{
    "success": true,
    "results": {
        "invoice": {
            "uuid": "2f1e1d74-78f3-4759-96a4-1ff6bc409d91",
            "crypto": "invoice_prod_9d6b71764a1f20cfe851f00f57908e599439e7c548fa1eae8bc4f53b00e5f571a0e8923e725bae4a1a86e191cb7911b1e08ad8e3",
            "module": {
                "name": "default",
                "uuid": null
            },
            "hash": "3a58322928469be5f4d152af26ecd611123bca04c81a15f59b1a9c6b54600bed",
            "env": "prod",
            "version": "v2",
            "state": "success",
            "state_date": "2024-07-09 08:04:58",
            "amount_init": 3500,
            "amount": 3500,
            "client_pay_fee": true,
            "commission_amount": 87.5,
            "commission_rate": 2.5,
            "commission_fee": null,
            "amount_available": 3412.5,
            "currency": "xof",
            "channel": [],
            "description": "acture Client Mariam",
            "wpsecure": false,
            "wpsecure_validate": null,
            "items": [
                {
                    "name": "Boubou marocain",
                    "quantity": 1,
                    "price_unit": 3500,
                    "description": null,
                    "price_total": 3500
                }
            ],
            "custom_data": {
                "user_id": 33,
                "order_id": 365
            },
            "store": {
                "uuid": "af0169d8-fdb4-4df8-bf8e-6b16ab321379",
                "name": "WiniHost",
                "description": "WiniHost est un service qui offre tout ce qu'il faut pour lancer un site internet ou une application en ligne avec tous les standards de sécurité: nom de domaine gratuit, hébergement web, comptes mail, bases de données, CMS, etc...",
                "web_url": "https://www.winihost.com",
                "logo": "https://api-v2.winipayer.com/all/media/view/117c5a99-b6eb-4ada-8374-5bc716b370b0",
                "email": "info@winihost.com",
                "phone": "2250555800400",
                "country": "ci",
                "city": "Abidjan",
                "address": "Angré 9ème tranche, Immeuble Téré",
                "ipn_url": "https://pay.winihost.com/ipn"
            },
            "operator": "wave-cote-divoire",
            "operator_ref": "TBLBMKZHJVE",
            "reference": {
                "identifier": null,
                "name": null,
                "phone": null,
                "email": null
            },
            "customer_pay": {
                "name": "JARS T I",
                "phone": "+2250555800400",
                "email": null
            },
            "cancel_url": "https://tester.winipayer.com/cancel",
            "return_url": "https://tester.winipayer.com/return",
            "callback_url": "https://tester.winipayer.com/callback",
            "checkout_link": "https://checkout-v2.winipayer.com/process/tng/invoice_prod_9cb7961e9d04cd562e833c449fdfad78b545c4e3fb5ce9146bc86d46e452e448678cd4a7a44c674ffe0a1767eb89822a6f393ecc",
            "checkout_receipt": null,
            "ipn_call": null,
            "created_at": "2024-07-09 08:04:58",
            "expired_at": "2024-07-09 08:34:58"
        }
    },
    "errors": [],
    "messages": []
}
Copy
La clé hash renvoyée par dans la réponse par WiniPayer est le hash256 du prod_private_key ou test private key de votre compte marchand en fonction de l'environnement (test ou prod) dans laquelle la facture a été génère. Cette {test|prod}_private_key est concaténé avec les clés uuid , crypto , amount et created_at avant le hashage. Ce hash vous permettra de vous assurer que les données que vous avez reçues proviennent de nos serveurs.
// Example PHP pour une facture générer en PROD
$generated_hash = hash('sha256', $prod_private_key . $uuid . $crypto . $amount . $created_at);

if($received_token === $generated_hash)
{
      // Valid transaction
}
Copy
Exemple de réponse expiré

{
    "success": false,
    "results": [],
    "errors": {
        "code": 3000,
        "key": "uuid",
        "msg": "Invalide or missing invoice"
    },
    "messages": []
}
Copy
Exemple de réponse échec

{
    "success": false,
    "results": [],
    "errors": {
        "code": 2000,
        "key": "X-Merchant-Token",
        "msg": "Invalid or missing X-Merchant-Token"
    },
    "messages": []
}
Copy
Paramètres Body supplémentaires

En plus des Paramètres Body de base pour la génération de liens de paiement, vous avez la possibilité d'ajouter des paramètres supplémentaires au besoin :
Paramètres Body	Type	Exemple
wpsecure	boolean	true Ce paramètre permet d'ajouter une couche de validation*
channel	json	{"wave-cote-divoire", ...} Permet de fixer les opérateurs à afficher au client
reference	json	{"identifier":"AA256KL","name":"Koffi Charle","phone":"0555800400", "email":"info@email.com"}
operator	string	wave-cote-divoire Permets de générer une session directement auprès de l'opérateur.
operator_input	string	{"phone":"0555800400"} la valeur de cette clé est dependant de l'opérateur
Information :
wpsecure : Ce paramètre permet d'ajouter une couche de validation supplémentaire.
Si la valeur vaut true alors un code à 9 chiffres (Ex: 653-987-167) est envoyé au client via le mail specifier dans le paramètre reference.email.
Le client devra apres validation du paiement communiquer ce code au marchand pour finaliser la transaccion.
Cas d'utilisation : Le code de validation peut être utilisé dans le cas d'une transaction entre un client qui commande un article sur internet et qui voudrai communiquer le code uniquement après réception et vérification du colis.


À la différence de l'API de paiement Standard, l'API de paiement Express demande moins de configuration et de paramètre pour générer un lien de paiement.
NB : L'objectif est de générer rapidement des liens de paiement avec la référence (Uuid) du compte marchand.
Paramètre API Token

Toute requête vers l'API WiniPayer doit contenir les tokens d'authentification du compte marchand dans le Header de la requête. La Référence (Uuid) du compte marchand est disponible sur la page de detail de chaque compte marchand dans votre Manager.
Paramètres Headers	Obligatoire	Exemple
X-Merchant-Uuid	Oui	af0169d8-fdb4-4df8-af8e-6b16af3213790
NB : Il est tout à fait possible de générer des liens de paiement en TEST ou en PROD en fonction de l'environnement du compte marchand :
- Si le compte marchand est en TEST vous ne pouvez générer que des liens de paiements en TEST en utilisant les Tokens de TEST.
- Si le compte marchand est en PROD vous ne pouvez générer que des liens de paiement en PROD en utilisant les Tokens de PROD.
Générer un lien de paiement

Pour générer un lien de paiement vous aurez besoin des éléments suivants :
1 - Endpoint API Express

Pour générer un lien de paiement express, vous devez effectuer une requête HTTP POST sur l'URL suivant :
https://api-v2.winipayer.com/checkout/express/create
Copy
2 - Paramètres Body de base

En plus des parametres Headers, vous devez utiliser en paramètres Body les clés suivantes:
Paramètres Body	Type	Obligatoire	Exemple
env	string	Oui	test pour un paiement en TEST et
prod pour un paiement en PRODUCTION
amount	int	Oui	3500 Le montant de la transaction.
client_pay_fee	boolean	Non	true Permets de specifier si le client payé les frais de transaction.
Exemple de requête cURL

curl --location 'https://api-v2.winipayer.com/checkout/express/create' \
--header 'X-Merchant-uuid: af0169d8-fdb4-4df8-af8e-6b16af3213790' \
--form 'env="prod"' \
--form 'amount="100"' \
--form 'client_pay_fee="true"'
Copy
Exemple de réponse succès

Si les paramètres sont valides vous devez obtenir une réponse au format JSON :
{
    "success": true,
    "results": {
        "uuid": "5010eec1-2678-51db-b0f9-e4ac8c6d5988",
        "crypto": "invoice_prod_ce2c813e152363b5702042af105665834c700ebfd9daa4485e99bfe94b4df3a0e5228fde1ed1bad414b2a3f018ab9b9e3fbe74cf",
        "env": "prod",
        "amount": 100,
        "operator": null,
        "operator_process": null,
        "operator_message": null,
        "checkout_process": "https://checkout-v2.winipayer.com/process/tng/invoice_prod_ce2c813e152363b5702042af105665834c700ebfd9daa4485e99bfe94b4df3a0e5228fde1ed1bad414b2a3f018ab9b9e3fbe74cf",
        "expired_at": "2024-07-10 13:09:28"
    },
    "errors": [],
    "messages": []
}
Copy
Après avoir obtenu l'URL de paiement checkout_process vous devez rediriger l'utilisateur sur ce lien (Portail de paiement) pour effectuer le paiement.

Attention !
Il est recommandé de sauvegarder la réponse de l'API pour des vérifications ultérieures après le paiement du client.
uuid est la référence permanente de la facture. Elle vous servira pour obtenir les informations détaillées du paiement.
crypto est la référence temporaire de la facture. Elle est valide uniquement durant la transaction.
expired_at est la date d'expiration du lien de paiement. Elle a une durée de validité de 30 minutes
Exemple de réponse erreur

{
    "success": false,
    "results": [],
    "errors": {
        "code": 2000,
        "key": "amount",
        "msg": "The amount field is required."
    },
    "messages": []
}
Copy
Portail de paiement (Checkout)

Portail de paiment client.
image
Vérifier un lien de paiement

Endpoint API de vérification

Pour obtenir les détails d'un lien de paiement, vous devez effectuer une requête HTTP POST sur l'URL suivant :
https://api-v2.winipayer.com/checkout/express/detail/:crypto
Copy

Attention !
:crypto remplacer cette clé par la valeur de la clé crypto de la facture :
Exemple: https://api-v2.winipayer.com/checkout/express/detail/invoice_prod_ce2c813e152363b5702042af105665834c700ebfd9daa4485e99bfe94b4df3a0e5228fde1ed1bad414b2a3f018ab9b9e3fbe74cf
Copy
Paramètres Body

En plus des parametres Headers, vous devez utiliser en paramètres Body les clés suivantes:
Paramètres Body	Type	Obligatoire	Exemple
env	string	Oui	test pour un paiement en TEST et
prod pour un paiement en PRODUCTION
Exemple de réponse succès

{
    "success": true,
    "results": {
        "invoice": {
            "uuid": "2f1e1d74-78f3-4759-96a4-1ff6bc409d91",
            "crypto": "invoice_prod_9d6b71764a1f20cfe851f00f57908e599439e7c548fa1eae8bc4f53b00e5f571a0e8923e725bae4a1a86e191cb7911b1e08ad8e3",
            "module": {
                "name": "default",
                "uuid": null
            },
            "hash": "3a58322928469be5f4d152af26ecd611123bca04c81a15f59b1a9c6b54600bed",
            "env": "prod",
            "version": "v2",
            "state": "success",
            "state_date": "2024-07-09 08:04:58",
            "amount_init": 3500,
            "amount": 3500,
            "client_pay_fee": true,
            "commission_amount": 87.5,
            "commission_rate": 2.5,
            "commission_fee": null,
            "amount_available": 3412.5,
            "currency": "xof",
            "channel": [],
            "description": null,
            "wpsecure": false,
            "wpsecure_validate": null,
            "items": [],
            "custom_data": [],
            "store": {
                "uuid": "af0169d8-fdb4-4df8-bf8e-6b16ab321379",
                "name": "WiniHost",
                "description": "WiniHost est un service qui offre tout ce qu'il faut pour lancer un site internet ou une application en ligne avec tous les standards de sécurité: nom de domaine gratuit, hébergement web, comptes mail, bases de données, CMS, etc...",
                "web_url": "https://www.winihost.com",
                "logo": "https://api-v2.winipayer.com/all/media/view/117c5a99-b6eb-4ada-8374-5bc716b370b0",
                "email": "info@winihost.com",
                "phone": "2250555800400",
                "country": "ci",
                "city": "Abidjan",
                "address": "Angré 9ème tranche, Immeuble Téré",
                "ipn_url": "https://pay.winihost.com/ipn"
            },
            "operator": "wave-cote-divoire",
            "operator_ref": "TBLBCKZHJVE",
            "reference": [],
            "customer_pay": {
                "name": "JARS T I",
                "phone": "+2250555800400",
                "email": null
            },
            "cancel_url": "https://checkout-v2.winipayer.com/page/cancel",
            "return_url": "https://checkout-v2.winipayer.com/page/return",
            "callback_url": "https://checkout-v2.winipayer.com/page/callback",
            "checkout_link": "https://checkout-v2.winipayer.com/process/tng/invoice_prod_9cb7961e9d04cd562e833c449fdfad78b545c4e3fb5ce9146bc86d46e452e448678cd4a7a44c674ffe0a1767eb89822a6f393ecc",
            "checkout_receipt": null,
            "ipn_call": null,
            "created_at": "2024-07-09 08:04:58",
            "expired_at": "2024-07-09 08:34:58"
        }
    },
    "errors": [],
    "messages": []
}
Copy
La clé hash renvoyée par dans la réponse par WiniPayer est le hash256 du prod_private_key ou test private key de votre compte marchand en fonction de l'environnement (test ou prod) dans laquelle la facture a été génère. Cette {test|prod}_private_key est concaténé avec les clés uuid , crypto , amount et created_at avant le hashage. Ce hash vous permettra de vous assurer que les données que vous avez reçues proviennent de nos serveurs.
// Example PHP pour une facture générer en PROD
$generated_hash = hash('sha256', $prod_private_key . $uuid . $crypto . $amount . $created_at);

if($received_token === $generated_hash)
{
      // Valid transaction
}
Copy
Exemple de réponse expiré

{
    "success": false,
    "results": [],
    "errors": {
        "code": 3000,
        "key": "uuid",
        "msg": "Invalide or missing invoice"
    },
    "messages": []
}
Copy
Exemple de réponse échec

{
    "success": false,
    "results": [],
    "errors": {
        "code": 2000,
        "key": "X-Merchant-Token",
        "msg": "Invalid or missing X-Merchant-Token"
    },
    "messages": []
}



API de transfert Standard

Paramètre API Token
Générer un lien de transfert
Vérifier les détails du transfert
Paramètre API Token

Toute requête vers l'API WiniPayer doit contenir les tokens d'authentification du compte marchand dans le Header de la requête. Les Tokens de l'API sont disponibles sur la page de detail de chaque compte marchand dans votre Manager.
Paramètres Headers	Obligatoire	Exemple
X-Merchant-Apply	Oui	5NqZlFTbi12YsSWbGbg6
X-Merchant-Token	Oui	828219b9-a457-4b06-9645-35dc46687330
NB : Les transferts sont disponibles uniquement en environnement PROD
Générer une liste de transfert

Pour générer une liste de transfert vous aurez besoin des éléments suivants :
1 - Endpoint API Standard

Pour générer une liste de transfert standard, vous devez effectuer une requête HTTP POST sur l'URL suivant :
https://api-v2.winipayer.com/payout/standard/create
Copy
2 - Paramètres Body de la requête

En plus des parametres Headers, vous devez utiliser en paramètres Body les clés suivantes:
Paramètres Body	Type	Obligatoire	Exemple
env	string	Oui	prod pour un transfert en PRODUCTION
operator	string	Oui	wave-cote-divoire Liste des opérateurs ici
description	string	Non	Virement salaire Juillet
custom_data	json	Non	{"month":"july","amount":350000}
callback_url	url	Non	https://tester.winipayer.com/callback
Lien a target si transfert terminé
recipients	json	Oui	Liste des bénéficiaires. Exemple ci-dessous
Exemple de paramètre recipients

[
  {
    "name": "Kouassi Angela",
    "account": "0707971629",
    "amount": 120000
  },
  ...
]
Copy
Exemple de requête cURL

curl --location 'https://api-v2.winipayer.com/payout/standard/create' \
--header 'X-Merchant-Apply: 5NqZlFTbi12YsSWbGbg6' \
--header 'X-Merchant-Token: 828219b9-a457-4b06-9645-35dc46687330' \
--form 'env="prod"' \
--form 'operator="wave-cote-divoire"' \
--form 'description="Virement salaire JUIN"' \
--form 'custom_data="{\"code\":\"4b84a5e323d0\"}"' \
--form 'callback_url="https://tester.winipayer.com/callback"' \
--form 'recipients="[{\"name\":\"Kouakou Bernard\",\"account\":\"0765854523\",\"amount\":100}]"'
Copy
Exemple de réponse succès

Si les paramètres sont valides vous devez obtenir une réponse au format JSON :
{
    "uuid": "c312601d-0944-54df-a467-783c5bc41bcb",
    "crypto": "payout_prod_a2c3729035e3d87655de471d27e130c1430afec95383b100dca20493afdd0d13bf9b1080b1b8e43d5cfe8bf5102eb11d97365323",
    "merchant": {
        "uuid": "af0169d8-fdb4-4df8-bf8e-6b16ab321379",
        "name": "WiniHost"
    },
    "env": "prod",
    "version": "v2",
    "operator": "wave-cote-divoire",
    "currency": "xof",
    "amount": 100,
    "commission_rate": 2,
    "commission_fee": 0,
    "commission_amount": 5,
    "amount_total": 105,
    "description": "Virement salaire JUIN",
    "recipients": [
        {
            "uuid": "795c866e-6448-49ad-a2cf-c7dad15ce5c1",
            "name": "Kouakou Bernard",
            "account": "+2250765854523",
            "amount": 100,
            "commission_amount": 5,
            "amount_total": 105,
            "operator_ref": null,
            "state": "waitting",
            "state_at": null
        }
    ],
    "custom_data": [],
    "callback_url": null,
    "ipn_call": null,
    "queue": 0,
    "finish": 1,
    "valide": true,
    "valide_at": "2024-07-05 18:57:21",
    "state": "success",
    "state_at": "2024-07-05 18:58:04",
    "created_at": "2024-07-05 18:56:52"
}
Copy
Exemple de réponse erreur

{
    "success": false,
    "results": [],
    "errors": {
        "code": 2000,
        "key": "operator",
        "msg": "The operator field is required."
    },
    "messages": []
}
Copy
Vérifier les détails du transfert

Endpoint API de vérification

Pour obtenir les détails d'un lien de paiement, vous devez effectuer une requête HTTP POST sur l'URL suivant :
https://api-v2.winipayer.com/payout/standard/detail/:uuid
Copy

Attention !
:uuid remplacer cette clé par la valeur de la reference UUID de la facture :
Exemple : `https://api-v2.winipayer.com/checkout/invoice/detail/c312601d-0944-54df-a467-783c5bc41bcb
Copy
Paramètres Body

En plus des parametres Headers, vous devez utiliser en paramètres Body les clés suivantes:
Paramètres Body	Type	Obligatoire	Exemple
env	string	Oui	prod pour un paiement en PRODUCTION
Exemple de réponse succès

{
    "uuid": "c312601d-0944-44df-a467-783c5bc41bcb",
    "crypto": "payout_prod_a2c3729035e3d87755de471d27e130c1430afec97383b100dca20493afdd0d13bf9b1080b1b8e43d5cfe8bf5102eb11d97365323",
    "merchant": {
        "uuid": "af0169d8-fdb4-4df8-bf8e-6b16ab321379",
        "name": "WiniHost"
    },
    "env": "prod",
    "version": "v2",
    "operator": "wave-cote-divoire",
    "currency": "xof",
    "amount": 100,
    "commission_rate": 2,
    "commission_fee": 0,
    "commission_amount": 5,
    "amount_total": 105,
    "description": "Virement salaire JUIN",
    "recipients": [
        {
            "uuid": "795c866e-6448-49ad-a2cf-c7dad15ce5c1",
            "name": "Kouakou Bernard",
            "account": "+2250765854523",
            "amount": 100,
            "commission_amount": 5,
            "amount_total": 105,
            "operator_ref": null,
            "state": "waitting",
            "state_at": null
        }
    ],
    "custom_data": [],
    "callback_url": null,
    "ipn_call": null,
    "queue": 0,
    "finish": 1,
    "valide": true,
    "valide_at": "2024-07-05 18:57:21",
    "state": "success",
    "state_at": "2024-07-05 18:58:04",
    "created_at": "2024-07-05 18:56:52"
}