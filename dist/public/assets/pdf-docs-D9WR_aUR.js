import{E as I}from"./jspdf.es.min-Dg4bS7AG.js";const h={cover:[11,14,17],gold:[240,185,11],navy:[15,23,42],sectionBg:[241,245,249],body:[51,65,85],muted:[100,116,139],white:[255,255,255]},z=210,b=297,s=18,N=18,f=z-s-N;function m(e,o){e.setTextColor(o[0],o[1],o[2])}function v(e,o){e.setFillColor(o[0],o[1],o[2])}function R(e,o){e.setDrawColor(o[0],o[1],o[2])}function k(e,o,n,a,t,l=5.5){const i=e.splitTextToSize(o,t);return e.text(i,n,a),a+i.length*l}function A(e,o,n=20){return o+n>b-20?(e.addPage(),22):o}function y(e,o,n){return n=A(e,n,20),v(e,h.gold),e.rect(s,n-4,2.5,9,"F"),e.setFont("helvetica","bold"),e.setFontSize(12),m(e,h.navy),e.text(o,s+5,n+2),R(e,[226,232,240]),e.line(s,n+7,s+f,n+7),n+13}function p(e,o,n){return n=A(e,n,12),e.setFont("helvetica","bold"),e.setFontSize(9.5),m(e,h.navy),e.text(o,s,n),n+7}function d(e,o,n,a=0){return n=A(e,n,10),e.setFont("helvetica","normal"),e.setFontSize(9),m(e,h.body),k(e,o,s+a,n,f-a,5.2)}function g(e,o,n,a){return{t:e,r:o,g:n,b:a}}const L={r:244,g:112,b:103},F={r:87,g:171,b:90},w={r:108,g:182,b:255},S={r:246,g:157,b:80},T={r:118,g:131,b:144},D={r:121,g:192,b:255},E={r:205,g:217,b:229},C={r:173,g:186,b:199};function B(e){const o=[];let n=0;for(;n<e.length;)if(e[n]==='"'){let a=n+1;for(;a<e.length;){if(e[a]==="\\"){a+=2;continue}if(e[a]==='"'){a++;break}a++}const t=e.slice(n,a);let l=a;for(;l<e.length&&(e[l]===" "||e[l]==="	");)l++;const i=e[l]===":"?L:F;o.push(g(t,i.r,i.g,i.b)),n=a}else if(e[n]>="0"&&e[n]<="9"||e[n]==="-"&&n+1<e.length&&e[n+1]>="0"&&e[n+1]<="9"){let a=n+(e[n]==="-"?1:0);for(;a<e.length&&(e[a]>="0"&&e[a]<="9"||e[a]==="."||e[a]==="e"||e[a]==="E");)a++;o.push(g(e.slice(n,a),w.r,w.g,w.b)),n=a}else e.startsWith("true",n)?(o.push(g("true",S.r,S.g,S.b)),n+=4):e.startsWith("false",n)?(o.push(g("false",S.r,S.g,S.b)),n+=5):e.startsWith("null",n)?(o.push(g("null",S.r,S.g,S.b)),n+=4):(o.push(g(e[n],C.r,C.g,C.b)),n++);return o}function H(e){const o=[];if(e.trimStart().startsWith("#"))return o.push(g(e,T.r,T.g,T.b)),o;let n=0;for(;n<e.length;){if(e[n]===" "||e[n]==="	"){let r=n;for(;r<e.length&&(e[r]===" "||e[r]==="	");)r++;o.push(g(e.slice(n,r),C.r,C.g,C.b)),n=r;continue}if(e[n]==="\\"){o.push(g("\\",T.r,T.g,T.b)),n++;continue}if(e[n]==="'"){let r=n+1;for(;r<e.length&&e[r]!=="'";)r++;o.push(g(e.slice(n,r+1),F.r,F.g,F.b)),n=r+1;continue}if(e[n]==='"'){let r=n+1;for(;r<e.length&&(e[r]!=='"'||e[r-1]==="\\");)r++;o.push(g(e.slice(n,r+1),F.r,F.g,F.b)),n=r+1;continue}if(e[n]==="-"){let r=n;for(;r<e.length&&e[r]!==" "&&e[r]!=="	"&&e[r]!=="'"&&e[r]!=='"';)r++;o.push(g(e.slice(n,r),T.r,T.g,T.b)),n=r;continue}let a=n;for(;a<e.length&&e[a]!==" "&&e[a]!=="	"&&e[a]!=="'"&&e[a]!=='"'&&e[a]!=="\\";)a++;const t=e.slice(n,a),i=["POST","GET","DELETE","PUT","PATCH"].includes(t)?L:t==="curl"||t.startsWith("http")?D:E;o.push(g(t,i.r,i.g,i.b)),n=a}return o}function W(e,o){const n=e.split(`
`);return o==="json"?n.map(B):o==="bash"?n.map(H):n.map(a=>[g(a,E.r,E.g,E.b)])}function Y(e,o,n,a,t){let l=n;for(const i of o){if(!i.t||l>=t)break;e.setTextColor(i.r,i.g,i.b);const r=e.getTextWidth(i.t);if(l+r>t){const c=Math.floor((t-l)/(r/i.t.length));c>0&&e.text(i.t.slice(0,c),l,a);break}e.text(i.t,l,a),l+=r}}function u(e,o,n,a=""){const l={json:"json",javascript:"Node.js",http:"HTTP",bash:"curl",php:"PHP",python:"Python"}[a]??a,i=o.split(`
`),r=4.8,c=4,_=5,O=l?7:0,X=i.length*r+c*2+O;if(n=A(e,n,Math.min(X+4,60)),l){v(e,[28,33,40]),e.rect(s,n,f,O,"F"),e.setFont("courier","normal"),e.setFontSize(7.5);const M=e.getTextWidth(l)+4;v(e,[45,51,59]),e.rect(s+_-1,n+1.2,M,4.5,"F"),e.setTextColor(205,217,229),e.text(l,s+_+1,n+4.8),n+=O}v(e,[22,27,34]),e.rect(s,n,f,i.length*r+c*2,"F"),e.setFont("courier","normal"),e.setFontSize(8);const U=W(o,a);let q=n+c+r*.7;for(let M=0;M<i.length;M++)q>b-20&&(e.addPage(),v(e,[22,27,34]),e.rect(s,15,f,(i.length-M)*r+c*2,"F"),q=22),Y(e,U[M]??[],s+_,q,s+f-2),q+=r;return q+c+4}function P(e,o,n,a,t){const l=t??Array(o.length).fill(f/o.length),i=7,r=3;a=A(e,a,30),v(e,h.navy),e.rect(s,a,f,i,"F"),e.setFont("helvetica","bold"),e.setFontSize(8),m(e,h.white);let c=s;for(let _=0;_<o.length;_++)e.text(o[_],c+r,a+i*.65),c+=l[_];a+=i,e.setFont("helvetica","normal"),e.setFontSize(8);for(let _=0;_<n.length;_++){a=A(e,a,i+2),_%2===1&&(v(e,h.sectionBg),e.rect(s,a,f,i,"F")),c=s;for(let O=0;O<n[_].length;O++)m(e,h.body),e.text(String(n[_][O]).slice(0,60),c+r,a+i*.65),c+=l[O];a+=i}return R(e,[203,213,225]),e.line(s,a,s+f,a),a+6}function x(e,o,n,a){const t={info:[[219,234,254],[37,99,235]],warn:[[254,243,199],[217,119,6]],tip:[[220,252,231],[21,128,61]]},[l,i]=t[o],r=e.splitTextToSize(n,f-12),c=r.length*5.2+8;return a=A(e,a,c+6),v(e,l),e.rect(s,a,f,c,"F"),v(e,i),e.rect(s,a,3,c,"F"),e.setFont("helvetica","normal"),e.setFontSize(8.5),m(e,[30,41,59]),e.text(r,s+7,a+5.5),a+c+6}function j(e,o,n,a){const t=b-10;R(e,[203,213,225]),e.line(s,t-3,s+f,t-3),e.setFont("helvetica","normal"),e.setFontSize(7.5),m(e,h.muted),e.text(a,s,t),e.text(`Page ${o} / ${n}`,s+f,t,{align:"right"})}function $(){const e=new I({orientation:"portrait",unit:"mm",format:"a4"});v(e,h.cover),e.rect(0,0,z,b,"F"),v(e,h.gold),e.rect(0,0,6,b,"F"),e.setFont("helvetica","bold"),e.setFontSize(28),m(e,h.gold),e.text("Ashtech Pay",s+6,70),e.setFont("helvetica","normal"),e.setFontSize(14),m(e,[148,163,184]),e.text("Hosted Payment Page",s+6,82),e.setFont("helvetica","bold"),e.setFontSize(10),m(e,h.white),e.text("v1  •  API Documentation",s+6,93),v(e,h.gold),e.rect(s+6,99,40,.8,"F"),e.setFont("helvetica","normal"),e.setFontSize(10),m(e,[148,163,184]),e.text(e.splitTextToSize("Créez des liens de paiement hébergés et acceptez des paiements Mobile Money dans le catalogue actif exposé par l'API, sans gérer vous-même la page de paiement.",f-6),s+6,108);const n=[["Endpoint principal","POST /api/v1/hosted-payment/create"],["Authentification","Bearer hp_live_xxxxxxxx"],["Base URL","https://ashtechpay.top"],["Version","v1 — Mai 2026"]];let a=140;for(const[c,_]of n)v(e,[22,27,34]),e.rect(s+6,a,f-6,10,"F"),e.setFont("helvetica","bold"),e.setFontSize(7.5),m(e,[100,116,139]),e.text(c.toUpperCase(),s+10,a+4),e.setFont("courier","normal"),e.setFontSize(9),m(e,h.gold),e.text(_,s+10,a+8.2),a+=13;e.setFont("helvetica","normal"),e.setFontSize(8),m(e,[71,85,105]),e.text("ashtechpay.top  •  support@ashtechpay.top",s+6,b-18),e.addPage();let t=22;e.setFont("helvetica","bold"),e.setFontSize(13),m(e,h.navy),e.text("Sommaire",s,t),t+=8,R(e,[203,213,225]),e.line(s,t,s+f,t),t+=6;const l=["1.  Les 3 clés API (pk_live_ · sk_live_ · hp_live_)","2.  Créer un lien de paiement   POST /api/v1/hosted-payment/create","3.  Prix fixe — montant défini à l'avance","4.  Prix libre — le client choisit le montant","5.  Filtrer les pays affichés (22 pays disponibles)","6.  Vérifier le statut   GET /api/v1/hosted-payment/:payment_id","7.  Créditement automatique du wallet","8.  Webhook — notification automatique (notify_url)","9.  Exemples de code   (Node.js · PHP · cURL)"];e.setFont("helvetica","normal"),e.setFontSize(9.5),m(e,h.body);for(const c of l)e.text(c,s+3,t),t+=6.5;t+=8,t=y(e,"1. Les 3 clés API",t),t=d(e,"En generant tes cles dans l'onglet Hosted Page, tu obtiens 3 cles distinctes :",t),t+=4,t=P(e,["Cle","Prefixe","Role","Ou l'utiliser"],[["Public Key","pk_live_","Identification publique","Frontend JS — identifie ton compte cote client"],["Secret Key","sk_live_","Operations sensibles","Backend uniquement — webhooks, remboursements"],["Hosted Page Key","hp_live_","Liens de paiement heberges","Backend — creer des liens via API"]],t,[30,26,35,79]),t=x(e,"warn","Securite — sk_live_ et hp_live_ doivent rester dans des variables d'environnement cote serveur. Ne les publie jamais dans du code frontend ni dans un depot Git public.",t),t=y(e,"2. Creer un lien de paiement",t),t=p(e,"POST /api/v1/hosted-payment/create",t),t=d(e,"Cree un lien de paiement heberge unique. Le client est redirige vers une page Ashtech Pay securisee pour finaliser le paiement Mobile Money.",t),t+=3,t=p(e,"En-tetes requis",t),t=u(e,`Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`,t,"http"),t=p(e,"Corps de la requete (JSON)",t),t=P(e,["Parametre","Type","Statut","Description"],[["currency","string","Requis","Devise : XOF, XAF, CDF…"],["amount","number","Optionnel","Montant fixe. Obligatoire si is_fixed_amount est true"],["description","string?","Optionnel","Titre affiche sur la page de paiement"],["is_fixed_amount","boolean?","Optionnel","true (defaut) = prix fixe. false = client saisit le montant"],["allowed_countries","string[]?","Optionnel",'Codes ISO des pays a afficher. Ex: ["CM","SN"]. Vide = tous'],["notify_url","string?","Optionnel","Surcharge la Webhook URL configuree pour ce lien specifique"]],t,[35,24,24,87]),t=d(e,"* champ obligatoire",t),t+=3,t=p(e,"Reponse 200 (succes)",t),t=u(e,`{
  "status":       "success",
  "payment_link": "https://ashtechpay.top/pay/hp-ab12cd34",
  "payment_id":   "uuid-du-lien",
  "slug":         "hp-ab12cd34",
  "is_fixed_amount": true,
  "amount":       5000,
  "currency":     "XAF",
  "allowed_countries": null,
  "expires_at":   "2026-03-15T15:30:00.000Z"
}`,t,"json"),t=y(e,"3. Prix fixe — tu definis le montant",t),t=d(e,"Le montant est defini a la creation. Le client voit le montant sur la page et ne peut pas le modifier. Ideal pour les produits, abonnements, factures.",t),t+=3,t=u(e,`fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "XAF",
    amount: 5000,
    description: "Abonnement mensuel",
    is_fixed_amount: true,
    // notify_url definie dans vos parametres — recuperee automatiquement
  }),
})`,t,"javascript"),t=y(e,"4. Prix libre — le client choisit le montant",t),t=d(e,"La page de paiement affiche un champ de saisie pour le montant. Le client entre ce qu'il veut payer. Ideal pour les dons, pourboires, paiements a montant variable.",t),t+=3,t=u(e,`fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "XOF",
    description: "Don libre",
    is_fixed_amount: false,   // <- le client saisit son montant
    // pas besoin de "amount"
  }),
})`,t,"javascript"),t=x(e,"info","En mode prix libre, le montant reel paye par le client est disponible dans GET /api/v1/hosted-payment/:payment_id une fois le statut passe a success, dans le champ amount.",t),t=y(e,"5. Filtrer les pays affiches",t),t=d(e,"Par defaut, tous les pays actifs sont disponibles. Tu peux restreindre a un sous-ensemble en passant leurs codes ISO dans allowed_countries.",t),t+=3,t=u(e,`body: JSON.stringify({
  currency: "XAF",
  amount: 10000,
  description: "Achat produit",
  allowed_countries: ["CM", "SN"],  // uniquement Cameroun + Senegal
})`,t,"javascript"),t+=2,t=P(e,["Code ISO","Pays","Wallet credite","Operateurs"],[["CM","Cameroun","XAF","MTN Money, Orange Money"],["SN","Senegal","XOFS","E-money, Free Money, Orange Money, Wave Money"],["CI","Cote d'Ivoire","XOFC","Moov Money, MTN Money, Orange Money, Wave Money"],["BJ","Benin","XOFB","Celtiis Money, Coris Money, Moov Money, MTN Money"],["BF","Burkina Faso","XOFF","Moov Money, Orange Money, Wallet LigdiCash"],["ML","Mali","XOFM","Orange, Moov"],["TG","Togo","XOFT","Flooz (Moov), T-Money"],["NE","Niger","XOFN","Airtel Money"],["CD","Congo RDC","CDF","Afri Money, Airtel Money, Mpesa Money, Orange Money, Vodacom"],["GA","Gabon","XAFG","Airtel Money, Moov Money"]],t,[18,36,28,88]),t=x(e,"info","Si allowed_countries est absent ou vide, tous les pays actifs sont disponibles. L'administrateur controle quels pays et operateurs sont actifs — tout changement s'applique automatiquement sans modifier votre code.",t),t=y(e,"6. Verifier le statut d'un paiement",t),t=p(e,"GET /api/v1/hosted-payment/:payment_id",t),t=u(e,`{
  "payment_id":      "uuid-du-lien",
  "slug":            "hp-ab12cd34",
  "is_fixed_amount": true,
  "amount":          5000,
  "currency":        "XAF",
  "description":     "Abonnement Premium",
  "allowed_countries": ["CM"],
  "status":          "success",
  "paid_at":         "2026-03-15T15:12:34.000Z",
  "created_at":      "2026-03-15T15:00:00.000Z",
  "expires_at":      "2026-03-15T15:30:00.000Z"
}`,t,"json"),t=P(e,["Statut","Signification","Action"],[["pending","Lien cree — le client n'a pas encore paye","Continuer a poller (toutes les 5s)"],["processing","Le client a initie le paiement","Continuer a poller"],["success","Paiement confirme — wallet credite","Livrer le produit / service"],["failed","Paiement echoue ou refuse","Notifier le client"],["expired","30 min depassees sans paiement","Creer un nouveau lien"]],t,[28,72,70]),t=x(e,"warn",`Important — Ne livre jamais avant d'avoir verifie status === "success". Le statut processing signifie que le paiement est initie mais pas encore confirme par l'operateur.`,t),t=y(e,"7. Creditement automatique du wallet",t),t=d(e,"Des que l'operateur Mobile Money confirme le paiement, Ashtech Pay credite automatiquement ton wallet marchand dans la devise du pays du client. Aucune action requise.",t),t+=4,t=p(e,"Etapes du creditement",t);const i=["1. Le client confirme le paiement sur son telephone (USSD / OTP / Wave)","2. L'operateur Mobile Money notifie Ashtech Pay","3. La transaction est enregistree comme completed","4. Ton wallet marchand est credite dans la devise du pays (frais deduits)","5. Le statut passe a success — tu peux livrer"];for(const c of i)t=d(e,c,t,3),t+=1;t+=4,t=p(e,"Wallet credite par pays",t),t=P(e,["Pays du client","Wallet marchand credite"],[["Benin","XOFB"],["Senegal","XOFS"],["Cote d'Ivoire","XOFC"],["Burkina Faso","XOFF"],["Mali","XOFM"],["Togo","XOFT"],["Niger","XOFN"],["Cameroun","XAF"],["Gabon","XAFG"],["Congo RDC","CDF"]],t,[100,70]),t=x(e,"info","Chaque pays credite un wallet separe dans ta balance. Tu peux ensuite convertir ces wallets en XOF, XAF ou toute autre devise depuis ton tableau de bord → Wallets.",t),t=y(e,"8. Webhook — notification automatique",t),t=d(e,"Configure ta Webhook URL une seule fois dans tes parametres API Keys. Ashtech Pay la recupere automatiquement a chaque paiement Hosted Page.",t),t+=2,t=x(e,"info","Tu peux aussi passer un notify_url specifique lors de la creation d'un lien — il remplacera l'URL configuree par defaut pour ce lien uniquement. Le webhook est envoye depuis nos serveurs vers ton serveur — l'URL doit etre publiquement accessible (pas localhost).",t),t=p(e,"Payload recu (POST -> votre serveur)",t),t=u(e,`{
  "event":          "payment.completed",  // ou "payment.failed"
  "transaction_id": "uuid-de-la-txn",
  "reference":      "ASHPAY-DEP-XXXXXXXXXX",
  "status":         "completed",
  "amount":         4750,     // montant net credite sur ton wallet (frais deduits)
  "total_amount":   5000,     // montant brut paye par le client
  "currency":       "XAF",
  "type":           "deposit",
  "phone":          "656123456",
  "timestamp":      "2026-03-16T03:00:00.000Z"
}`,t,"json"),t=p(e,"Exemple de recepteur webhook (Node.js / Express)",t),t=u(e,`app.post("/webhooks/ashtechpay", express.json(), (req, res) => {
  // Toujours repondre 200 d'abord, traiter ensuite
  res.sendStatus(200);

  const { event, transaction_id, reference, amount, total_amount, currency } = req.body;

  if (event === "payment.completed") {
    // amount      = montant net credite sur votre wallet (apres frais)
    // total_amount = montant brut paye par le client
    console.log(\`Paiement recu : \${amount} \${currency}\`);
    // crediter le compte client, livrer la commande...
  }

  if (event === "payment.failed") {
    console.log(\`Paiement echoue | ref: \${reference}\`);
    // annuler la commande, notifier le client...
  }
});`,t,"javascript"),t=x(e,"warn","Reponds toujours HTTP 200 immediatement — meme si une erreur survient cote serveur. Si ton serveur repond autre chose, le webhook ne sera pas renvoye.",t),t=y(e,"9. Exemples de code",t),t=p(e,"Node.js — creer et surveiller un lien de paiement",t),t=u(e,`const HP_KEY = process.env.HP_LIVE_KEY;

// Creer un lien de paiement
async function createLink({ amount, currency, description, countries }) {
  const res = await fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${HP_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currency, amount, description,
      is_fixed_amount: !!amount,
      allowed_countries: countries ?? null,
    }),
  });
  return res.json();
  // { payment_link, payment_id, expires_at, ... }
}

// Verifier le statut
async function checkStatus(paymentId) {
  const res = await fetch(
    \`https://ashtechpay.top/api/v1/hosted-payment/\${paymentId}\`,
    { headers: { "Authorization": \`Bearer \${HP_KEY}\` } }
  );
  return res.json();
}

// Polling toutes les 5 secondes
const link = await createLink({ amount: 5000, currency: "XAF", description: "Commande #123" });
const interval = setInterval(async () => {
  const { status } = await checkStatus(link.payment_id);
  if (status === "success") {
    clearInterval(interval);
    console.log("Paiement confirme — livrer le produit");
  } else if (status === "failed" || status === "expired") {
    clearInterval(interval);
    console.log("Paiement non abouti :", status);
  }
}, 5000);`,t,"javascript"),t=p(e,"PHP",t),t=u(e,`<?php
$hpKey = getenv("HP_LIVE_KEY");

function createPaymentLink($currency, $amount, $description, $countries = null) {
  global $hpKey;
  $payload = array_filter([
    "currency"          => $currency,
    "amount"            => $amount,
    "description"       => $description,
    "is_fixed_amount"   => !empty($amount),
    "allowed_countries" => $countries,
  ]);
  $ch = curl_init("https://ashtechpay.top/api/v1/hosted-payment/create");
  curl_setopt_array($ch, [
    CURLOPT_POST            => true,
    CURLOPT_RETURNTRANSFER  => true,
    CURLOPT_HTTPHEADER      => [
      "Authorization: Bearer $hpKey",
      "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
  ]);
  $result = json_decode(curl_exec($ch), true);
  curl_close($ch);
  return $result;
}

$link = createPaymentLink("XAF", 10000, "Facture #456", ["CM"]);
header("Location: " . $link["payment_link"]);`,t,"php"),t=p(e,"cURL",t),t=u(e,`# Prix fixe — Cameroun uniquement
curl -X POST https://ashtechpay.top/api/v1/hosted-payment/create \\
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"currency":"XAF","amount":5000,"description":"Commande","allowed_countries":["CM"]}'

# Prix libre — tous les pays
curl -X POST https://ashtechpay.top/api/v1/hosted-payment/create \\
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"currency":"XOF","description":"Don","is_fixed_amount":false}'

# Verifier le statut
curl https://ashtechpay.top/api/v1/hosted-payment/UUID_DU_LIEN \\
  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"`,t,"bash");const r=e.getNumberOfPages();for(let c=1;c<=r;c++)e.setPage(c),c>1&&j(e,c-1,r-1,"Ashtech Pay — Documentation Hosted Payment Page v1");e.save("AshtechPay_HostedPage_API_v1.pdf")}function G(){const e=new I({orientation:"portrait",unit:"mm",format:"a4"});v(e,h.cover),e.rect(0,0,z,b,"F"),v(e,h.gold),e.rect(0,0,6,b,"F"),e.setFont("helvetica","bold"),e.setFontSize(28),m(e,h.gold),e.text("Ashtech Pay",s+6,70),e.setFont("helvetica","normal"),e.setFontSize(14),m(e,[148,163,184]),e.text("Direct API — SDK Documentation",s+6,82),e.setFont("helvetica","bold"),e.setFontSize(10),m(e,h.white),e.text("v1  •  Mobile Money + Pay-In Crypto — catalogue actif",s+6,93),v(e,h.gold),e.rect(s+6,99,50,.8,"F"),e.setFont("helvetica","normal"),e.setFontSize(10),m(e,[148,163,184]),e.text(e.splitTextToSize("Initiez des paiements Mobile Money directement depuis votre serveur, sans redirection. Gerez les flux USSD Push, OTP USSD, OTP API fournisseur et Wave dans le catalogue actif.",f-6),s+6,108);const n=[["Endpoint collect","POST /v1/collect"],["Authentification","Bearer YOUR_API_KEY"],["Base URL","https://ashtechpay.top"],["Version","v1 — Août 2026"]];let a=140;for(const[r,c]of n)v(e,[22,27,34]),e.rect(s+6,a,f-6,10,"F"),e.setFont("helvetica","bold"),e.setFontSize(7.5),m(e,[100,116,139]),e.text(r.toUpperCase(),s+10,a+4),e.setFont("courier","normal"),e.setFontSize(9),m(e,h.gold),e.text(c,s+10,a+8.2),a+=13;e.setFont("helvetica","normal"),e.setFontSize(8),m(e,[71,85,105]),e.text("ashtechpay.top  •  support@ashtechpay.top",s+6,b-18),e.addPage();let t=22;e.setFont("helvetica","bold"),e.setFontSize(13),m(e,h.navy),e.text("Sommaire",s,t),t+=8,R(e,[203,213,225]),e.line(s,t,s+f,t),t+=6;const l=["1.  Introduction","2.  Authentification","3.  GET /v1/countries — Pays et operateurs","4.  Pay-In Crypto — /v1/crypto/assets + /v1/crypto/collect","5.  POST /v1/collect — Initier un paiement Mobile Money","6.  Flux de paiement   (USSD Push · OTP USSD · OTP API · Wave)","7.  GET /v1/transaction/:id — Statut d'une transaction","8.  GET /v1/fees — Grille tarifaire en temps reel","9.  Webhooks","10. Codes d'erreur"];e.setFont("helvetica","normal"),e.setFontSize(9.5),m(e,h.body);for(const r of l)e.text(r,s+3,t),t+=6.5;t+=8,t=y(e,"1. Introduction",t),t=d(e,"L'Ashtech Pay API unifie plusieurs passerelles de paiement africaines en une seule interface REST. Initiez des paiements Mobile Money dans le catalogue actif sans redirection. Le routage entre les operateurs est automatique — vous n'avez pas a choisir le fournisseur.",t),t+=3,t=P(e,["Caracteristique","Detail"],[["Base URL","https://ashtechpay.top"],["Format","JSON uniquement — Content-Type: application/json"],["Authentification","Bearer token dans l'en-tete Authorization"],["Protocole","HTTPS obligatoire"],["Versioning","Prefixe /v1/ dans tous les endpoints"]],t,[55,115]),t=y(e,"2. Authentification",t),t=d(e,"Toutes les requetes doivent inclure votre cle API dans l'en-tete HTTP Authorization.",t),t+=3,t=u(e,"Authorization: Bearer YOUR_API_KEY",t,"http"),t=x(e,"warn","Utilisez votre cle API uniquement depuis votre serveur (Node.js, Python, PHP…). Ne l'incluez jamais dans du code cote navigateur ou application mobile.",t),t=d(e,"Exemple d'appel authentifie (Node.js) :",t),t=u(e,`const response = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ /* ... */ })
});`,t,"javascript"),t=y(e,"3. Pays et operateurs — GET /v1/countries",t),t=d(e,"Retourne la liste complete des pays actifs et leurs operateurs Mobile Money disponibles. Cette liste est geree par l'administrateur — tout ajout ou retrait de pays/operateur est immediatement visible via cet endpoint.",t),t+=3,t=u(e,`fetch("https://ashtechpay.top/v1/countries", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
})`,t,"javascript"),t=u(e,`curl https://ashtechpay.top/v1/countries \\
  -H "Authorization: Bearer YOUR_API_KEY"`,t,"bash"),t=p(e,"Reponse",t),t=u(e,`[
  {
    "code": "CM",
    "name": "Cameroun",
    "currency": "XAF",
    "operators": ["MTN Money", "Orange Money"]
  },
  {
    "code": "SN",
    "name": "Senegal",
    "currency": "XOF",
    "operators": ["E-money", "Free Money", "Orange Money", "Wave Money"]
  }
  // ...
]`,t,"json"),t=p(e,"Pays disponibles (10)",t),t=P(e,["Pays","Code","Devise","Operateurs"],[["Benin","BJ","XOFB","Celtiis Money, Coris Money, Moov Money, MTN Money"],["Burkina Faso","BF","XOFF","Moov Money, Orange Money (OTP), Wallet LigdiCash"],["Cameroun","CM","XAF","MTN Money, Orange Money"],["Cote d'Ivoire","CI","XOFC","Moov Money, MTN Money, Orange (OTP), Wave Money"],["Gabon","GA","XAFG","Airtel Money, Moov Money"],["Mali","ML","XOFM","Moov Money, Orange Money"],["Niger","NE","XOFN","Airtel Money"],["RD Congo","CD","CDF","Afri Money, Airtel, Mpesa Money, Orange, Vodacom"],["Senegal","SN","XOFS","E-money, Free Money, Orange Money (OTP), Wave Money"],["Togo","TG","XOFT","Flooz (Moov), T-Money"]],t,[38,14,20,98]),t=d(e,"Legende : (OTP USSD) = code a composer pour recevoir l'OTP   •   (OTP API fournisseur) = SMS automatique gere par le fournisseur   •   Wave = lien de paiement Wave",t),t+=4,t=y(e,"4. Pay-In Crypto — /v1/crypto/assets + /v1/crypto/collect",t),t=d(e,"Le Pay-In Crypto utilise la meme cle API ak_… que Mobile Money, mais des endpoints dedies afin de ne modifier aucun contrat existant. Les cryptos utilisent uniquement GET /v1/crypto/assets et POST /v1/crypto/collect ; /v1/collect reste reserve a Mobile Money. Commencez par recuperer les reseaux autorises, puis creez une adresse de depot unique.",t),t=d(e,"GET /v1/crypto/assets retourne uniquement les reseaux crypto actifs et autorises. Utilisez la valeur asset_code retournee dans l'appel de creation.",t),t+=3,t=p(e,"GET /v1/crypto/assets",t),t=u(e,`curl https://ashtechpay.top/v1/crypto/assets \\
  -H "Authorization: Bearer YOUR_API_KEY"`,t,"bash"),t=u(e,`{
  "assets": [
    {
      "asset_code": "USDT.TRC20",
      "coin": "USDT",
      "name": "Tether",
      "network": "TRC20",
      "network_label": "TRON (TRC20)",
      "memo_required": false,
      "memo_type": null,
      "currency": "USDT"
    }
  ]
}`,t,"json"),t=p(e,"POST /v1/crypto/collect",t),t=P(e,["Parametre","Type","Statut","Description"],[["amount","number","Requis","Montant brut dans la devise currency"],["currency","string","Requis","USDT, XAF, XOF, CDF ou USD"],["asset_code","string","Requis","Reseau retourne par /v1/crypto/assets"],["reference","string","Optionnel","Reference de commande du marchand, conservee pour l'idempotence"],["notify_url","string","Optionnel","URL HTTPS du webhook marchand"],["customer","object","Optionnel","firstName, lastName, email"],["refund_address","string","Optionnel","Adresse de remboursement"]],t,[33,22,24,89]),t=u(e,`fetch("https://ashtechpay.top/v1/crypto/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 25,
    currency: "USDT",
    asset_code: "USDT.TRC20",
    reference: "ORDER-CRYPTO-001",
    notify_url: "https://monsite.com/webhook",
    customer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }
  })
})`,t,"javascript"),t=u(e,`{
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-CRYPTO-001",
  "status": "pending",
  "payment_method": "crypto",
  "asset_code": "USDT.TRC20",
  "network": "TRC20",
  "address": "TX…",
  "memo": null,
  "memo_type": null,
  "amount": 25,
  "currency": "USDT",
  "amount_usdt": 25,
  "credited_amount": 24.375,
  "fee_amount": 0.625,
  "credited_amount_usdt": 24.375,
  "fee_amount_usdt": 0.625,
  "fee_percent": 2.5,
  "expires_at": "2026-07-31T19:00:00Z"
}`,t,"json"),t=d(e,"L'API accepte un montant en USDT ou dans une devise fiat supportee (XAF, XOF, CDF ou USD). Les devises fiat sont converties en USDT avec le taux USDT/XAF. amount est le montant brut ; credited_amount_usdt est le net apres frais. Les frais Ashtech Pay et fournisseur sont inclus dans fee_amount_usdt.",t),t=x(e,"info","Affichage du paiement : la reponse 202 renvoie address, memo, memo_type et asset_code, mais pas une image QR. Generez le QR cote marchand avec une bibliotheque QR a partir de address, affichez l'adresse en texte copiable et affichez toujours le memo/tag dans un champ separe lorsqu'il existe. Pour USDT.TRC20, le QR contient l'adresse ; n'inventez pas de format URI pour un memo dont le format n'est pas documente.",t),t=p(e,"Exemple — afficher adresse, memo et QR (Node.js / navigateur)",t),t=u(e,`import QRCode from "qrcode";

async function displayCryptoPayment(data) {
  // data vient de POST /v1/crypto/collect
  document.querySelector("#crypto-address").textContent = data.address;
  document.querySelector("#crypto-network").textContent = data.asset_code;
  document.querySelector("#crypto-amount").textContent = data.amount_usdt + " USDT";

  const memoBox = document.querySelector("#crypto-memo");
  if (data.memo) {
    memoBox.textContent = (data.memo_type || "Memo / tag") + " : " + data.memo;
    memoBox.hidden = false;
  } else {
    memoBox.hidden = true;
  }

  // USDT.TRC20 : QR avec l'adresse uniquement
  await QRCode.toCanvas(
    document.querySelector("#crypto-qr"),
    data.address,
    { width: 240, margin: 2, errorCorrectionLevel: "M" }
  );
}

// HTML : #crypto-amount, #crypto-network, #crypto-address,
//         #crypto-qr (canvas) et #crypto-memo`,t,"javascript"),t=d(e,"Ne concatenez jamais address et memo/tag. Le payeur doit envoyer les fonds sur address avec le memo ou tag exactement tel qu'affiche. Un memo obligatoire oublie peut empecher l'attribution du paiement. Gardez transaction_id et reference, puis attendez payment.completed ou payment.failed avant de livrer.",t),t=d(e,"Apres confirmation par le prestataire crypto, Ashtech Pay credite automatiquement le wallet USDT du marchand avec credited_amount_usdt, puis envoie le webhook POST a notify_url. Le marchand ne doit pas crediter son wallet lui-meme. Les evenements sont payment.completed ou payment.failed et le payload crypto ajoute payment_method, asset_code, address et memo.",t),t=p(e,"Erreurs et diagnostic",t),t=d(e,"Une reponse 502 gateway_error signifie que l'adresse n'a pas pu etre generee. Une reponse 502 provider_invalid_response signifie que le service a repondu sans adresse exploitable. Une reponse 500 server_error contient toujours request_id : conservez-le pour le diagnostic ; ce champ est renvoye dans l'erreur et ne doit pas etre envoye dans la requete. Si provider_status est present, il indique le code HTTP renvoye par le service crypto. Une reponse 400 invalid_email indique que customer.email est mal forme ; invalid_notify_url indique que notify_url doit etre une URL HTTPS valide. Ces deux champs restent optionnels.",t),t=y(e,"5. Initier un paiement — POST /v1/collect",t),t=d(e,"Initie un paiement Mobile Money. Le client recoit une demande de validation sur son telephone. Le routage entre fournisseurs est automatique selon le pays et l'operateur. Les frais sont deduits automatiquement — le champ credited_amount est le montant net credite.",t),t+=3,t=p(e,"Corps de la requete (JSON)",t),t=P(e,["Parametre","Type","Statut","Description"],[["amount","number","Requis","Montant brut a collecter"],["currency","string","Requis","Devise du pays (XAF, XOF, CDF…)"],["phone","string","Requis","Numero de telephone du payeur"],["operator","string","Requis","Nom exact de l'operateur (depuis /v1/countries)"],["country_code","string","Requis","Code ISO du pays (CM, SN, CI…)"],["reference","string","Optionnel*","Reference de commande du marchand. La reponse contient aussi la reference AshTech Pay envoyee au fournisseur. *Obligatoire lors du retry OTP."],["otp","string","Optionnel","Code OTP recu par SMS. Doit etre accompagne du champ reference (valeur recue dans le 400)."],["notify_url","string","Optionnel","URL webhook pour recevoir le resultat du paiement"]],t,[35,22,24,89]),t=p(e,"Requete exemple",t),t=u(e,`fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XAF",
    phone: "670000000",
    operator: "MTN Money",
    country_code: "CM",
    reference: "ORDER-001",
    notify_url: "https://monsite.com/webhook"
  })
})`,t,"javascript"),t=u(e,`curl https://ashtechpay.top/v1/collect \\
  -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":5000,"currency":"XAF","phone":"670000000",
       "operator":"MTN Money","country_code":"CM",
       "reference":"ORDER-001",
       "notify_url":"https://monsite.com/webhook"}'`,t,"bash"),t=p(e,"Reponse 202 (succes USSD Push)",t),t=u(e,`{
  "transaction_id": "8f3e1c2d-...",
  "reference":      "ORDER-001",
  "status":         "pending",
  "amount":         5000,
  "credited_amount":4750,
  "fee_amount":     250,
  "currency":       "XAF",
  "operator":       "MTN Money",
  "phone":          "670000000",
  "country_code":   "CM",
  "created_at":     "2026-03-15T14:00:00Z"
}`,t,"json"),t=p(e,"OTP requis — Orange CI/SN/BF (USSD) ou OTP API",t),t=d(e,"Orange CI/SN/BF → OTP USSD : le serveur retourne un ussd_code a afficher au client, qui le compose sur son telephone (l'OTP s'affiche dans le menu, aucun SMS envoye). Le Mali (Orange Money) ne necessite pas d'OTP — flux standard. Pour un operateur configure en OTP API, le fournisseur envoie automatiquement le SMS et ussd_code = null. Dans les deux cas, la reponse 400 contient un champ 'reference' obligatoire pour l'etape 2.",t),t+=2,t=u(e,`// Etape 1 — Requete initiale (sans otp) → reponse 400
{
  "error": "otp_required",
  "message": "OTP requis. Suivez les instructions de l'operateur.",
  "reference": "DEP-A1B2C3D4",   // ← a conserver absolument
  "ussd_code": null               // null=SMS auto | "#144*82#"=USSD a composer
}

// Etape 2 — Retry avec le code reel + reference du 400 → reponse 202
{
  "amount": 5000, "currency": "XOF", "phone": "07XXXXXXXX",
  "operator": "Orange Money", "country_code": "CI",
  "otp": "VOTRE_CODE_OTP",         // code recu ou affiche par l'operateur
  "reference": "DEP-A1B2C3D4",   // ← meme valeur que la reponse 400
  "notify_url": "https://monsite.com/webhook"
}`,t,"json"),t=y(e,"6. Flux de paiement",t),t=d(e,"Selon le pays et l'operateur, l'API utilise automatiquement l'un des 4 flux ci-dessous. Votre code doit gerer chacun differemment car la reponse et les etapes varient.",t),t+=3,t=P(e,["Flux","Operateurs concernes","Reponse initiale","Action requise"],[["USSD Push","MTN, Moov, Airtel, Orange, Free, E-money, T-Money, Flooz, M-Pesa, Afri Money, Vodacom","202 pending","Attendre le webhook. Le client valide sur son telephone."],["OTP USSD","Orange CI (#144*82#), SN (#144*391#), BF (*144*4*6*montant#)",'400 otp_required, reference: "DEP-...", ussd_code: "#144*82#"',"Afficher le code USSD, puis relancer avec otp + reference (valeur recue dans le 400)."],["OTP SMS","Certains operateurs — SMS automatique via le reseau de l'operateur",'400 otp_required, reference: "DEP-...", ussd_code: null',"Le reseau de l'operateur envoie le SMS. Relancer avec otp + reference (valeur recue dans le 400)."],["Wave","Wave CI, Wave SN","202 pending, flow: wave, wave_url: ...","Afficher le wave_url en bouton ou QR code. Le client ouvre Wave."]],t,[25,52,42,51]),t=p(e,"Detection du flux dans votre code",t),t=u(e,`async function collectPayment(params) {
  const res  = await fetch("https://ashtechpay.top/v1/collect", {
    method: "POST",
    headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  const data = await res.json();

  if (res.status === 202 && data.flow === "wave") {
    // Flux Wave : afficher data.wave_url
    return { type: "wave", waveUrl: data.wave_url, transactionId: data.transaction_id };
  }
  if (res.status === 202) {
    // Flux USSD Push : attendre webhook
    return { type: "ussd_push", transactionId: data.transaction_id };
  }
  if (res.status === 400 && data.error === "otp_required") {
    // Stocker data.reference — obligatoire pour le retry OTP
    if (data.ussd_code) {
      // OTP USSD (Orange CI, SN, BF) : afficher le code a composer
      // CI=#144*82#  SN=#144*391#  BF=*144*4*6*montant#
      return { type: "otp_ussd", ussdCode: data.ussd_code, reference: data.reference };
    } else {
      // OTP SMS : SMS automatique via le reseau de l'operateur
      return { type: "otp_sms", reference: data.reference };
    }
  }
  throw new Error(data.message);
}`,t,"javascript"),t=y(e,"7. Statut d'une transaction — GET /v1/transaction/:id",t),t=d(e,"Consultez le statut d'une transaction a tout moment via le transaction_id retourne lors de l'initiation. Vous pouvez utiliser ce endpoint en complement du webhook.",t),t+=3,t=u(e,`fetch("https://ashtechpay.top/v1/transaction/8f3e1c2d-...", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
})`,t,"javascript"),t=u(e,`curl https://ashtechpay.top/v1/transaction/8f3e1c2d-... \\
  -H "Authorization: Bearer YOUR_API_KEY"`,t,"bash"),t=u(e,`{
  "transaction_id":  "8f3e1c2d-...",
  "reference":       "ORDER-001",
  "status":          "success",
  "amount":          5000,
  "credited_amount": 4750,
  "fee_amount":      250,
  "currency":        "XAF",
  "phone":           "670000000",
  "created_at":      "2026-03-15T14:00:00Z",
  "confirmed_at":    "2026-03-15T14:02:17Z"
}`,t,"json"),t=P(e,["Statut","Description","Final ?"],[["pending","En attente de confirmation de l'operateur","Non"],["success","Paiement confirme — compte marchand credite","Oui"],["failed","Paiement refuse, expire ou annule","Oui"]],t,[30,115,25]),t=y(e,"8. Grille tarifaire en temps reel — GET /v1/fees",t),t=d(e,"Retourne la grille tarifaire en vigueur pour chaque pays actif. Les frais sont configures par l'administrateur et peuvent changer a tout moment. Consultez cet endpoint pour calculer le montant net avant d'appeler /v1/collect.",t),t+=3,t=u(e,`fetch("https://ashtechpay.top/v1/fees", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
})`,t,"javascript"),t=u(e,`curl https://ashtechpay.top/v1/fees \\
  -H "Authorization: Bearer YOUR_API_KEY"`,t,"bash"),t=p(e,"Reponse",t),t=u(e,`[
  {
    "country_code": "CM",
    "country_name": "Cameroun",
    "currency": "XAF",
    "deposit_fee_pct": 3.5,
    "withdrawal_fee_pct": 1.5,
    "transfer_fee_pct": 1.0,
    "total_fee_pct": 5.5
  },
  // ...
]`,t,"json"),t=p(e,"Exemple — calculer le montant net avant d'appeler /v1/collect",t),t=u(e,`// Recuperer les frais en cache (une fois au demarrage ou toutes les heures)
const fees = await fetch("https://ashtechpay.top/v1/fees", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
}).then(r => r.json());

// Calculer le montant net credite sur votre compte
function computeNet(grossAmount, countryCode) {
  const fee = fees.find(f => f.country_code === countryCode);
  if (!fee) return grossAmount;
  const feeAmount = Math.round(grossAmount * fee.total_fee_pct / 100);
  return {
    gross: grossAmount,
    fee: feeAmount,
    net: grossAmount - feeAmount,
    fee_pct: fee.total_fee_pct,
  };
}

// Exemple :
console.log(computeNet(10000, "CM"));
// -> { gross: 10000, fee: 550, net: 9450, fee_pct: 5.5 }`,t,"javascript"),t=y(e,"9. Webhooks",t),t=d(e,"Quand une transaction atteint un etat final, Ashtech Pay envoie automatiquement une requete POST a la notify_url passee dans votre appel a /v1/collect. Le champ amount correspond au montant net apres frais, et total_amount au montant brut collecte. Chaque livraison est dedupliquee, signee en HMAC-SHA256 et retentee automatiquement en cas d'echec temporaire.",t),t+=3,t=p(e,"Payload — paiement reussi",t),t=u(e,`{
  "event":              "payment.completed",
  "transaction_id":     "8f3e1c2d-...",
  "reference":          "ORDER-001",
  "status":             "completed",
  "amount":             4750,       // net apres frais
  "total_amount":       5000,       // brut collecte
  "fee_amount":         250,
  "total_fee_amount":   250,
  "currency":            "XAF",
  "type":                "deposit",
  "phone":               "670000000",
  "timestamp":           "2026-03-15T14:02:17.000Z"
}`,t,"json"),t=p(e,"Evenements disponibles",t),t=P(e,["Evenement","Declencheur"],[["payment.completed","Paiement (depot) confirme avec succes"],["payment.failed","Paiement refuse, expire ou annule"],["payout.completed","Retrait ou virement sortant confirme"],["payout.failed","Retrait ou virement echoue"]],t,[55,115]),t=p(e,"Verifier la signature HMAC",t),t=d(e,"Le corps signe doit etre conserve exactement comme recu. Calculez HMAC-SHA256 sur timestamp + '.' + corps brut avec votre secret webhook, puis comparez l'en-tete X-Ashtech-Signature. Utilisez X-Ashtech-Event-Id pour dedupliquer les livraisons.",t),t=u(e,`import crypto from "node:crypto";

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const rawBody = req.body.toString("utf8");
  const timestamp = req.header("X-Ashtech-Timestamp") || "";
  const received = req.header("X-Ashtech-Signature") || "";
  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.ASHTECH_WEBHOOK_SECRET)
    .update(timestamp + "." + rawBody)
    .digest("hex");

  const valid = received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!timestamp || !valid) return res.sendStatus(401);

  const eventId = req.header("X-Ashtech-Event-Id");
  // Ignorez eventId deja traite, puis parsez rawBody et repondez 200.
  const payload = JSON.parse(rawBody);
  return res.status(200).json({ received: true, event: payload.event });
});`,t,"javascript"),t=p(e,"Handler — Node.js / Express",t),t=u(e,`app.post("/webhook", express.json(), async (req, res) => {
  // Toujours repondre 200 en premier
  res.status(200).json({ received: true });

  const { event, transaction_id, reference, amount, currency } = req.body;

  if (event === "payment.completed") {
    // amount = montant net (apres frais)
    await markOrderAsPaid(reference, { transactionId: transaction_id, amount, currency });
  }
  if (event === "payment.failed")   { await cancelOrder(reference); }
  if (event === "payout.completed") { await markPayoutDone(reference, { transactionId: transaction_id }); }
  if (event === "payout.failed")    { await markPayoutFailed(reference); }
});`,t,"javascript"),t=x(e,"info","Bonnes pratiques : Verifiez la signature avant tout traitement. Repondez HTTP 200 immediatement, traitez la logique metier de facon asynchrone et dedupliquez avec X-Ashtech-Event-Id ou transaction_id. Votre notify_url doit etre une URL HTTPS publique (pas localhost).",t),t=y(e,"10. Codes d'erreur",t),t=d(e,"En cas d'erreur, l'API retourne un objet JSON avec les champs error et message.",t),t+=3,t=u(e,`{
  "error":   "bad_request",
  "message": "Champs requis : amount, currency, phone, operator, country_code"
}`,t,"json"),t=P(e,["HTTP","Erreur","Signification"],[["400","bad_request","Parametre manquant ou format invalide"],["400","otp_required","OTP requis — conservez le champ reference de la reponse, obligatoire pour la confirmation"],["400","missing_reference","Confirmation OTP sans le champ reference — utilisez la valeur recue dans la reponse otp_required"],["400","otp_expired","Session OTP expiree (15 min) ou introuvable — relancez sans otp pour initier une nouvelle session"],["401","unauthorized","Cle API manquante, invalide ou revoquee"],["403","forbidden","Cette transaction n'appartient pas a votre compte"],["404","not_found","Transaction introuvable"],["422","unprocessable","Pays, operateur ou reseau crypto non supporte / devise incorrecte"],["422","asset_disabled","Le reseau crypto selectionne n'est plus actif"],["503","crypto_unavailable","Le catalogue ou le service de paiement crypto est indisponible"],["429","rate_limited","Trop de requetes — ralentissez"],["400","invalid_email","customer.email est mal forme"],["400","invalid_notify_url","notify_url doit etre une URL HTTPS valide"],["502","gateway_error","Adresse crypto impossible a generer ; consultez message et provider_status"],["502","provider_invalid_response","Le service crypto a repondu sans adresse exploitable"],["500","server_error","Erreur interne ; conservez request_id pour le diagnostic"]],t,[18,38,114]),t=x(e,"info","Pour toute question technique non resolue par cette documentation, contactez notre equipe via le support integre a l'application.",t);const i=e.getNumberOfPages();for(let r=1;r<=i;r++)e.setPage(r),r>1&&j(e,r-1,i-1,"Ashtech Pay — Documentation API Direct v1");e.save("AshtechPay_API_Direct_v1.pdf")}export{G as a,$ as d};
