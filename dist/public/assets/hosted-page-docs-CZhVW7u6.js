import{j as e}from"./vendor-query-xtullyqD.js";import{bL as N,ag as h,b as g,be as _,a2 as f,R as j,q as k,M as P}from"./vendor-misc-DfAJR8t0.js";import{D as T}from"./dashboard-layout-JhrfySie.js";import{B as p,A as C}from"./index-CFeSaX9x.js";import{d as F}from"./pdf-docs-DsY6CBJv.js";import"./alert-dialog-Ce2hUykV.js";import"./vendor-ui-MWtFJhSW.js";import"./input-CsiD3fwG.js";import"./separator-DkJTPzCJ.js";import"./label-CInSMQWt.js";import"./select-DHjkEEi-.js";import"./badge-CEdkJKei.js";import"./currency-DIXZ3UD2.js";import"./schema-efDKr-5D.js";import"./vendor-form-xs0eN8eW.js";import"./language-switcher-CVE0HLCa.js";import"./popover-CC5PuUTS.js";import"./vendor-charts-D9qxrepS.js";import"./jspdf.es.min-YxDhCPWR.js";function A(s){const a=[];let r=0;for(;r<s.length;)if(s[r]==='"'){let t=r+1;for(;t<s.length;){if(s[t]==="\\"){t+=2;continue}if(s[t]==='"'){t++;break}t++}const x=s.slice(r,t);let n=t;for(;n<s.length&&(s[n]===" "||s[n]==="	");)n++;a.push({t:x,c:s[n]===":"?"#f47067":"#57ab5a"}),r=t}else if(s[r]>="0"&&s[r]<="9"||s[r]==="-"&&r+1<s.length&&s[r+1]>="0"&&s[r+1]<="9"){let t=r+(s[r]==="-"?1:0);for(;t<s.length&&(s[t]>="0"&&s[t]<="9"||s[t]==="."||s[t]==="e"||s[t]==="E");)t++;a.push({t:s.slice(r,t),c:"#6cb6ff"}),r=t}else s.startsWith("true",r)?(a.push({t:"true",c:"#f69d50"}),r+=4):s.startsWith("false",r)?(a.push({t:"false",c:"#f69d50"}),r+=5):s.startsWith("null",r)?(a.push({t:"null",c:"#f69d50"}),r+=4):(a.push({t:s[r],c:"#adbac7"}),r++);return a}function O(s){const a=[];return s.split(`
`).forEach((t,x)=>{if(x>0&&a.push({t:`
`,c:""}),t.trimStart().startsWith("#")){a.push({t,c:"#768390"});return}let n=0;for(;n<t.length;){if(t[n]===" "||t[n]==="	"){let i=n;for(;i<t.length&&(t[i]===" "||t[i]==="	");)i++;a.push({t:t.slice(n,i),c:"#adbac7"}),n=i;continue}if(t[n]==="\\"){a.push({t:"\\",c:"#768390"}),n++;continue}if(t[n]==="'"){let i=n+1;for(;i<t.length&&t[i]!=="'";)i++;a.push({t:t.slice(n,i+1),c:"#57ab5a"}),n=i+1;continue}if(t[n]==='"'){let i=n+1;for(;i<t.length&&(t[i]!=='"'||t[i-1]==="\\");)i++;a.push({t:t.slice(n,i+1),c:"#57ab5a"}),n=i+1;continue}if(t[n]==="-"){let i=n;for(;i<t.length&&t[i]!==" "&&t[i]!=="	"&&t[i]!=="'"&&t[i]!=='"';)i++;a.push({t:t.slice(n,i),c:"#768390"}),n=i;continue}let c=n;for(;c<t.length&&t[c]!==" "&&t[c]!=="	"&&t[c]!=="'"&&t[c]!=='"'&&t[c]!=="\\";)c++;const l=t.slice(n,c),u=["POST","GET","DELETE","PUT","PATCH"].includes(l)?"#f47067":null;a.push({t:l,c:u??(l==="curl"||l.startsWith("http")?"#79c0ff":"#cdd9e5")}),n=c}}),a}function X(s){return s.map((a,r)=>a.c?e.jsx("span",{style:{color:a.c},children:a.t},r):a.t)}function d({code:s,language:a="json"}){const[r,t]=N.useState(!1),{toast:x}=C();function n(){navigator.clipboard.writeText(s.trim()),t(!0),setTimeout(()=>t(!1),2e3),x({title:"Copié !"})}const c={json:"json",javascript:"Node.js",http:"HTTP",bash:"curl",php:"PHP",python:"Python"},l=a==="json"?A(s.trim()):a==="bash"?O(s.trim()):[{t:s.trim(),c:"#cdd9e5"}];return e.jsxs("div",{className:"rounded-xl overflow-hidden border border-[#2d333b] text-sm shadow-sm",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-2.5 bg-[#1c2128] border-b border-[#2d333b]",children:[e.jsx("span",{className:"text-[11px] font-mono font-medium text-[#cdd9e5] bg-[#2d333b] px-2.5 py-1 rounded-md",children:c[a]??a}),e.jsx("button",{onClick:n,className:"flex items-center gap-1.5 text-[#768390] hover:text-[#cdd9e5] transition-colors text-xs",children:r?e.jsxs(e.Fragment,{children:[e.jsx(k,{className:"h-3.5 w-3.5 text-emerald-400"}),e.jsx("span",{children:"Copié"})]}):e.jsxs(e.Fragment,{children:[e.jsx(P,{className:"h-3.5 w-3.5"}),e.jsx("span",{children:"Copier"})]})})]}),e.jsx("pre",{className:"bg-[#161b22] px-5 py-4 overflow-x-auto leading-relaxed",children:e.jsx("code",{className:"font-mono whitespace-pre text-xs",children:X(l)})})]})}function m({id:s,title:a,children:r}){return e.jsxs("section",{id:s,className:"space-y-4 scroll-mt-8",children:[e.jsx("h2",{className:"text-sm font-semibold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2",children:a}),r]})}function S({m:s}){return e.jsx("span",{className:`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border ${s==="POST"?"border-amber-400 text-amber-600 bg-amber-50":"border-blue-300 text-blue-600 bg-blue-50"}`,children:s})}function o({children:s}){return e.jsx("code",{className:"text-sky-700 bg-sky-50 px-1 py-0.5 rounded text-xs font-mono border border-sky-200",children:s})}function b({method:s,path:a}){return e.jsxs("div",{className:"flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg",children:[e.jsx(S,{m:s}),e.jsx("code",{className:"text-xs font-mono text-gray-800",children:a})]})}function L({rows:s}){return e.jsx("div",{className:"rounded-lg border border-gray-200 overflow-hidden text-xs",children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"bg-gray-50 border-b border-gray-200",children:[e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Champ"}),e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Type"}),e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Description"})]})}),e.jsx("tbody",{className:"bg-white",children:s.map(a=>e.jsxs("tr",{className:"border-t border-gray-100",children:[e.jsxs("td",{className:"px-3 py-2.5",children:[e.jsx("span",{className:"font-mono text-sky-700",children:a.name}),a.required&&e.jsx("span",{className:"ml-1 text-amber-600 font-bold",children:"*"})]}),e.jsx("td",{className:"px-3 py-2.5 font-mono text-gray-500",children:a.type}),e.jsx("td",{className:"px-3 py-2.5 text-gray-600",children:a.desc})]},a.name))})]})})}function E({rows:s}){const a={pending:"text-gray-500",processing:"text-sky-700",success:"text-emerald-700",failed:"text-rose-600",expired:"text-gray-400"};return e.jsx("div",{className:"rounded-lg border border-gray-200 overflow-hidden text-xs",children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"bg-gray-50 border-b border-gray-200",children:[e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Statut"}),e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Signification"}),e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Action"})]})}),e.jsx("tbody",{className:"bg-white",children:s.map(({s:r,desc:t,action:x})=>e.jsxs("tr",{className:"border-t border-gray-100",children:[e.jsx("td",{className:`px-3 py-2.5 font-mono ${a[r]??"text-gray-500"}`,children:r}),e.jsx("td",{className:"px-3 py-2.5 text-gray-600",children:t}),e.jsx("td",{className:"px-3 py-2.5 text-gray-500",children:x})]},r))})]})})}function y({type:s="info",children:a}){const r={info:"border-sky-200 bg-sky-50 text-sky-800",warn:"border-amber-200 bg-amber-50 text-amber-800"};return e.jsx("div",{className:`rounded-lg border px-4 py-3 text-xs leading-relaxed ${r[s]}`,children:a})}const $=[{id:"keys",label:"Les 3 clés API"},{id:"create",label:"Créer un lien"},{id:"prix-fixe",label:"Prix fixe"},{id:"prix-libre",label:"Prix libre"},{id:"pays",label:"Filtrer les pays"},{id:"status",label:"Vérifier le statut"},{id:"credit",label:"Créditement wallet"},{id:"webhook",label:"Webhook (notify_url)"},{id:"examples",label:"Exemples de code"}];function se({publicMode:s=!1}){const a=s?"/":"/dashboard/api-keys",r=s?"Accueil":"Retour aux clés API",[t,x]=N.useState(!1);function n(){x(!0),setTimeout(()=>{F(),x(!1)},50)}const c=e.jsxs("div",{className:"w-full max-w-5xl min-w-0",children:[e.jsxs("div",{className:"mb-8",children:[e.jsx(h,{href:a,children:e.jsxs(p,{variant:"ghost",size:"sm",className:"gap-2 -ml-2 text-gray-500 hover:text-gray-900 mb-4","data-testid":"back-to-config",children:[e.jsx(g,{className:"h-4 w-4"})," ",r]})}),e.jsxs("div",{className:"flex items-start justify-between gap-4 flex-wrap",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(_,{className:"h-5 w-5 text-gray-500"}),e.jsx("h1",{className:"text-xl font-semibold text-gray-900",children:"Hosted Payment Page"}),e.jsx("span",{className:"text-xs font-mono text-gray-500 border border-gray-300 px-1.5 py-0.5 rounded",children:"v1.0"})]}),e.jsx("p",{className:"text-sm text-gray-500 mt-1",children:"Intègre le checkout Ashtech Pay dans ton application via API REST. 22+ pays, Mobile Money."})]}),e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[e.jsx(h,{href:"/docs/test-pay",children:e.jsxs(p,{size:"sm",className:"gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 hover:border-primary/50 shrink-0","data-testid":"link-test-api-hp",children:[e.jsx(f,{className:"h-3.5 w-3.5"}),"Tester l'API"]})}),e.jsxs(p,{variant:"outline",size:"sm",onClick:n,disabled:t,className:"gap-2 border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 shrink-0","data-testid":"button-download-pdf-hosted",children:[e.jsx(j,{className:"h-3.5 w-3.5"}),t?"Génération…":"Télécharger PDF"]})]})]}),e.jsxs("div",{className:"flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 mt-4",children:[e.jsxs("div",{className:"space-y-0.5",children:[e.jsx("p",{className:"text-sm font-semibold text-gray-900",children:"Testez l'intégration en direct"}),e.jsx("p",{className:"text-xs text-gray-600",children:"Générez un vrai lien de paiement Hosted Page depuis notre sandbox interactif — aucun code requis."})]}),e.jsx(h,{href:"/docs/test-pay",children:e.jsxs(p,{size:"sm",className:"gap-2 shrink-0 whitespace-nowrap","data-testid":"cta-test-hp",children:[e.jsx(f,{className:"h-3.5 w-3.5"}),"Ouvrir le sandbox"]})})]})]}),e.jsxs("div",{className:"flex gap-8",children:[e.jsx("aside",{className:"hidden lg:block w-44 shrink-0",children:e.jsxs("div",{className:"sticky top-6",children:[e.jsx("p",{className:"text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2",children:"Sur cette page"}),e.jsx("div",{className:"space-y-0.5",children:$.map(l=>e.jsx("a",{href:`#${l.id}`,className:"block text-xs text-gray-500 hover:text-gray-900 transition-colors py-1 pl-3 border-l border-gray-200 hover:border-gray-400",children:l.label},l.id))})]})}),e.jsxs("div",{className:"flex-1 min-w-0 space-y-12",children:[e.jsxs(m,{id:"keys",title:"Les 3 clés API",children:[e.jsxs("p",{className:"text-sm text-gray-600",children:["En générant tes clés dans l'onglet ",e.jsx(o,{children:"Hosted Page"}),", tu obtiens 3 clés distinctes."]}),e.jsx("div",{className:"rounded-lg border border-gray-200 overflow-hidden text-xs bg-white",children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"bg-gray-50 border-b border-gray-200",children:[e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Clé"}),e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Rôle"}),e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Où l'utiliser"})]})}),e.jsxs("tbody",{children:[e.jsxs("tr",{className:"border-t border-gray-100",children:[e.jsx("td",{className:"px-3 py-3 font-mono text-sky-700",children:"pk_live_"}),e.jsx("td",{className:"px-3 py-3 text-gray-700",children:"Public Key"}),e.jsx("td",{className:"px-3 py-3 text-gray-500",children:"Frontend JS — identifie ton compte côté client"})]}),e.jsxs("tr",{className:"border-t border-gray-100",children:[e.jsx("td",{className:"px-3 py-3 font-mono text-sky-700",children:"sk_live_"}),e.jsx("td",{className:"px-3 py-3 text-gray-700",children:"Secret Key"}),e.jsx("td",{className:"px-3 py-3 text-gray-500",children:"Backend uniquement — webhooks, remboursements"})]}),e.jsxs("tr",{className:"border-t border-gray-100 bg-sky-50",children:[e.jsx("td",{className:"px-3 py-3 font-mono text-sky-700",children:"hp_live_"}),e.jsx("td",{className:"px-3 py-3 text-gray-900 font-medium",children:"Hosted Page Key ★"}),e.jsx("td",{className:"px-3 py-3 text-gray-600",children:"Backend — créer des liens de paiement via API"})]})]})]})}),e.jsxs(y,{type:"warn",children:[e.jsx("strong",{className:"text-amber-800",children:"Sécurité"})," — ",e.jsx(o,{children:"sk_live_"})," et ",e.jsx(o,{children:"hp_live_"})," doivent rester dans des variables d'environnement côté serveur. Ne les publie jamais dans du code frontend ni dans un dépôt Git public."]})]}),e.jsxs(m,{id:"create",title:"Créer un lien de paiement",children:[e.jsx(b,{method:"POST",path:"/api/v1/hosted-payment/create"}),e.jsx(d,{language:"http",code:`Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`}),e.jsx(L,{rows:[{name:"currency",type:"string",required:!0,desc:"XOF · XAF · CDF"},{name:"amount",type:"number",desc:"Montant fixe. Obligatoire si is_fixed_amount est true"},{name:"description",type:"string?",desc:"Titre affiché sur la page de paiement"},{name:"is_fixed_amount",type:"boolean?",desc:"true (défaut) = prix fixe. false = le client saisit le montant"},{name:"allowed_countries",type:"string[]?",desc:'Codes ISO des pays à afficher. Ex: ["CM","SN"]. Vide = tous les pays'},{name:"notify_url",type:"string?",desc:"Optionnel — surcharge la Webhook URL configurée dans vos paramètres pour ce lien spécifique"}]}),e.jsx("p",{className:"text-xs text-gray-500",children:"* champ obligatoire"}),e.jsx("p",{className:"text-xs font-medium text-gray-500 uppercase tracking-wide",children:"Réponse 200"}),e.jsx(d,{language:"json",code:`{
  "status": "success",
  "payment_link": "https://ashtechpay.top/pay/hp-ab12cd34",
  "payment_id": "uuid-du-lien",
  "slug": "hp-ab12cd34",
  "is_fixed_amount": true,
  "amount": 5000,
  "currency": "XAF",
  "allowed_countries": null,
  "expires_at": "2026-03-15T15:30:00.000Z"
}`})]}),e.jsxs(m,{id:"prix-fixe",title:"Prix fixe — tu définis le montant",children:[e.jsx("p",{className:"text-sm text-gray-600",children:"Le montant est défini à la création. Le client voit le montant sur la page et ne peut pas le modifier. Idéal pour les produits, abonnements, factures."}),e.jsx(d,{language:"javascript",code:`fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "XAF",
    amount: 5000,             // montant en unité locale (FCFA, CDF…)
    description: "Abonnement mensuel",
    is_fixed_amount: true,    // défaut — peut être omis
    // notify_url est définie dans vos paramètres — Ashtech Pay la récupère automatiquement
  }),
})`})]}),e.jsxs(m,{id:"prix-libre",title:"Prix libre — le client choisit le montant",children:[e.jsx("p",{className:"text-sm text-gray-600",children:"La page de paiement affiche un champ de saisie pour le montant. Le client entre ce qu'il veut payer. Idéal pour les dons, pourboires, paiements à montant variable."}),e.jsx(d,{language:"javascript",code:`fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    currency: "XOF",
    description: "Don libre",
    is_fixed_amount: false,   // ← le client saisit son montant
    // pas besoin de "amount"
  }),
})`}),e.jsxs(y,{type:"info",children:["En mode prix libre, le montant réel payé par le client est disponible dans ",e.jsx(o,{children:"GET /api/v1/hosted-payment/:payment_id"})," une fois le statut passé à ",e.jsx(o,{children:"success"}),", dans le champ ",e.jsx(o,{children:"amount"}),"."]})]}),e.jsxs(m,{id:"pays",title:"Filtrer les pays affichés",children:[e.jsxs("p",{className:"text-sm text-gray-600",children:["Par défaut, tous les pays actifs sur Ashtech Pay sont disponibles. Tu peux restreindre à un sous-ensemble en passant leurs codes ISO dans ",e.jsx(o,{children:"allowed_countries"}),"."]}),e.jsx(d,{language:"javascript",code:`body: JSON.stringify({
  currency: "XAF",
  amount: 10000,
  description: "Achat produit",
  allowed_countries: ["CM", "SN"],   // uniquement Cameroun + Sénégal
})`}),e.jsx("div",{className:"rounded-lg border border-gray-200 overflow-hidden text-xs bg-white",children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"bg-gray-50 border-b border-gray-200",children:[e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Code ISO"}),e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Pays"}),e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Wallet crédité"}),e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Opérateurs"})]})}),e.jsx("tbody",{children:[{code:"CM",flag:"🇨🇲",pays:"Cameroun",wallet:"XAF",ops:"MTN, Orange"},{code:"SN",flag:"🇸🇳",pays:"Sénégal",wallet:"XOFS",ops:"Orange, Wave, Free"},{code:"CI",flag:"🇨🇮",pays:"Côte d'Ivoire",wallet:"XOFC",ops:"Orange, MTN, Wave"},{code:"BJ",flag:"🇧🇯",pays:"Bénin",wallet:"XOFB",ops:"MTN, Moov"},{code:"BF",flag:"🇧🇫",pays:"Burkina Faso",wallet:"XOFF",ops:"Orange, Moov, Coris"},{code:"ML",flag:"🇲🇱",pays:"Mali",wallet:"XOFM",ops:"Orange, Moov"},{code:"TG",flag:"🇹🇬",pays:"Togo",wallet:"XOFT",ops:"Flooz, Tmoney"},{code:"NE",flag:"🇳🇪",pays:"Niger",wallet:"XOFN",ops:"Orange, Airtel"},{code:"GW",flag:"🇬🇼",pays:"Guinée-Bissau",wallet:"XOF",ops:"MTN"},{code:"CD",flag:"🇨🇩",pays:"Congo RDC",wallet:"CDF",ops:"Airtel, Orange"},{code:"GA",flag:"🇬🇦",pays:"Gabon",wallet:"XAFG",ops:"Airtel, Moov"},{code:"CG",flag:"🇨🇬",pays:"Congo",wallet:"XAFC",ops:"Airtel, MTN"},{code:"CF",flag:"🇨🇫",pays:"Centrafrique",wallet:"XAF",ops:"Orange"},{code:"TD",flag:"🇹🇩",pays:"Tchad",wallet:"XAF",ops:"Airtel, Moov"},{code:"RW",flag:"🇷🇼",pays:"Rwanda",wallet:"RWF",ops:"MTN, Airtel"},{code:"TZ",flag:"🇹🇿",pays:"Tanzanie",wallet:"TZS",ops:"Vodacom, Airtel, Tigo"},{code:"UG",flag:"🇺🇬",pays:"Ouganda",wallet:"UGX",ops:"MTN, Airtel"}].map(({code:l,flag:u,pays:i,wallet:v,ops:w})=>e.jsxs("tr",{className:"border-t border-gray-100",children:[e.jsx("td",{className:"px-3 py-2 font-mono text-sky-700",children:l}),e.jsxs("td",{className:"px-3 py-2 text-gray-700",children:[u," ",i]}),e.jsx("td",{className:"px-3 py-2 font-mono text-sky-700 font-semibold",children:v}),e.jsx("td",{className:"px-3 py-2 text-gray-500",children:w})]},l))})]})}),e.jsxs(y,{type:"info",children:["Si ",e.jsx(o,{children:"allowed_countries"})," est absent ou vide, ",e.jsx("strong",{className:"text-sky-300",children:"tous les pays actifs"})," sont disponibles. L'administrateur contrôle quels pays et opérateurs sont actifs — tout changement s'applique automatiquement sans modification de votre code."]})]}),e.jsxs(m,{id:"status",title:"Vérifier le statut d'un paiement",children:[e.jsx(b,{method:"GET",path:"/api/v1/hosted-payment/:payment_id"}),e.jsx(d,{language:"json",code:`{
  "payment_id": "uuid-du-lien",
  "slug": "hp-ab12cd34",
  "is_fixed_amount": true,
  "amount": 5000,
  "currency": "XAF",
  "description": "Abonnement Premium",
  "allowed_countries": ["CM"],
  "status": "success",
  "paid_at": "2026-03-15T15:12:34.000Z",
  "created_at": "2026-03-15T15:00:00.000Z",
  "expires_at": "2026-03-15T15:30:00.000Z"
}`}),e.jsx(E,{rows:[{s:"pending",desc:"Lien créé, le client n'a pas encore payé",action:"Continuer à poller (toutes les 5s)"},{s:"processing",desc:"Le client a initié le paiement",action:"Continuer à poller"},{s:"success",desc:"Paiement confirmé — wallet crédité",action:"Livrer le produit / service"},{s:"failed",desc:"Paiement échoué ou refusé",action:"Notifier le client"},{s:"expired",desc:"30 min dépassées sans paiement",action:"Créer un nouveau lien"}]}),e.jsxs(y,{type:"warn",children:[e.jsx("strong",{className:"text-amber-200",children:"Important"})," — Ne livre jamais avant d'avoir vérifié ",e.jsx(o,{children:'status === "success"'}),". Le statut ",e.jsx(o,{children:"processing"})," signifie que le paiement est initié mais pas encore confirmé par l'opérateur."]})]}),e.jsxs(m,{id:"credit",title:"Créditement automatique du wallet",children:[e.jsx("p",{className:"text-sm text-gray-600",children:"Dès que l'opérateur Mobile Money confirme le paiement, Ashtech Pay crédite automatiquement ton wallet marchand dans la devise du pays du client. Aucune action requise de ta part."}),e.jsx("div",{className:"rounded-lg border border-gray-200 bg-white divide-y divide-zinc-800/60 text-xs",children:["Le client confirme le paiement sur son téléphone (USSD / OTP / Wave)","L'opérateur Mobile Money notifie Ashtech Pay","La transaction est enregistrée comme completed","Ton wallet marchand est crédité dans la devise du pays (frais déduits)","Le statut passe à success — tu peux livrer"].map((l,u)=>e.jsxs("div",{className:"flex items-start gap-3 px-4 py-3",children:[e.jsxs("span",{className:"text-zinc-600 font-mono shrink-0",children:[u+1,"."]}),e.jsx("span",{className:"text-zinc-400",children:l})]},u))}),e.jsx("p",{className:"text-xs text-gray-500 font-medium uppercase tracking-wide",children:"Wallet crédité par pays"}),e.jsx("div",{className:"rounded-lg border border-gray-200 overflow-hidden text-xs bg-white",children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"bg-gray-50 border-b border-gray-200",children:[e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Pays du client"}),e.jsx("th",{className:"text-left px-3 py-2 text-gray-500 font-medium",children:"Wallet marchand crédité"})]})}),e.jsx("tbody",{children:[{pays:"🇧🇯 Bénin",wallet:"XOFB"},{pays:"🇸🇳 Sénégal",wallet:"XOFS"},{pays:"🇨🇮 Côte d'Ivoire",wallet:"XOFC"},{pays:"🇧🇫 Burkina Faso",wallet:"XOFF"},{pays:"🇲🇱 Mali",wallet:"XOFM"},{pays:"🇹🇬 Togo",wallet:"XOFT"},{pays:"🇳🇪 Niger",wallet:"XOFN"},{pays:"🇬🇼 Guinée-Bissau",wallet:"XOF"},{pays:"🇨🇲 Cameroun",wallet:"XAF"},{pays:"🇬🇦 Gabon",wallet:"XAFG"},{pays:"🇨🇬 Congo",wallet:"XAFC"},{pays:"🇨🇫 Centrafrique",wallet:"XAF"},{pays:"🇹🇩 Tchad",wallet:"XAF"},{pays:"🇨🇩 Congo RDC",wallet:"CDF"},{pays:"🇷🇼 Rwanda",wallet:"RWF"},{pays:"🇹🇿 Tanzanie",wallet:"TZS"},{pays:"🇺🇬 Ouganda",wallet:"UGX"}].map(({pays:l,wallet:u})=>e.jsxs("tr",{className:"border-t border-gray-100",children:[e.jsx("td",{className:"px-3 py-2.5 text-gray-700",children:l}),e.jsx("td",{className:"px-3 py-2.5 font-mono text-sky-700 font-semibold",children:u})]},l))})]})}),e.jsxs(y,{type:"info",children:["Chaque pays crédite un wallet séparé dans ta balance. Un client béninois → wallet ",e.jsx(o,{children:"XOFB"}),". Un client sénégalais → wallet ",e.jsx(o,{children:"XOFS"}),". Tu peux ensuite convertir ces wallets en ",e.jsx(o,{children:"XOF"}),", ",e.jsx(o,{children:"XAF"})," ou toute autre devise depuis ton tableau de bord."]})]}),e.jsxs(m,{id:"webhook",title:"Webhook — notification automatique",children:[e.jsxs("p",{className:"text-sm text-gray-600",children:["Configure ta ",e.jsx(o,{children:"Webhook URL"})," une seule fois dans tes"," ",e.jsx("strong",{className:"text-zinc-200",children:"paramètres API Keys"}),". Ashtech Pay la récupère automatiquement à chaque paiement Hosted Page — tu n'as pas besoin de la passer dans chaque lien. Une requête ",e.jsx(o,{children:"POST"})," est envoyée dès que le paiement est confirmé ou échoue."]}),e.jsxs(y,{type:"info",children:["Tu peux aussi passer un ",e.jsx(o,{children:"notify_url"})," spécifique lors de la création d'un lien — il remplacera l'URL configurée par défaut pour ce lien uniquement. Le webhook est envoyé ",e.jsx("strong",{className:"text-zinc-200",children:"depuis nos serveurs"})," vers ton serveur — l'URL doit être publiquement accessible (pas localhost)."]}),e.jsx("p",{className:"text-xs font-medium text-gray-500 uppercase tracking-wide",children:"Payload reçu"}),e.jsx(d,{language:"json",code:`{
  "event": "payment.completed",     // ou "payment.failed"
  "transaction_id": "uuid-de-la-txn",
  "reference": "ASHPAY-DEP-XXXXXXXXXXXX",
  "status": "completed",            // ou "failed"
  "amount": 4750,                   // montant net crédité sur ton wallet (frais déduits)
  "total_amount": 5000,             // montant brut payé par le client
  "currency": "XAF",
  "type": "deposit",
  "phone": "656123456",
  "timestamp": "2026-03-16T03:00:00.000Z"
}`}),e.jsx("p",{className:"text-xs font-medium text-gray-500 uppercase tracking-wide",children:"Exemple de récepteur webhook (Node.js / Express)"}),e.jsx(d,{language:"javascript",code:`app.post("/webhooks/ashtechpay", express.json(), (req, res) => {
  // ✅ Toujours répondre 200 d'abord, traiter ensuite
  res.sendStatus(200);

  const { event, transaction_id, reference, amount, total_amount, currency } = req.body;

  if (event === "payment.completed") {
    // Paiement confirmé
    // amount      = montant net crédité sur votre wallet (après frais)
    // total_amount = montant brut payé par le client
    console.log(\`Paiement reçu : \${amount} \${currency} | txn: \${transaction_id}\`);
    // → créditer le compte client, livrer la commande, etc.
  }

  if (event === "payment.failed") {
    // Paiement échoué ou expiré
    console.log(\`Paiement échoué | ref: \${reference}\`);
    // → annuler la commande, notifier le client, etc.
  }
});`}),e.jsxs(y,{type:"warn",children:["Réponds toujours ",e.jsx(o,{children:"HTTP 200"})," immédiatement — même si une erreur survient côté serveur. Si ton serveur répond autre chose, le webhook ne sera pas renvoyé."]})]}),e.jsxs(m,{id:"examples",title:"Exemples de code",children:[e.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide font-medium",children:"Node.js"}),e.jsx(d,{language:"javascript",code:`const HP_KEY = process.env.HP_LIVE_KEY;

// Créer un lien de paiement
async function createLink({ amount, currency, description, countries }) {
  const res = await fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${HP_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currency,
      amount,
      description,
      is_fixed_amount: !!amount,           // false si pas de montant
      allowed_countries: countries ?? null, // null = tous les pays
      // notify_url configurée dans les paramètres — récupérée automatiquement
    }),
  });
  return res.json();
  // { payment_link, payment_id, expires_at, ... }
}

