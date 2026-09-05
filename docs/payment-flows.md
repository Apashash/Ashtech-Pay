# Parcours de paiement AshTechPay

Ce document décrit le comportement actuellement implémenté pour les dépôts,
les liens de paiement, les retraits et les transferts. Il sert de référence
pour les utilisateurs, les administrateurs et les personnes qui interviennent
sur le code.

## 1. Règles communes

### 1.1 Types de transaction

| Type | Sens | Fournisseur externe |
| --- | --- | --- |
| `deposit` | Argent entrant sur le compte d'un utilisateur | AfribaPay, PixPay, PawaPay ou IziChange |
| `payment_link` | Argent entrant pour le compte d'un marchand via un lien | AfribaPay, PixPay, PawaPay ou IziChange |
| `withdrawal` | Argent sortant vers un opérateur ou un compte bénéficiaire | AfribaPay, PixPay ou PawaPay |
| `transfer_in` | Argent reçu d'un autre utilisateur AshTechPay | Aucun |
| `transfer_out` | Argent envoyé à un autre utilisateur ou à un bénéficiaire externe | Aucun pour l'interne, sinon AfribaPay, PixPay ou PawaPay |

Les mouvements de portefeuille passent par les helpers de portefeuille. Les
codes de devise internes doivent rester ceux du portefeuille réellement
débité ou crédité. En particulier, les portefeuilles CFA d'un pays peuvent
utiliser un code distinct de `XAF` ou `XOF` (par exemple `XAFG`, `XOFB` ou
`XOFC`).

### 1.2 Statuts

| Statut | Signification opérationnelle |
| --- | --- |
| `pending` | Transaction créée, mais pas encore définitivement réglée |
| `processing` | Soumission ou reprise administrative en cours |
| `pending_manual` | Résultat ambigu ou opération nécessitant une décision administrative ; utilisé pour les sorties déjà débitées |
| `completed` | Opération définitivement réussie |
| `failed` | Échec définitif, rejet ou opération remboursée |
| `cancelled` | Annulation locale d'une transaction, principalement un dépôt entrant ou un lien de paiement |

Une transaction fournisseur ambiguë ne doit pas être transformée en `failed`
simplement parce qu'une requête HTTP a expiré. Pour une sortie d'argent, le
portefeuille reste débité jusqu'à une confirmation de succès ou un échec
définitif.

### 1.3 Frais et montants

Les transactions distinguent habituellement :

- `amount` : montant net de l'opération ou montant affiché comme montant
  transféré ;
- `totalAmount` : montant brut payé ou débité ;
- `feeAmount` : total des frais ;
- `ashtechFeeAmount` : part AshTechPay lorsqu'elle est enregistrée ;
- les métadonnées de frais fournisseur et de marge AshTechPay.

Pour un dépôt Mobile Money, l'utilisateur saisit le montant brut : le montant
net crédité est le montant saisi moins les frais.

Pour un retrait ou un transfert externe, le portefeuille est débité du montant
total, frais compris, tandis que `amount` représente le montant net envoyé.

Un remboursement utilise `totalAmount` et le portefeuille d'origine de
l'opération. Cela évite de rembourser uniquement le montant net ou de créditer
une devise différente de celle qui a été débitée.

### 1.4 Protection contre les doubles traitements

Les callbacks et les pollers peuvent observer plusieurs fois la même
transaction. Les transitions définitives utilisent des claims atomiques :

- une transaction entrante n'est créditée que si elle est encore dans un état
  admissible ;
- un payout n'est finalisé qu'une seule fois ;
- un callback tardif ne réactive pas une transaction déjà `completed`, `failed`
  ou `cancelled` ;
- l'UUID PawaPay d'un payout est enregistré avant l'appel fournisseur.

Le navigateur lit l'état local d'AshTechPay. Il ne contacte pas directement
PawaPay pour chaque rafraîchissement de statut.

## 2. Dépôt entrant

### 2.1 Action de l'utilisateur

Le dépôt authentifié est disponible via `POST /api/deposits`. L'utilisateur :