// Vérifier le statut
async function checkStatus(paymentId) {
  const res = await fetch(
    \`https://ashtechpay.top/api/v1/hosted-payment/\${paymentId}\`,
    { headers: { "Authorization": \`Bearer \${HP_KEY}\` } }
  );
  const data = await res.json();
  return data;
  // data.status  = "pending" | "processing" | "success" | "failed" | "expired"
  // data.paid_at = timestamp si success
  // data.amount  = montant réel (utile pour is_fixed_amount: false)
}

// Exemple d'utilisation
const link = await createLink({ amount: 5000, currency: "XAF", description: "Commande #123" });
console.log(link.payment_link); // → https://ashtechpay.top/pay/hp-ab12cd34

// Polling toutes les 5 secondes
const interval = setInterval(async () => {
  const { status } = await checkStatus(link.payment_id);
  if (status === "success") {
    clearInterval(interval);
    console.log("Paiement confirmé — livrer le produit");
  } else if (status === "failed" || status === "expired") {
    clearInterval(interval);
    console.log("Paiement non abouti :", status);
  }
}, 5000);`}),e.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide font-medium",children:"PHP"}),e.jsx(d,{language:"php",code:`<?php
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
header("Location: " . $link["payment_link"]);`}),e.jsx("p",{className:"text-xs text-gray-500 uppercase tracking-wide font-medium",children:"cURL"}),e.jsx(d,{language:"bash",code:`# Prix fixe — Cameroun uniquement
curl -X POST https://ashtechpay.top/api/v1/hosted-payment/create   -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"   -H "Content-Type: application/json"   -d '{"currency":"XAF","amount":5000,"description":"Commande","allowed_countries":["CM"]}'

# Prix libre — tous les pays
curl -X POST https://ashtechpay.top/api/v1/hosted-payment/create   -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"   -H "Content-Type: application/json"   -d '{"currency":"XOF","description":"Don","is_fixed_amount":false}'

# Vérifier le statut
curl https://ashtechpay.top/api/v1/hosted-payment/UUID_DU_LIEN   -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"`})]}),e.jsx("div",{className:"pt-6 border-t border-gray-200",children:e.jsx(h,{href:a,children:e.jsxs(p,{variant:"outline",size:"sm",className:"gap-2 border-zinc-700 text-gray-600 hover:text-zinc-200","data-testid":"button-back-bottom",children:[e.jsx(g,{className:"h-4 w-4"})," ",r]})})})]})]})]});return s?e.jsxs("div",{className:"min-h-screen bg-gray-50 text-gray-900",children:[e.jsx("header",{className:"sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm",children:e.jsxs("div",{className:"max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(h,{href:"/",children:e.jsxs(p,{variant:"ghost",size:"sm",className:"text-gray-500 hover:text-gray-900 -ml-2 gap-1.5","data-testid":"link-back-home",children:[e.jsx(g,{className:"w-4 h-4"}),e.jsx("span",{className:"hidden sm:inline",children:"Accueil"})]})}),e.jsx("div",{className:"h-5 w-px bg-gray-200"}),e.jsx("span",{className:"font-semibold text-sm text-gray-900",children:"Ashtech Pay"}),e.jsx("span",{className:"text-[10px] border border-gray-300 text-gray-500 px-1.5 py-0.5 rounded font-mono hidden sm:inline",children:"Hosted Page v1"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs(p,{variant:"outline",size:"sm",onClick:n,disabled:t,className:"gap-1.5 border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 text-xs","data-testid":"button-download-pdf-hosted-public",children:[e.jsx(j,{className:"w-3.5 h-3.5"}),e.jsx("span",{className:"hidden sm:inline",children:t?"Génération…":"Télécharger PDF"}),e.jsx("span",{className:"sm:hidden",children:t?"…":"PDF"})]}),e.jsxs("div",{className:"hidden sm:flex items-center gap-2",children:[e.jsx(h,{href:"/login",children:e.jsx(p,{variant:"ghost",size:"sm",className:"text-gray-500 hover:text-gray-900 text-xs","data-testid":"link-login",children:"Connexion"})}),e.jsx(h,{href:"/register",children:e.jsx(p,{size:"sm",className:"text-xs","data-testid":"link-register",children:"S'inscrire"})})]})]})]})}),e.jsx("div",{className:"max-w-5xl mx-auto px-4 py-8",children:c})]}):e.jsx(T,{children:c})}export{se as default};