1. choisit le pays ;
2. choisit un opérateur actif de ce pays ;
3. saisit son numéro Mobile Money ;
4. saisit le montant ;
5. confirme le résumé et les frais ;
6. suit l'instruction du fournisseur : OTP, USSD, push, redirection ou
   autorisation PawaPay.

Le serveur revalide le pays, l'opérateur, la maintenance, le fournisseur, la
devise et le montant. Un opérateur absent, inactif ou mal associé au pays est
refusé.

Le dépôt est créé en `pending` avant la soumission au fournisseur. Aucun
portefeuille n'est crédité à ce stade.

### 2.2 Parcours AfribaPay

AfribaPay peut utiliser un flux direct ou un flux avec OTP :

- le flux direct crée le pay-in et ajoute la transaction au poller ;
- si AfribaPay exige un OTP, l'application conserve un contexte OTP temporaire ;
- l'utilisateur saisit le code via `POST /api/deposits/confirm-otp` ;
- la confirmation met à jour la référence externe puis démarre le suivi ;
- un opérateur de redirection peut fournir une URL de paiement ou de retour.

Le statut est ensuite obtenu par callback AfribaPay ou par polling avec la
référence attendue par AfribaPay.

### 2.3 Parcours PixPay

PixPay utilise le flux configuré pour l'opérateur, notamment :

- USSD ;
- OTP ;
- Wave ou redirection.

La transaction reste `pending` pendant l'exécution du flux et est finalisée
par le callback ou le poller PixPay.

### 2.4 Parcours PawaPay

Pour un dépôt PawaPay :

1. un UUID PawaPay est créé et enregistré avec la transaction ;
2. le pays, la devise et le code opérateur sont résolus ;
3. l'opération `DEPOSIT` est vérifiée dans la configuration active ;
4. une préautorisation peut être exigée avant l'appel ;
5. PawaPay renvoie éventuellement une URL ou des instructions
   d'autorisation ;
6. l'application conserve l'UUID et suit le dépôt par callback ou polling.

Les statuts PawaPay `completed` et `failed` sont traités par le même chemin
idempotent, qu'ils proviennent d'un callback ou du poller. Un statut non
définitif reste `pending`.

### 2.5 Confirmation du dépôt

Lorsqu'un fournisseur confirme le dépôt :

1. la transaction passe à `completed` ;
2. le portefeuille de l'utilisateur est crédité du montant net ;
3. une notification utilisateur `deposit_confirmed` est créée ;
4. Telegram reçoit une notification de dépôt confirmé ;
5. un paiement API ou une intention est marqué `completed` si nécessaire ;
6. un webhook marchand est mis en file si `notifyUrl` est configuré.

Pour un dépôt crypto PawaPay n'est pas utilisé : la confirmation est traitée
par le webhook IziChange.

### 2.6 Échec, annulation et timeout

Un échec explicitement renvoyé par le fournisseur :

- passe la transaction en `failed` ;
- ne crédite pas le portefeuille ;
- crée une notification `deposit_failed` ;
- peut déclencher une notification Telegram et un webhook marchand d'échec.

L'utilisateur peut annuler un dépôt encore `pending` depuis l'interface. Cette
action locale passe la transaction en `failed` et retire le dépôt du poller ;
elle ne demande pas au fournisseur d'annuler un encaissement déjà lancé.

Le poller Mobile Money ne fait pas d'auto-annulation fondée sur l'âge de la
transaction. Il continue le suivi, avec une cadence ralentie pour les
transactions anciennes. Une erreur de transport ou une réponse indéterminée
reste donc récupérable.

L'interface de dépôt possède un minuteur visuel indépendant. Lorsque ce
minuteur arrive à zéro, l'écran peut afficher un échec alors que la transaction
serveur reste `pending`. Il faut donc consulter l'historique ou le statut
serveur avant de considérer le paiement définitivement échoué.

## 3. Paiement par lien

Un `payment_link` est un dépôt entrant dont le bénéficiaire est le compte d'un
marchand.

### 3.1 Paiement public

Le payeur ouvre `/pay/:slug`, puis saisit selon le lien :

- son nom et son email ;
- le montant si le lien autorise un montant libre ;
- son pays ;
- l'opérateur et le numéro ;
- l'OTP ou l'autorisation demandée par le fournisseur.

La transaction conserve le payeur, le marchand, le lien, l'intention éventuelle
et la référence fournisseur. Les mêmes règles de validation et de suivi que
pour un dépôt authentifié s'appliquent.

### 3.2 Succès

Après confirmation :

- la transaction `payment_link` passe en `completed` ;
- le portefeuille du marchand reçoit le montant net ;
- l'intention de paiement est finalisée ;
- le payeur peut recevoir un email de confirmation ;
- un PDF configuré pour le lien peut être livré ;
- l'URL de notification du lien ou de l'intégration reçoit un webhook signé
  et idempotent.

Les notifications internes utilisent le type
`payment_link_received`. Un échec utilise `payment_link_failed`.

### 3.3 Annulation administrative

Dans la page « Dépôts & Liens de Paiement », un administrateur peut rejeter ou
annuler localement un dépôt ou un lien encore entrant. Pour ce type de
transaction, `failed` ou `cancelled` ne déclenche pas de nouvelle
réconciliation PawaPay.

Cette annulation ne retire pas un paiement déjà encaissé chez l'opérateur.
Elle empêche ou retire le crédit local ; si le fournisseur a déjà encaissé
l'argent, une réconciliation financière externe peut encore être nécessaire.

## 4. Retrait

### 4.1 Action de l'utilisateur

Le retrait est créé via `POST /api/withdrawals`. L'utilisateur :

1. choisit Mobile Money et le pays destinataire ;
2. choisit l'opérateur ;
3. saisit ou sélectionne le numéro bénéficiaire ;
4. saisit le montant ;
5. vérifie les limites, le solde et les frais ;
6. demande un OTP par email lorsque la protection OTP est activée ;
7. confirme l'opération avec la référence et le code OTP.

Le compte doit être vérifié pour accéder au retrait. Le serveur applique aussi
les blocages administratifs, les limites, le cooldown après échec et le verrou
d'opération OTP.

### 4.2 Débit préalable

Le serveur vérifie d'abord le solde du portefeuille correspondant à la devise
du pays destinataire, puis le débite du montant total.

La transaction est ensuite créée en `pending` avec :

- le montant net envoyé ;
- le montant total débité ;
- les frais ;
- le pays et l'opérateur ;
- le numéro bénéficiaire ;
- la référence interne ;
- l'UUID PawaPay si PawaPay est utilisé.

Le débit est antérieur à l'appel fournisseur. Cette règle est la raison pour
laquelle un timeout ne peut pas déclencher un remboursement automatique sans
preuve d'échec.

### 4.3 Soumission et suivi

Le fournisseur est choisi selon la configuration de l'opérateur :

- AfribaPay : payout avec suivi par référence ;
- PixPay : payout avec suivi par référence et pays ;
- PawaPay : payout avec UUID persistant et suivi par UUID.

Après une soumission acceptée, la transaction est suivie par
`server/payoutPoller.ts`. Le poller récupère les payouts après redémarrage
depuis la base de données.

### 4.4 Résultats

#### Succès

Le payout passe en `completed`. Le montant reste débité, et l'utilisateur
reçoit :

- une notification `withdrawal_confirmed` ;
- un email d'approbation ;
- une notification Telegram selon le type et le fournisseur.

#### Échec définitif

Un échec confirmé passe la transaction en `failed` et :

1. déclenche le cooldown de cinq minutes ;
2. rembourse le `totalAmount` ;
3. recrédite le portefeuille réellement débité ;
4. crée une notification `withdrawal_failed` ;
5. informe l'utilisateur et Telegram.

#### Timeout, erreur réseau ou statut ambigu

Un timeout, un statut inconnu ou une panne de transport ne prouve pas que le
payout n'a pas été exécuté. Dans ce cas :

- le payout reste suivi ;
- la transaction peut passer en `pending_manual` lorsqu'une décision est
  nécessaire ;
- aucun remboursement automatique n'est effectué ;
- aucune nouvelle soumission automatique n'est lancée.

Le suivi est continu. Après environ trente minutes, la fréquence est ralentie
pour respecter les quotas fournisseur, mais il n'y a pas de limite générale de
tentatives.

Un `NOT_FOUND` PawaPay arrête le polling et laisse l'opération à la décision
administrative ; il ne déclenche pas automatiquement un remboursement.

## 5. Transfert interne AshTechPay

Le transfert interne déplace de l'argent entre deux comptes AshTechPay et ne
contacte aucun fournisseur.

### 5.1 Validation

Le destinataire est recherché par email, téléphone ou nom d'utilisateur. Le
serveur refuse :

- un destinataire inexistant ;
- un transfert vers le même compte ;
- un solde insuffisant ;
- un compte non autorisé par les règles applicables.

Le compte émetteur doit être vérifié. Le transfert interne peut utiliser la
protection OTP configurée pour les transferts.

### 5.2 Mouvement atomique

Le serveur :

1. crée un `transfer_out` en `completed` ;
2. crée le `transfer_in` correspondant en `completed` ;
3. utilise la même référence pour les deux écritures ;
4. débite le portefeuille de l'émetteur ;
5. crédite le portefeuille du bénéficiaire ;
6. crée une notification `transfer_received`.

Le transfert interne n'a pas de frais dans le parcours actuel et n'a ni
polling, ni callback, ni remboursement fournisseur.

### 5.3 Notifications

Le bénéficiaire reçoit une notification d'argent reçu. Une notification de
transfert envoyé peut également être transmise à Telegram pour la supervision.

### 5.4 Écart d'interface à connaître

Le backend expose le parcours interne sur `POST /api/transfers/internal`.
L'écran actuel `client/src/pages/dashboard/transfer.tsx` appelle encore
`POST /api/transfers`. Cette différence doit être corrigée ou documentée avant
de considérer l'écran comme aligné avec le parcours interne backend.

Le parcours externe, lui, utilise `POST /api/transfers/send`.

## 6. Transfert externe

Un transfert externe envoie de l'argent à un bénéficiaire Mobile Money hors
du registre AshTechPay. Il suit la même logique financière qu'un retrait.

### 6.1 Action de l'utilisateur

L'utilisateur fournit :

- le bénéficiaire ;
- le pays ;
- l'opérateur ;
- le numéro ;
- le montant ;
- le code OTP de transfert lorsque requis.

Le serveur contrôle la devise du portefeuille destinataire, les limites, les
frais, le solde, le cooldown et la configuration du fournisseur.

### 6.2 Débit et fournisseur

Le portefeuille source est débité avant l'appel. Une transaction
`transfer_out` est créée en `pending`, puis le serveur appelle AfribaPay,
PixPay ou PawaPay.

Le transfert utilise le montant net envoyé et le montant total débité. Le
portefeuille d'origine est conservé dans les métadonnées lorsque nécessaire
pour un remboursement multi-devise.

### 6.3 Résultats

- succès fournisseur : `completed`, notification et email de confirmation ;
- rejet définitif : `failed`, cooldown et remboursement du montant débité ;
- timeout ou réponse ambiguë : `pending_manual`, sans remboursement automatique.

Le suivi est assuré par le même `payoutPoller` que pour les retraits. Les
callbacks PawaPay de payout utilisent le même chemin idempotent que le polling.

## 7. Parcours crypto avec IziChange

Le crypto est un dépôt entrant, pas un retrait Mobile Money.

### 7.1 Création de l'adresse

Depuis l'écran de dépôt crypto, l'utilisateur :

1. choisit le coin ;
2. choisit le réseau ;
3. choisit le pays de référence ;
4. saisit le montant fiat ou l'équivalent crypto ;
5. peut fournir une adresse de remboursement ;
6. reçoit l'adresse de dépôt IziChange ;
7. reçoit séparément le memo/tag lorsqu'il est nécessaire.

Le réseau par défaut canonique pour USDT reste TRC20 lorsqu'il est disponible.
Une adresse et un memo/tag ne doivent pas être concaténés.

### 7.2 Frais et crédit

La transaction conserve en USDT :

- le montant brut ;
- les frais IziChange ;
- la marge AshTechPay ;
- le total des frais ;
- le montant net crédité ;
- l'actif et le réseau.

L'utilisateur doit envoyer le bon actif sur le bon réseau. Le serveur ne crédite
pas le portefeuille avant confirmation du webhook.

### 7.3 Confirmation et expiration

IziChange confirme le dépôt via `/api/izichange/webhook`. Le webhook :

- valide la signature ;
- retrouve la transaction par référence ;
- effectue le claim idempotent ;
- crédite le portefeuille USDT ;
- crée la notification de dépôt ;
- met à jour l'intention et le webhook marchand si nécessaire.

Le dépôt crypto a une expiration serveur spécifique de quinze minutes s'il
reste `pending`. Cette expiration ne s'applique pas aux dépôts Mobile Money,
aux retraits ou aux transferts externes.

L'interface peut afficher un compte à rebours plus court ; ce compte à rebours
visuel n'est pas la règle serveur de crédit.

## 8. Actions administrateur

### 8.1 Consulter

Les pages administrateur permettent de :

- filtrer par type et par statut ;
- rechercher par référence, nom, email ou téléphone ;
- voir le montant net, les frais et le total payé ou débité ;
- consulter la référence interne et la référence externe ;
- ouvrir le détail du bénéficiaire, du payeur, du pays, de l'opérateur et du
  fournisseur ;
- exporter la liste générale en CSV ;
- consulter les logs d'administration et d'audit.

Les pages principales sont :

- `transactions` : vue générale ;
- `transactions/deposits` : dépôts et liens de paiement ;
- `transactions/withdrawals` : retraits ;
- `transactions/transfers` : transferts ;
- `pending-payouts` : retraits et transferts externes en `pending_manual`.

### 8.2 Valider ou approuver

L'action de validation ne signifie pas la même chose pour toutes les
transactions :

- dépôt non contrôlé par PawaPay : validation locale avec crédit selon le
  chemin du dépôt ;
- dépôt PawaPay : rapprochement auprès de PawaPay avant de considérer le
  dépôt comme définitivement réussi ;
- retrait ou transfert externe : soumission au fournisseur, sauf si
  l'administrateur choisit explicitement une confirmation manuelle ;
- transfert interne : il est déjà finalisé par le parcours interne.

L'administrateur ne doit pas « valider » un payout ambigu simplement parce que
le client attend : il faut d'abord déterminer si le fournisseur a payé.

### 8.3 Rejeter ou annuler

Pour un `deposit` ou un `payment_link` entrant :

- `failed` ou `cancelled` peut être appliqué localement ;
- aucun nouvel appel PawaPay n'est nécessaire pour ce rejet ;
- un dépôt encore non crédité ne doit pas créditer le portefeuille ensuite ;
- le callback tardif est ignoré grâce au contrôle d'état.

Pour un `withdrawal` ou un `transfer_out` PawaPay dont le résultat est ambigu,
le rapprochement fournisseur reste obligatoire avant un rejet ou un
remboursement local. Cette restriction protège contre le cas où le bénéficiaire
aurait déjà reçu les fonds.

### 8.4 Exécuter un payout en attente manuelle

La page « Retraits & Transferts en attente » propose une exécution via le
fournisseur choisi. Le serveur :

1. verrouille atomiquement `pending_manual` vers `processing` ;
2. empêche les clics concurrents ;
3. vérifie les références PawaPay existantes ;
4. soumet le payout si une nouvelle soumission est autorisée ;
5. remet en suivi le résultat accepté.

Une tentative PawaPay déjà identifiée ne doit pas être soumise une deuxième
fois. Elle doit être réconciliée avec l'UUID existant.

### 8.5 Confirmer manuellement

« Confirmer » sur un payout `pending_manual` signifie :

- marquer localement la transaction `completed` ;
- ne pas appeler de fournisseur ;
- notifier l'utilisateur comme payé.

Cette action est réservée au cas où le paiement a réellement été effectué
manuellement ou vérifié hors du flux automatique. Pour une transaction PawaPay
encore non résolue, la confirmation manuelle est refusée tant que le
rapprochement ne donne pas un résultat sûr.

### 8.6 Rembourser

« Rembourser » sur un payout `pending_manual` :

1. recrédite d'abord le montant total dans le portefeuille d'origine ;
2. ne change le statut que si le remboursement réussit ;
3. passe ensuite la transaction à `failed` ;
4. active le cooldown de cinq minutes ;
5. crée une notification d'échec ou d'annulation ;
6. écrit une trace d'administration.

Si le crédit échoue, la transaction doit rester `pending_manual` afin que les
fonds ne soient pas perdus silencieusement.

## 9. Notifications et callbacks

### Notifications utilisateur

Selon le parcours, AshTechPay peut créer :

- `deposit_confirmed` ou `payment_link_received` ;
- `deposit_failed` ou `payment_link_failed` ;
- `withdrawal_confirmed` ou `withdrawal_failed` ;
- `transfer_received` ou `transfer_failed`.

### Email

Les emails sont utilisés notamment pour :

- OTP de retrait ;
- confirmation d'un retrait ;
- confirmation du payeur d'un lien ;
- livraison éventuelle du contenu d'un lien.

### Telegram et supervision

Telegram reçoit les événements de dépôt, de retrait, de transfert et certains
échecs pour la supervision. Les erreurs d'envoi de notification ne doivent pas
annuler une transaction déjà réglée.

### Webhook marchand

Pour les dépôts API, les hosted pages et les liens configurés avec
`notifyUrl`, les événements sont mis en file dans le système de webhook
marchand. La livraison est signée, idempotente et réessayée séparément de la
transaction financière.

### Callbacks fournisseurs

Les callbacks publics sont :

- `/api/afribapay/webhook` ;
- `/api/pixpay/webhook` ;
- `/api/pawapay/deposit-callback` ;
- `/api/pawapay/payout-callback` ;
- `/api/izichange/webhook`.

Ils sont vérifiés selon leur fournisseur et utilisent les mêmes chemins de
finalisation que le polling lorsque c'est applicable.

## 10. Matrice de décision rapide

| Situation | Dépôt entrant | Retrait / transfert externe |
| --- | --- | --- |
| Fournisseur confirme le succès | `completed`, crédit | `completed`, débit conservé |
| Fournisseur confirme l'échec | `failed`, aucun crédit | `failed`, remboursement |
| Timeout HTTP | `pending`, suivi continu | `pending_manual` ou suivi continu, pas de remboursement automatique |
| Callback tardif après annulation locale | Ignoré, pas de crédit | Ignoré si la transaction est déjà finale |
| Erreur de configuration avant appel | `failed` selon le cas | `pending_manual` si le débit a déjà eu lieu |
| Action admin sur dépôt ou lien entrant | Rejet/annulation locale possible | Sans objet |
| Action admin sur payout ambigu | Sans objet | Rapprocher, exécuter, confirmer manuellement ou rembourser |

## 11. Sources de référence dans le code

- Routes et transitions : `server/routes.ts`
- Polling et finalisation des dépôts : `server/paymentPoller.ts`
- Polling, succès, échec et remboursements des payouts :
  `server/payoutPoller.ts`
- Claims, crédits et remboursements : `server/storage.ts`
- Interface dépôt : `client/src/pages/dashboard/deposit.tsx`
- Interface retrait : `client/src/pages/dashboard/withdraw.tsx`
- Interface transfert : `client/src/pages/dashboard/transfer.tsx`
- Administration générale : `client/src/pages/admin/transactions.tsx`
- Administration dépôts et liens :
  `client/src/pages/admin/transactions/deposits.tsx`
- Administration des payouts manuels :
  `client/src/pages/admin/pending-payouts.tsx`
