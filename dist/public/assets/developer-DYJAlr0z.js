import{b as U,j as e}from"./vendor-query-DLaZOl0Z.js";import{bH as v,i as k,aY as F,ai as L,h as z,ba as Y,bu as B,z as X,d as q,bo as $,a1 as A,af as N,b as H,J as K,Q as W,bt as G,at as J,r as E,al as Q,br as V,o as Z,L as ee}from"./vendor-misc-DbhW_PFW.js";import{B as M}from"./badge-CFRWoNha.js";import{B as _}from"./index-DSWynLZ9.js";import{a as te}from"./pdf-docs-DDKpCkTX.js";import"./vendor-ui-BOcTM35N.js";import"./vendor-charts-CS4AcZF2.js";import"./jspdf.es.min-C7i6IG5k.js";const D=[{id:"introduction",label:"Introduction",icon:k},{id:"authentication",label:"Authentification",icon:F},{id:"countries",label:"GET /v1/countries",icon:L},{id:"crypto",label:"Pay-In Crypto",icon:z},{id:"collect",label:"POST /v1/collect",icon:Y},{id:"flows",label:"Flux de paiement",icon:B},{id:"transaction",label:"GET /v1/transaction",icon:X},{id:"fees",label:"GET /v1/fees",icon:q},{id:"webhooks",label:"Webhooks",icon:$},{id:"errors",label:"Codes d'erreur",icon:q},{id:"sandbox",label:"Sandbox & Tests",icon:A}],se=[{code:"BJ",name:"Bénin",currency:"XOF",operators:["Celtiis Money","Coris Money","Moov Money","MTN Money"],otpOps:[]},{code:"BF",name:"Burkina Faso",currency:"XOF",operators:["Moov Money","Orange Money","Wallet LigdiCash"],otpOps:["Orange Money"]},{code:"CM",name:"Cameroun",currency:"XAF",operators:["MTN Money","Orange Money"],otpOps:[]},{code:"CI",name:"Côte d'Ivoire",currency:"XOF",operators:["Moov Money","MTN Money","Orange Money","Wave Money"],otpOps:["Orange Money"]},{code:"GA",name:"Gabon",currency:"XAF",operators:["Airtel Money","Moov Money"],otpOps:[]},{code:"ML",name:"Mali",currency:"XOF",operators:["Moov Money","Orange Money"],otpOps:[]},{code:"NE",name:"Niger",currency:"XOF",operators:["Airtel Money"],otpOps:[]},{code:"CD",name:"RD Congo",currency:"CDF",operators:["Afri Money","Airtel Money","Mpesa Money","Orange Money","Vodacom"],otpOps:[]},{code:"SN",name:"Sénégal",currency:"XOF",operators:["E-money","Free Money","Orange Money","Wave Money"],otpOps:["Orange Money"]},{code:"TG",name:"Togo",currency:"XOF",operators:["Flooz (Moov)","T-Money"],otpOps:[]}];function ae(r){const o=[];let c=0;for(;c<r.length;)if(r[c]==='"'){let a=c+1;for(;a<r.length;){if(r[a]==="\\"){a+=2;continue}if(r[a]==='"'){a++;break}a++}const g=r.slice(c,a);let n=a;for(;n<r.length&&(r[n]===" "||r[n]==="	");)n++;o.push({t:g,c:r[n]===":"?"#f47067":"#57ab5a"}),c=a}else if(r[c]>="0"&&r[c]<="9"||r[c]==="-"&&c+1<r.length&&r[c+1]>="0"&&r[c+1]<="9"){let a=c+(r[c]==="-"?1:0);for(;a<r.length&&(r[a]>="0"&&r[a]<="9"||r[a]==="."||r[a]==="e"||r[a]==="E");)a++;o.push({t:r.slice(c,a),c:"#6cb6ff"}),c=a}else r.startsWith("true",c)?(o.push({t:"true",c:"#f69d50"}),c+=4):r.startsWith("false",c)?(o.push({t:"false",c:"#f69d50"}),c+=5):r.startsWith("null",c)?(o.push({t:"null",c:"#f69d50"}),c+=4):(o.push({t:r[c],c:"#adbac7"}),c++);return o}function re(r){const o=[];return r.split(`
`).forEach((a,g)=>{if(g>0&&o.push({t:`
`,c:""}),a.trimStart().startsWith("#")){o.push({t:a,c:"#768390"});return}let n=0;for(;n<a.length;){if(a[n]===" "||a[n]==="	"){let i=n;for(;i<a.length&&(a[i]===" "||a[i]==="	");)i++;o.push({t:a.slice(n,i),c:"#adbac7"}),n=i;continue}if(a[n]==="\\"){o.push({t:"\\",c:"#768390"}),n++;continue}if(a[n]==="'"){let i=n+1;for(;i<a.length&&a[i]!=="'";)i++;o.push({t:a.slice(n,i+1),c:"#57ab5a"}),n=i+1;continue}if(a[n]==='"'){let i=n+1;for(;i<a.length&&(a[i]!=='"'||a[i-1]==="\\");)i++;o.push({t:a.slice(n,i+1),c:"#57ab5a"}),n=i+1;continue}if(a[n]==="-"){let i=n;for(;i<a.length&&a[i]!==" "&&a[i]!=="	"&&a[i]!=="'"&&a[i]!=='"';)i++;o.push({t:a.slice(n,i),c:"#768390"}),n=i;continue}let p=n;for(;p<a.length&&a[p]!==" "&&a[p]!=="	"&&a[p]!=="'"&&a[p]!=='"'&&a[p]!=="\\";)p++;const d=a.slice(n,p),O=["POST","GET","DELETE","PUT","PATCH"].includes(d)?"#f47067":null;o.push({t:d,c:O??(d==="curl"||d.startsWith("http")?"#79c0ff":"#cdd9e5")}),n=p}}),o}function ne(r){return r.map((o,c)=>o.c?e.jsx("span",{style:{color:o.c},children:o.t},c):o.t)}function l({code:r,language:o="json"}){const[c,a]=v.useState(!1),[g,n]=v.useState(!1);function p(){navigator.clipboard.writeText(r.trim()),a(!0),setTimeout(()=>a(!1),2e3)}const d={json:"json",javascript:"Node.js",http:"HTTP",bash:"curl",php:"PHP",python:"Python"},O=o==="json"?ae(r.trim()):o==="bash"?re(r.trim()):[{t:r.trim(),c:"#cdd9e5"}];return e.jsxs("div",{className:"rounded-lg overflow-hidden border border-[#3a3a3a] w-full min-w-0 max-w-full",children:[e.jsxs("div",{className:"flex items-center justify-between px-3 py-2 bg-[#2b2b2b] border-b border-[#3a3a3a]",children:[e.jsx("span",{className:"text-[11px] font-mono font-medium text-[#d0d0d0] bg-[#3d3d3d] px-2.5 py-0.5 rounded",children:d[o]??o}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:()=>n(i=>!i),title:"Toggle wrap",className:`text-[#888] hover:text-[#ccc] transition-colors ${g?"text-[#ccc]":""}`,"data-testid":"button-wrap-code",children:e.jsx(V,{className:"w-3.5 h-3.5"})}),e.jsx("button",{onClick:p,className:"text-[#888] hover:text-[#ccc] transition-colors","data-testid":"button-copy-code",children:c?e.jsx(Z,{className:"w-3.5 h-3.5 text-emerald-400"}):e.jsx(ee,{className:"w-3.5 h-3.5"})})]})]}),e.jsx("div",{className:"overflow-x-auto w-full max-w-full bg-[#1a1a1a]",children:e.jsx("pre",{className:`px-4 py-3.5 leading-relaxed ${g?"w-full whitespace-pre-wrap break-all":"w-max min-w-full whitespace-pre"}`,children:e.jsx("code",{className:"font-mono text-[13px]",children:ne(O)})})})]})}function T({examples:r}){const[o,c]=v.useState(r[0]?.language??"javascript"),a=r.find(n=>n.language===o)??r[0],g={javascript:"Node.js",python:"Python",bash:"cURL",php:"PHP / Laravel"};return e.jsxs("div",{className:"w-full min-w-0",children:[e.jsx("div",{className:"flex items-center gap-1 overflow-x-auto border-b border-[#3a3a3a] bg-[#2b2b2b] px-2 pt-2",children:r.map(n=>{const p=n.language===a?.language;return e.jsx("button",{type:"button",onClick:()=>c(n.language),className:`shrink-0 rounded-t-md px-3 py-2 text-xs font-medium transition-colors ${p?"bg-[#1a1a1a] text-white":"text-[#a0a0a0] hover:bg-[#3d3d3d] hover:text-white"}`,"aria-selected":p,role:"tab","data-testid":`code-tab-${n.language}`,children:g[n.language]},n.language)})}),a&&e.jsx(l,{language:a.language,code:a.code},a.language)]})}function j({children:r}){return e.jsx("div",{className:"overflow-x-auto w-full border border-gray-300 rounded",children:e.jsx("table",{className:"w-full text-sm min-w-[400px] border-collapse",children:r})})}function f({cols:r}){return e.jsx("thead",{children:e.jsx("tr",{children:r.map(o=>e.jsx("th",{className:"px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-300 whitespace-nowrap",children:o},o))})})}function m({cells:r}){return e.jsx("tr",{className:"border-b border-gray-200 last:border-b-0",children:r.map((o,c)=>e.jsx("td",{className:"px-4 py-3 text-sm text-gray-700 align-top",children:o},c))})}function s({children:r}){return e.jsx("code",{className:"font-mono text-[12px] bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-gray-800",children:r})}function oe({m:r}){const o={POST:"text-[#e07a10] font-bold",GET:"text-[#2b7fd4] font-bold",DELETE:"text-[#dc2626] font-bold"};return e.jsx("span",{className:`font-mono text-sm ${o[r]??"text-gray-700 font-bold"}`,children:r})}function P({method:r,path:o,auth:c=!0}){return e.jsxs("div",{className:"flex items-center gap-3 py-3 border-t border-b border-gray-200 my-4",children:[e.jsx(oe,{m:r}),e.jsx("span",{className:"font-mono text-sm text-gray-800 font-semibold",children:o}),c&&e.jsx(Q,{className:"w-3.5 h-3.5 text-gray-400 ml-auto shrink-0"})]})}function b(){return e.jsxs("div",{className:"mt-4 space-y-1",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:"text-xs font-bold tracking-widest text-gray-700 uppercase",children:"AUTHORIZATION"}),e.jsx("span",{className:"text-xs text-gray-400",children:"Bearer Token"})]}),e.jsx("div",{children:e.jsx("span",{className:"text-xs font-semibold text-gray-700",children:"Token"})})]})}function y({id:r,children:o}){return e.jsx("div",{id:r,className:"border-t border-gray-200 pt-10 scroll-mt-20",children:e.jsx("h2",{className:"text-2xl font-bold text-gray-900 tracking-wide uppercase mb-4",children:o})})}function h({children:r}){return e.jsx("h3",{className:"text-base font-bold text-gray-900 mt-6 mb-2",children:r})}function he({publicMode:r=!1}){const[o,c]=v.useState("introduction"),[a,g]=v.useState(!1),[n,p]=v.useState(!1),d=v.useRef({});function O(){p(!0),setTimeout(()=>{te(),p(!1)},50)}const{data:i}=U({queryKey:["/api/user/api-key"],enabled:!r});i?.apiKey;const R=se;v.useEffect(()=>{const t=new IntersectionObserver(u=>{for(const x of u)x.isIntersecting&&c(x.target.id)},{rootMargin:"-20% 0px -70% 0px"});for(const u of D){const x=document.getElementById(u.id);x&&t.observe(x)}return()=>t.disconnect()},[]);function I(t){document.getElementById(t)?.scrollIntoView({behavior:"smooth"}),g(!1)}return e.jsxs("div",{className:"min-h-screen bg-white text-gray-900 flex flex-col overflow-x-hidden",style:{fontFamily:"system-ui, -apple-system, 'Segoe UI', sans-serif"},children:[e.jsx("header",{className:"sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm",children:e.jsxs("div",{className:"max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4",children:[e.jsxs("div",{className:"flex items-center gap-3 min-w-0",children:[e.jsx(N,{href:r?"/":"/dashboard/api-keys",children:e.jsxs(_,{variant:"ghost",size:"sm",className:"text-gray-500 hover:text-gray-900 -ml-2 gap-1.5 shrink-0","data-testid":"link-back-api",children:[e.jsx(H,{className:"w-4 h-4"}),e.jsx("span",{className:"hidden sm:inline",children:r?"Accueil":"Retour"})]})}),e.jsx("div",{className:"h-5 w-px bg-gray-200 shrink-0"}),e.jsxs("div",{className:"flex items-center gap-2 min-w-0",children:[e.jsx("div",{className:"w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0",children:e.jsx(K,{className:"w-4 h-4 text-primary-foreground"})}),e.jsx("span",{className:"font-semibold text-sm text-gray-900 truncate",children:"Ashtech Pay"}),e.jsx(M,{variant:"outline",className:"text-[10px] hidden sm:flex shrink-0",children:"API v1"})]})]}),e.jsxs("div",{className:"flex items-center gap-2 shrink-0",children:[r&&e.jsxs("div",{className:"hidden sm:flex items-center gap-2",children:[e.jsx(N,{href:"/login",children:e.jsx(_,{variant:"ghost",size:"sm",className:"text-gray-500 hover:text-gray-900 text-xs","data-testid":"link-login",children:"Connexion"})}),e.jsx(N,{href:"/register",children:e.jsx(_,{size:"sm",className:"text-xs","data-testid":"link-register",children:"S'inscrire"})})]}),e.jsx(N,{href:"/docs/test-pay",children:e.jsxs(_,{size:"sm",className:"gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs hidden sm:flex","data-testid":"link-test-api",children:[e.jsx(A,{className:"w-3.5 h-3.5"}),"Tester l'API"]})}),e.jsxs(_,{variant:"outline",size:"sm",onClick:O,disabled:n,className:"flex gap-1.5 text-gray-700 text-xs","data-testid":"button-download-pdf-sdk",children:[e.jsx(W,{className:"w-3.5 h-3.5"}),e.jsx("span",{className:"hidden sm:inline",children:n?"Génération…":"Télécharger PDF"}),e.jsx("span",{className:"sm:hidden",children:n?"…":"PDF"})]}),e.jsx("button",{className:"lg:hidden text-gray-600 hover:text-gray-900",onClick:()=>g(t=>!t),"data-testid":"button-toggle-mobile-nav",children:a?e.jsx(G,{className:"w-5 h-5"}):e.jsx(J,{className:"w-5 h-5"})})]})]})}),e.jsxs("div",{className:"flex flex-1 max-w-7xl mx-auto w-full min-w-0",children:[e.jsx("aside",{className:`
          ${a?"fixed inset-0 z-30 bg-white pt-14 px-4":"hidden"}
          lg:relative lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:border-r lg:border-gray-200
          lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto
        `,children:e.jsxs("nav",{className:"py-6 space-y-0.5 lg:px-4",children:[e.jsx("p",{className:"text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3 px-2",children:"Documentation"}),D.map(({id:t,label:u,icon:x})=>e.jsxs("button",{onClick:()=>I(t),"data-testid":`nav-${t}`,className:`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-all text-left ${o===t?"bg-primary/10 text-primary font-semibold":"text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`,children:[e.jsx(x,{className:"w-3.5 h-3.5 shrink-0"}),e.jsx("span",{className:"truncate",children:u})]},t)),e.jsx("div",{className:"my-4 h-px bg-gray-200"}),e.jsxs("div",{className:"px-3 py-3 rounded border border-gray-200 space-y-1",children:[e.jsx("p",{className:"text-[11px] font-medium text-gray-500",children:"Votre clé API"}),e.jsx("p",{className:"text-xs font-mono text-gray-400 tracking-wider",children:"•".repeat(28)})]})]})}),e.jsxs("main",{className:"flex-1 min-w-0 w-full px-5 py-10 lg:px-12 xl:px-16 overflow-x-hidden",children:[e.jsx("div",{className:"mb-8",children:e.jsxs("h1",{className:"text-4xl font-bold text-gray-900 leading-tight",children:["Ashtech Pay API",e.jsx("br",{}),"Documentation"]})}),e.jsxs("section",{id:"introduction",ref:t=>d.current.introduction=t,className:"scroll-mt-20",children:[e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-6",children:["L'",e.jsx("strong",{children:"Ashtech Pay API"})," unifie plusieurs passerelles de paiement africaines en une seule interface REST. Elle propose un endpoint de production pour les transactions réelles, permettant d'initialiser des paiements Mobile Money dans"," ",e.jsxs("strong",{children:[R.length,"+ pays africains"]})," sans redirection. Le routage entre opérateurs est automatique."]}),e.jsx(h,{children:"Payment API Overview"}),e.jsx("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-6",children:"L'Ashtech Pay API permet aux marchands d'intégrer facilement des capacités de paiement dans leurs systèmes. Elle supporte les opérations clés telles que le traitement des transactions, la consultation des statuts de paiement, et la réception de notifications sur les mises à jour de transactions. Cela garantit des flux de paiement fluides et efficaces, améliorant l'expérience utilisateur globale dans vos applications."}),e.jsxs("div",{className:"flex items-center justify-between gap-4 rounded border border-primary/20 bg-primary/5 px-5 py-4 mb-6",children:[e.jsxs("div",{className:"space-y-0.5",children:[e.jsx("p",{className:"text-sm font-semibold text-gray-900",children:"Prêt à tester ?"}),e.jsx("p",{className:"text-xs text-gray-600",children:"Initialisez un paiement réel et suivez son statut depuis l'API."})]}),e.jsx(N,{href:"/docs/test-pay",children:e.jsxs(_,{size:"sm",className:"gap-2 shrink-0 whitespace-nowrap","data-testid":"cta-test-api",children:[e.jsx(A,{className:"w-3.5 h-3.5"}),"Tester l'API"]})})]}),e.jsxs("div",{className:"rounded border border-gray-200 bg-gray-50 p-5 space-y-2 mb-2",children:[e.jsx("p",{className:"text-xs font-semibold uppercase tracking-widest text-gray-500",children:"URL de base"}),e.jsxs("div",{className:"flex items-center gap-3 flex-wrap",children:[e.jsx("code",{className:"text-base font-mono font-semibold text-blue-700 break-all",children:"https://www.ashtechpay.com"}),e.jsx(M,{variant:"outline",className:"border-green-500/30 text-green-700 text-[10px] shrink-0",children:"v1"})]}),e.jsx("p",{className:"text-xs text-gray-500",children:"Toutes les requêtes doivent être envoyées en HTTPS. Réponses JSON uniquement."})]})]}),e.jsxs("section",{id:"authentication",ref:t=>d.current.authentication=t,children:[e.jsx(y,{children:"Access TOKEN"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-5",children:["Toutes les transactions effectuées sur Ashtech Pay nécessitent un token de sécurité valide pour identifier et connecter le client à nos APIs. Vous pouvez obtenir votre clé API (",e.jsx(s,{children:"api_key"}),") depuis votre tableau de bord marchand Ashtech Pay."]}),e.jsx(P,{method:"POST",path:"Authorization: Bearer YOUR_API_KEY"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Incluez votre clé API dans l'en-tête HTTP ",e.jsx(s,{children:"Authorization"})," de chaque requête."]}),e.jsx(l,{language:"http",code:"Authorization: Bearer YOUR_API_KEY"}),e.jsxs("div",{className:"flex gap-3 items-start rounded border border-orange-300 bg-orange-50 p-4 my-4",children:[e.jsx("span",{className:"text-orange-500 mt-0.5 shrink-0 font-bold",children:"⚠"}),e.jsxs("p",{className:"text-sm text-orange-800",children:["Utilisez votre clé API ",e.jsx("strong",{children:"uniquement depuis votre serveur"})," (Node.js, Python, PHP…). Ne l'incluez jamais dans du code côté navigateur ou application mobile."]})]}),e.jsx(h,{children:"Exemple d'appel authentifié"}),e.jsx(T,{examples:[{language:"javascript",code:`const response = await fetch("https://www.ashtechpay.com/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ /* ... */ })
});`},{language:"python",code:`import requests

response = requests.post(
    "https://www.ashtechpay.com/v1/collect",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json",
    },
    json={},
)
print(response.json())`},{language:"bash",code:`curl https://www.ashtechpay.com/v1/collect \\
  -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{}'`},{language:"php",code:`$ch = curl_init("https://www.ashtechpay.com/v1/collect");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer YOUR_API_KEY",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([]),
]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);`}]}),e.jsx(b,{})]}),e.jsxs("section",{id:"countries",ref:t=>d.current.countries=t,children:[e.jsx(y,{children:"Pays et Opérateurs"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Retourne la liste complète des pays actifs et leurs opérateurs Mobile Money disponibles. Cette liste est ",e.jsx("strong",{children:"gérée par l'administrateur"})," — tout ajout ou retrait est immédiatement visible via cet endpoint. Utilisez-le pour peupler dynamiquement votre interface de paiement."]}),e.jsx(P,{method:"GET",path:"/v1/countries"}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mb-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(T,{examples:[{language:"javascript",code:`fetch("https://www.ashtechpay.com/v1/countries", {
  headers: {
    "Authorization": "Bearer YOUR_API_KEY"
  }
})`},{language:"python",code:`import requests

response = requests.get(
    "https://www.ashtechpay.com/v1/countries",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
)
print(response.json())`},{language:"bash",code:`curl https://www.ashtechpay.com/v1/countries \\
  -H "Authorization: Bearer YOUR_API_KEY"`},{language:"php",code:`$ch = curl_init("https://www.ashtechpay.com/v1/countries");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer YOUR_API_KEY"],
]);
$countries = json_decode(curl_exec($ch), true);
curl_close($ch);`}]})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse"}),e.jsx(l,{language:"json",code:`[
  {
    "code": "CM",
    "name": "Cameroun",
    "currency": "XAF",
    "operators": ["MTN Money", "Orange Money"]
  },
  {
    "code": "SN",
    "name": "Sénégal",
    "currency": "XOF",
    "operators": ["E-money", "Free Money", "Orange Money", "Wave Money"]
  }
  // ...
]`})]})]}),e.jsxs(h,{children:["Pays disponibles (",R.length,") — mis à jour en temps réel"]}),e.jsxs(j,{children:[e.jsx(f,{cols:["Pays","Code","Devise","Opérateurs","OTP Required"]}),e.jsx("tbody",{children:R.map(({code:t,name:u,currency:x,operators:C,otpOps:S})=>e.jsx(m,{cells:[e.jsx("span",{className:"font-medium",children:u}),e.jsx(s,{children:t}),e.jsx(s,{children:x}),e.jsx("span",{className:"flex flex-wrap gap-1",children:C.map(w=>e.jsxs("span",{className:`text-[11px] px-1.5 py-0.5 rounded border ${w.toLowerCase().includes("wave")?"bg-purple-50 text-purple-700 border-purple-200":S.includes(w)?"bg-amber-50 text-amber-700 border-amber-200":"bg-white text-gray-600 border-gray-200"}`,children:[w,S.includes(w)&&!w.toLowerCase().includes("wave")?" ⚡":"",w.toLowerCase().includes("wave")?" 🔗":""]},w))}),S.length>0?e.jsxs("span",{className:"text-amber-700 font-semibold text-xs",children:["Yes — ",S.join(", ")]}):e.jsx("span",{className:"text-gray-500 text-xs",children:"No"})]},t))})]}),e.jsxs("div",{className:"flex flex-wrap gap-4 text-xs text-gray-500 mt-2",children:[e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"w-3 h-3 rounded-full bg-gray-200 inline-block"})," USSD Push — pas d'OTP"]}),e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"w-3 h-3 rounded-full bg-amber-200 inline-block"})," ⚡ OTP requis"]}),e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"w-3 h-3 rounded-full bg-purple-200 inline-block"})," 🔗 Wave — lien de paiement"]})]}),e.jsx(b,{})]}),e.jsxs("section",{id:"crypto",ref:t=>d.current.crypto=t,children:[e.jsx(y,{children:"Pay-In Crypto"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Créez une adresse de dépôt unique pour recevoir un paiement crypto avec la même clé API",e.jsx(s,{children:"ak_…"}),". Ce flux est séparé de ",e.jsx(s,{children:"/v1/collect"})," : vos intégrations Mobile Money existantes ne changent pas."]}),e.jsxs("div",{className:"rounded border border-green-300 bg-green-50 p-4 space-y-1 mb-5",children:[e.jsx("p",{className:"text-sm font-semibold text-green-900",children:"Confirmation, crédit et webhook"}),e.jsxs("p",{className:"text-sm text-green-800 leading-relaxed",children:["Après la création, le prestataire crypto notifie Ashtech Pay, puis Ashtech Pay passe la transaction à"," ",e.jsx(s,{children:"completed"}),", crédite automatiquement le wallet USDT du marchand avec"," ",e.jsx(s,{children:"credited_amount_usdt"})," et envoie un POST à votre ",e.jsx(s,{children:"notify_url"}),"."]})]}),e.jsx(P,{method:"GET",path:"/v1/crypto/assets"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Retourne uniquement les réseaux crypto actifs et autorisés. Utilisez la valeur",e.jsx(s,{children:"asset_code"})," retournée dans l'appel de création."]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mb-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(T,{examples:[{language:"javascript",code:`const response = await fetch("https://www.ashtechpay.com/v1/crypto/assets", {
  headers: {
    "Authorization": "Bearer YOUR_API_KEY"
  }
});
const data = await response.json();`},{language:"python",code:`import requests

response = requests.get(
    "https://www.ashtechpay.com/v1/crypto/assets",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
)
print(response.json())`},{language:"bash",code:`curl https://www.ashtechpay.com/v1/crypto/assets \\
  -H "Authorization: Bearer YOUR_API_KEY"`},{language:"php",code:`$ch = curl_init("https://www.ashtechpay.com/v1/crypto/assets");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer YOUR_API_KEY"],
]);
$assets = json_decode(curl_exec($ch), true);
curl_close($ch);`}]})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse"}),e.jsx(l,{language:"json",code:`{
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
}`})]})]}),e.jsx(P,{method:"POST",path:"/v1/crypto/collect"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["L'API accepte un montant en ",e.jsx("strong",{children:"USDT"})," ou dans une devise fiat supportée (",e.jsx(s,{children:"XAF"}),", ",e.jsx(s,{children:"XOF"}),", ",e.jsx(s,{children:"CDF"})," ou ",e.jsx(s,{children:"USD"}),"). Les devises fiat sont converties en USDT avec le taux USDT/XAF.",e.jsx(s,{children:"amount"})," est le montant brut ; ",e.jsx(s,{children:"credited_amount_usdt"})," est le net après frais."]}),e.jsxs("div",{className:"rounded border border-blue-300 bg-blue-50 p-4 mb-5",children:[e.jsx("p",{className:"text-sm font-semibold text-blue-900 mb-1",children:"Comment afficher l'adresse et le QR code ?"}),e.jsxs("p",{className:"text-sm text-blue-800 leading-relaxed",children:["La réponse ",e.jsx("strong",{children:"202"})," contient l'adresse unique dans ",e.jsx(s,{children:"address"})," et, pour certains réseaux, le"," ",e.jsx(s,{children:"memo"})," ou le ",e.jsx(s,{children:"tag"}),". Ashtech Pay ne renvoie pas d'image QR : votre interface génère le QR localement à partir de ces valeurs."]})]}),e.jsx(h,{children:"Paramètres"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Paramètre","Required","Description"]}),e.jsx("tbody",{children:[{name:"amount",req:!0,desc:"Montant brut à recevoir, en currency."},{name:"currency",req:!0,desc:"USDT, XAF, XOF, CDF, USD."},{name:"asset_code",req:!0,desc:"Réseau retourné par GET /v1/crypto/assets, ex. USDT.TRC20."},{name:"reference",req:!1,desc:"Référence de votre commande ; générée si absente."},{name:"notify_url",req:!1,desc:"URL HTTPS recevant payment.completed ou payment.failed."},{name:"customer",req:!1,desc:"email, firstName et lastName du payeur."},{name:"refund_address",req:!1,desc:"Adresse de remboursement fournie au prestataire."}].map(t=>e.jsx(m,{cells:[e.jsx(s,{children:t.name}),t.req?e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Yes"}):e.jsx("span",{className:"text-gray-400 text-xs",children:"No"}),t.desc]},t.name))})]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mt-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(T,{examples:[{language:"javascript",code:`fetch("https://www.ashtechpay.com/v1/crypto/collect", {
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
    customer: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com"
    }
  })
})`},{language:"python",code:`import requests

response = requests.post(
    "https://www.ashtechpay.com/v1/crypto/collect",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json",
    },
    json={
        "amount": 25,
        "currency": "USDT",
        "asset_code": "USDT.TRC20",
        "reference": "ORDER-CRYPTO-001",
        "notify_url": "https://monsite.com/webhook",
        "customer": {
            "firstName": "Ada",
            "lastName": "Lovelace",
            "email": "ada@example.com",
        },
    },
)
print(response.json())`},{language:"bash",code:`curl https://www.ashtechpay.com/v1/crypto/collect \\
  -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 25,
    "currency": "USDT",
    "asset_code": "USDT.TRC20",
    "reference": "ORDER-CRYPTO-001",
    "notify_url": "https://monsite.com/webhook",
    "customer": {
      "firstName": "Ada",
      "lastName": "Lovelace",
      "email": "ada@example.com"
    }
  }'`},{language:"php",code:`$payload = [
    "amount" => 25,
    "currency" => "USDT",
    "asset_code" => "USDT.TRC20",
    "reference" => "ORDER-CRYPTO-001",
    "notify_url" => "https://monsite.com/webhook",
    "customer" => [
        "firstName" => "Ada",
        "lastName" => "Lovelace",
        "email" => "ada@example.com",
    ],
];
$ch = curl_init("https://www.ashtechpay.com/v1/crypto/collect");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer YOUR_API_KEY",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);`}]})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse 202"}),e.jsx(l,{language:"json",code:`{
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
}`})]})]}),e.jsx(h,{children:"Exemple complet — afficher l'adresse, le memo et le QR"}),e.jsxs("p",{className:"text-sm text-gray-700 mb-2 leading-relaxed",children:["Installez une bibliothèque QR dans votre interface, par exemple"," ",e.jsx(s,{children:"npm install qrcode"}),". Pour USDT/TRC20, le QR peut contenir directement l'adresse. Pour un réseau avec memo/tag, utilisez uniquement une URI officiellement supportée."]}),e.jsx(l,{language:"javascript",code:`import QRCode from "qrcode";

async function showCryptoPayment(data) {
  // data vient de POST /v1/crypto/collect
  document.querySelector("#crypto-address").textContent = data.address;
  document.querySelector("#crypto-network").textContent = data.asset_code;
  document.querySelector("#crypto-amount").textContent =
    data.amount_usdt + " USDT";

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
//         #crypto-qr (canvas) et #crypto-memo`}),e.jsxs("div",{className:"rounded border border-amber-300 bg-amber-50 p-4 mt-4 space-y-1",children:[e.jsx("p",{className:"text-sm font-semibold text-amber-800",children:"Important — memo / tag"}),e.jsxs("p",{className:"text-sm text-amber-800 leading-relaxed",children:["Ne concaténez jamais le memo à l'adresse. ",e.jsx(s,{children:"memo_required"})," indique si le champ est obligatoire et ",e.jsx(s,{children:"memo_type"})," précise ",e.jsx(s,{children:"memo"})," ou ",e.jsx(s,{children:"tag"}),". Un memo/tag manquant peut empêcher l'attribution du paiement. L'adresse est à usage unique pour cette transaction."]})]}),e.jsxs("div",{className:"rounded border border-red-300 bg-red-50 p-4 mt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-red-900 mb-1",children:"Erreurs de création et diagnostic"}),e.jsxs("p",{className:"text-sm text-red-800 leading-relaxed",children:["Une réponse ",e.jsx(s,{children:"502 gateway_error"})," signifie que l'adresse n'a pas pu être générée.",e.jsx(s,{children:"provider_invalid_response"})," signifie que le service a répondu sans adresse exploitable. Une réponse ",e.jsx(s,{children:"500 server_error"})," contient un ",e.jsx(s,{children:"request_id"})," : conservez-le pour le diagnostic."]})]}),e.jsxs("div",{className:"rounded border border-gray-200 bg-gray-50 p-4 mt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-gray-900 mb-1",children:"Après l'affichage : attendre la confirmation"}),e.jsxs("p",{className:"text-sm text-gray-700 leading-relaxed",children:["La création de l'adresse ne signifie pas que le paiement est confirmé. Gardez"," ",e.jsx(s,{children:"transaction_id"})," et ",e.jsx(s,{children:"reference"}),", attendez le webhook ",e.jsx(s,{children:"payment.completed"})," ou"," ",e.jsx(s,{children:"payment.failed"}),", et utilisez ",e.jsx(s,{children:"GET /v1/transaction/:id"})," comme vérification complémentaire. Ne livrez jamais un produit avec le seul statut ",e.jsx(s,{children:"pending"}),"."]})]}),e.jsx(b,{})]}),e.jsxs("section",{id:"collect",ref:t=>d.current.collect=t,children:[e.jsx(y,{children:"Initier un paiement"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Initie un paiement Mobile Money via l'Ashtech Pay API. Le routage entre fournisseurs est automatique selon le pays et l'opérateur. Le client reçoit une demande de validation sur son téléphone (USSD, OTP ou Wave selon l'opérateur). Les frais sont configurés par l'administrateur et déduits automatiquement — le ",e.jsx(s,{children:"credited_amount"})," correspond au montant net crédité sur votre compte. Consultez ",e.jsx(s,{children:"GET /v1/fees"})," pour les frais actuels."]}),e.jsx(P,{method:"POST",path:"/v1/collect"}),e.jsx(h,{children:"Corps de la requête (JSON)"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Paramètre","Type","Statut","Description"]}),e.jsxs("tbody",{children:[e.jsx(m,{cells:[e.jsx(s,{children:"amount"}),"number",e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Requis"}),"Montant brut à collecter"]}),e.jsx(m,{cells:[e.jsx(s,{children:"currency"}),"string",e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Requis"}),"Devise du pays (XAF, XOF, CDF…)"]}),e.jsx(m,{cells:[e.jsx(s,{children:"phone"}),"string",e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Requis"}),"Numéro de téléphone du payeur"]}),e.jsx(m,{cells:[e.jsx(s,{children:"operator"}),"string",e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Requis"}),"Nom exact de l'opérateur (depuis /v1/countries)"]}),e.jsx(m,{cells:[e.jsx(s,{children:"country_code"}),"string",e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Requis"}),"Code ISO du pays (CM, SN, CI…)"]}),e.jsx(m,{cells:[e.jsx(s,{children:"reference"}),"string",e.jsx("span",{className:"text-gray-400 text-xs",children:"Optionnel"}),"Référence unique de votre commande. Obligatoire lors du retry OTP : renvoyer la valeur reçue dans la réponse 400."]}),e.jsx(m,{cells:[e.jsx(s,{children:"otp"}),"string",e.jsx("span",{className:"text-gray-400 text-xs",children:"Optionnel"}),"Code OTP reçu par SMS. Doit toujours être accompagné du champ reference (valeur reçue dans le 400 otp_required)."]}),e.jsx(m,{cells:[e.jsx(s,{children:"notify_url"}),"string",e.jsx("span",{className:"text-gray-400 text-xs",children:"Optionnel"}),"URL webhook pour recevoir le résultat du paiement"]})]})]}),e.jsx(b,{}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mt-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(T,{examples:[{language:"javascript",code:`fetch("https://www.ashtechpay.com/v1/collect", {
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
})`},{language:"python",code:`import requests

response = requests.post(
    "https://www.ashtechpay.com/v1/collect",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json",
    },
    json={
        "amount": 5000,
        "currency": "XAF",
        "phone": "670000000",
        "operator": "MTN Money",
        "country_code": "CM",
        "reference": "ORDER-001",
        "notify_url": "https://monsite.com/webhook",
    },
)
print(response.json())`},{language:"bash",code:`curl https://www.ashtechpay.com/v1/collect \\
  -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "currency": "XAF",
    "phone": "670000000",
    "operator": "MTN Money",
    "country_code": "CM",
    "reference": "ORDER-001",
    "notify_url": "https://monsite.com/webhook"
  }'`},{language:"php",code:`$payload = [
    "amount" => 5000,
    "currency" => "XAF",
    "phone" => "670000000",
    "operator" => "MTN Money",
    "country_code" => "CM",
    "reference" => "ORDER-001",
    "notify_url" => "https://monsite.com/webhook",
];
$ch = curl_init("https://www.ashtechpay.com/v1/collect");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer YOUR_API_KEY",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
]);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);`}]})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse (202)"}),e.jsx(l,{language:"json",code:`{
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-001",
  "status": "pending",
  "amount": 5000,
  "credited_amount": 4750,
  "fee_amount": 250,
  "currency": "XAF",
  "operator": "MTN Money",
  "phone": "670000000",
  "country_code": "CM",
  "created_at": "2026-03-15T14:00:00Z"
}`})]})]}),e.jsxs("div",{className:"rounded border border-yellow-300 bg-yellow-50 p-4 mt-5 space-y-3",children:[e.jsx("p",{className:"text-sm font-semibold text-yellow-800",children:"OTP requis — deux variantes selon l'opérateur"}),e.jsxs("p",{className:"text-sm text-yellow-800 leading-relaxed",children:["Certains opérateurs nécessitent un code OTP. L'API retourne"," ",e.jsx(s,{children:"400 otp_required"})," avec un champ ",e.jsx(s,{children:"reference"})," et un champ ",e.jsx(s,{children:"ussd_code"}),". Il existe deux variantes :"," ",e.jsx("strong",{children:"OTP USSD"})," ","(Orange CI, SN, BF — le client compose le code USSD affiché, l'OTP s'affiche dans le menu téléphonique,"," ",e.jsx("em",{children:"aucun SMS n'est envoyé"}),") et"," ",e.jsx("strong",{children:"OTP SMS"})," ","(certains opérateurs — SMS déclenché automatiquement, ",e.jsx(s,{children:"ussd_code"})," est null). Dans les deux cas, relancez la requête avec ",e.jsx(s,{children:"otp"})," ",e.jsx("strong",{children:"et"})," ",e.jsx(s,{children:"reference"}),"."]}),e.jsx(h,{children:"Opérateur Orange — disponibilité et OTP"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Operator","otp_code","Phone Code","Payment Method","Payin","Payout","Available","Currency"]}),e.jsx("tbody",{children:[{phone:"+225",otp:"Required",currency:"XOF"},{phone:"+226",otp:"Required",currency:"XOF"},{phone:"+223",otp:"No",currency:"XOF"},{phone:"+221",otp:"Required",currency:"XOF"},{phone:"+224",otp:"Required",currency:"GNF"},{phone:"+237",otp:"No",currency:"XAF"},{phone:"+243",otp:"No",currency:"CDF"}].map(({phone:t,otp:u,currency:x})=>e.jsx(m,{cells:[e.jsx("span",{className:"font-medium",children:"Orange"}),e.jsx("span",{className:u==="Required"?"text-green-700 font-semibold":"text-gray-700",children:u}),e.jsx(s,{children:t}),e.jsx("span",{className:"font-mono text-xs",children:"orange"}),e.jsx("span",{className:"text-green-700 font-semibold",children:"Yes"}),e.jsx("span",{className:"text-green-700 font-semibold",children:"Yes"}),e.jsx("span",{className:"text-green-700 font-semibold",children:"Yes"}),e.jsx(s,{children:x})]},t))})]}),e.jsx(l,{language:"json",code:`// Étape 1 — Requête initiale (sans otp) → réponse 400
{
  "error": "otp_required",
  "reference": "DEP-A1B2C3D4",    // ← à conserver absolument !
  "ussd_code": "#144*391#",        // CI: "#144*82#", SN: "#144*391#", BF: "*144*4*6*5000#"
  // "ussd_code": null             // OTP SMS → SMS envoyé automatiquement
  "message": "OTP requis. Composez #144*391# sur votre téléphone pour obtenir votre code…"
}

// Étape 2 — Retry avec otp + reference
{
  "amount": 5000, "currency": "XOF", "phone": "77XXXXXXX",
  "operator": "Orange Money", "country_code": "SN",
  "otp": "VOTRE_CODE_OTP",         // ← code réellement reçu après USSD ou SMS
  "reference": "DEP-A1B2C3D4",    // ← obligatoire, même valeur que la réponse 400
  "notify_url": "https://monsite.com/webhook"
}
// → 202 pending → webhook payment.completed`})]})]}),e.jsxs("section",{id:"flows",ref:t=>d.current.flows=t,children:[e.jsx(y,{children:"Flux de Paiement"}),e.jsx("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-5",children:"Selon le pays et l'opérateur, l'API utilise automatiquement l'un des 4 flux ci-dessous. Votre code doit gérer chacun différemment car la réponse et les étapes varient."}),e.jsxs(j,{children:[e.jsx(f,{cols:["Flux","Opérateurs concernés","Réponse initiale","Action requise"]}),e.jsx("tbody",{children:[{name:"USSD Push",color:"text-blue-700",ops:"MTN, Moov, Airtel, Orange, Free, E-money, T-Money, Flooz, M-Pesa, Afri Money…",resp:"202 pending",rcolor:"text-green-700",action:"Attendre le webhook. Le client valide directement sur son téléphone."},{name:"OTP USSD",color:"text-orange-700",ops:"Orange Money CI (#144*82#), SN (#144*391#), BF (*144*4*6*montant#)",resp:'400 otp_required  ussd_code: "#144*82#"',rcolor:"text-orange-700",action:"Afficher le ussd_code au client — il compose, l'OTP s'affiche dans le menu USSD. Relancer avec otp + reference."},{name:"OTP SMS",color:"text-yellow-700",ops:"Certains opérateurs — SMS envoyé automatiquement",resp:"400 otp_required  ussd_code: null",rcolor:"text-orange-700",action:"Le fournisseur envoie le SMS OTP. Relancer avec otp + reference."},{name:"Wave",color:"text-purple-700",ops:"Wave (CI), Wave (SN)",resp:'202 pending  flow: "wave", wave_url: "..."',rcolor:"text-purple-700",action:"Afficher le wave_url en bouton ou QR code. Le client ouvre Wave pour confirmer."}].map(t=>e.jsx(m,{cells:[e.jsx("span",{className:`font-semibold text-sm ${t.color}`,children:t.name}),t.ops,e.jsx("code",{className:`font-mono text-xs whitespace-pre-line ${t.rcolor}`,children:t.resp}),t.action]},t.name))})]}),e.jsxs("div",{className:"rounded border border-blue-200 bg-blue-50 p-5 space-y-4 mt-6",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0",children:"1"}),e.jsx("h3",{className:"font-bold text-blue-800",children:"Flux USSD Push — La majorité des opérateurs"})]}),e.jsxs("p",{className:"text-sm text-gray-700",children:["Flux le plus simple. Le client reçoit une demande USSD sur son téléphone et valide en composant son PIN. Vous recevez la confirmation par webhook. ",e.jsx("strong",{children:"Pas d'OTP à gérer côté merchant."})]}),e.jsxs("div",{className:"text-xs text-gray-600",children:[e.jsx("strong",{children:"Exemples :"})," ","MTN (CM, BJ, CG, GN, CD), Moov (BJ, CI, BF, GA, ML, TG), Airtel (CG, GA, NE, CD, TD), Orange (CM), Free Money (SN), E-money (SN), T-Money (TG), Flooz (TG), Mpesa Money (CD), Afri Money (CD), Vodacom (CD)"]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-4 min-w-0 [&>div]:min-w-0",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Requête"}),e.jsx(l,{language:"javascript",code:`// Orange Money Cameroun — flux USSD push
const res = await fetch("https://www.ashtechpay.com/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XAF",
    phone: "699000000",
    operator: "Orange Money",
    country_code: "CM",
    notify_url: "https://monsite.com/webhook"
  })
});

const data = await res.json();
// data.status === "pending"
// → Attendre le webhook payment.completed / payment.failed`})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Réponse 202"}),e.jsx(l,{language:"json",code:`{
  "transaction_id": "abc-123",
  "status": "pending",
  "amount": 5000,
  "credited_amount": 4750,
  "fee_amount": 250,
  "currency": "XAF"
}

// Le client reçoit la demande USSD
// sur son téléphone → valide avec PIN
// Webhook envoyé à notify_url`})]})]})]}),e.jsxs("div",{className:"rounded border border-orange-200 bg-orange-50 p-5 space-y-4 mt-4",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white shrink-0",children:"2"}),e.jsx("h3",{className:"font-bold text-orange-800",children:"Flux OTP USSD — Orange Money CI, SN, BF"})]}),e.jsxs("p",{className:"text-sm text-gray-700",children:["Pour Orange Money en Côte d'Ivoire, Sénégal et Burkina Faso. L'API retourne un ",e.jsx(s,{children:"ussd_code"})," ","que le client compose depuis son téléphone — l'OTP s'affiche directement dans le menu USSD (pas de SMS envoyé)."]}),e.jsxs("div",{className:"text-xs text-gray-600",children:[e.jsx("strong",{children:"Codes USSD par pays :"})," ","CI — ",e.jsx(s,{children:"#144*82#"}),"  |  SN — ",e.jsx(s,{children:"#144*391#"}),"  |  BF — ",e.jsx(s,{children:"*144*4*6*montant#"})]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-4 min-w-0 [&>div]:min-w-0",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Étape 1 — Requête initiale (sans OTP)"}),e.jsx(l,{language:"javascript",code:`// Orange Money CI — étape 1 : sans OTP
const res = await fetch("https://www.ashtechpay.com/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 1000,
    currency: "XOF",
    phone: "0700000000",
    operator: "Orange Money",
    country_code: "CI",
    notify_url: "https://monsite.com/webhook"
  })
});
// → 400 otp_required
// ussd_code contient le code à composer`})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Réponse 400 + Étape 2"}),e.jsx(l,{language:"json",code:`// Réponse 400 — CI :
{
  "error": "otp_required",
  "message": "OTP requis. Composez #144*82# …",
  "reference": "DEP-A1B2C3D4",
  "ussd_code": "#144*82#"
}

// Afficher le ussd_code au client :
// "Composez #144*82# sur votre téléphone"`}),e.jsx(l,{language:"javascript",code:`// Étape 2 : même requête + otp + reference
body: JSON.stringify({
  amount: 1000, currency: "XOF",
  phone: "0700000000",
  operator: "Orange Money",
  country_code: "CI",
   otp: "VOTRE_CODE_OTP",
  reference: "DEP-A1B2C3D4", // ← obligatoire
  notify_url: "https://monsite.com/webhook"
})
// → 202 pending → webhook`})]})]})]}),e.jsxs("div",{className:"rounded border border-yellow-200 bg-yellow-50 p-5 space-y-4 mt-4",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-white shrink-0",children:"3"}),e.jsx("h3",{className:"font-bold text-yellow-800",children:"Flux OTP SMS — selon la configuration fournisseur"})]}),e.jsxs("p",{className:"text-sm text-gray-700",children:["Pour certains opérateurs, l'API déclenche automatiquement l'envoi d'un SMS OTP au numéro du client — ",e.jsx("strong",{children:"aucun code USSD à composer."})," ","Le champ ",e.jsx(s,{children:"ussd_code"})," est ",e.jsx("code",{className:"font-mono text-red-600",children:"null"}),"."]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-4 min-w-0 [&>div]:min-w-0",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Étape 1 — Requête initiale (sans OTP)"}),e.jsx(l,{language:"javascript",code:`// Opérateur OTP SMS — étape 1
const res = await fetch("https://www.ashtechpay.com/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "XOF",
    phone: "04000000",
    operator: "Orange Money",
    country_code: "BF",
    notify_url: "https://monsite.com/webhook"
  })
});
// → 400 otp_required
// ussd_code est null — SMS envoyé automatiquement`})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Réponse 400 + Étape 2"}),e.jsx(l,{language:"json",code:`// Réponse 400 :
{
  "error": "otp_required",
  "message": "OTP requis. Un code a été envoyé par SMS.",
  "reference": "DEP-X9Y8Z7W6",
  "ussd_code": null
}

// Le client reçoit son OTP par SMS
// Étape 2 : relancer avec otp + reference`}),e.jsx(l,{language:"javascript",code:`// Étape 2 : même requête + otp + reference
body: JSON.stringify({
  amount: 5000, currency: "XOF",
  phone: "04000000",
  operator: "Orange Money",
  country_code: "BF",
  otp: "456789",
  reference: "DEP-X9Y8Z7W6", // ← obligatoire
  notify_url: "https://monsite.com/webhook"
})
// → 202 pending → webhook`})]})]})]}),e.jsxs("div",{className:"rounded border border-purple-200 bg-purple-50 p-5 space-y-4 mt-4",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0",children:"4"}),e.jsx("h3",{className:"font-bold text-purple-800",children:"Flux Wave — Côte d'Ivoire et Sénégal"})]}),e.jsxs("p",{className:"text-sm text-gray-700",children:["Pour Wave CI et Wave SN. L'API retourne directement un ",e.jsx(s,{children:"wave_url"})," dans la réponse 202. Votre interface doit afficher ce lien (bouton ou QR code) pour que le client l'ouvre dans son application Wave.",e.jsx("strong",{children:" Pas d'OTP."})," Le numéro de téléphone n'est pas requis pour Wave."]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-4 min-w-0 [&>div]:min-w-0",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Requête"}),e.jsx(l,{language:"javascript",code:`// Wave Côte d'Ivoire
const res = await fetch("https://www.ashtechpay.com/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 2000,
    currency: "XOF",
    phone: "0700000000",  // facultatif pour Wave
    operator: "Wave Money",
    country_code: "CI",
    notify_url: "https://monsite.com/webhook"
  })
});

const data = await res.json();
if (data.flow === "wave") {
  window.open(data.wave_url, "_blank");
}`})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Réponse 202"}),e.jsx(l,{language:"json",code:`{
  "transaction_id": "xyz-789",
  "status": "pending",
  "amount": 2000,
  "credited_amount": 1910,
  "fee_amount": 90,
  "currency": "XOF",
  "operator": "Wave Money",
  "country_code": "CI",
  "flow": "wave",
  "wave_url": "https://pay.wave.com/m/..."
}

// → Afficher wave_url comme bouton "Payer avec Wave"
// → Le client ouvre l'app Wave et confirme
// → Webhook payment.completed envoyé`})]})]})]}),e.jsx(h,{children:"Comment détecter le bon flux dans votre code"}),e.jsx(l,{language:"javascript",code:`async function collectPayment(params) {
  const res = await fetch("https://www.ashtechpay.com/v1/collect", {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params)
  });

  const data = await res.json();

  if (res.status === 202 && data.flow === "wave") {
    // ─── Flux Wave : afficher le lien de paiement ─────────────
    return { type: "wave", waveUrl: data.wave_url, transactionId: data.transaction_id };
  }

  if (res.status === 202) {
    // ─── Flux USSD Push : attendre le webhook ──────────────────
    return { type: "ussd_push", transactionId: data.transaction_id };
  }

  if (res.status === 400 && data.error === "otp_required") {
    if (data.ussd_code) {
      // ─── Flux OTP USSD : code USSD à composer ─────────────────
      return { type: "otp_ussd", ussdCode: data.ussd_code, reference: data.reference };
    } else {
      // ─── Flux OTP SMS : SMS envoyé automatiquement ────────────
      return { type: "otp_sms", reference: data.reference };
    }
  }

  throw new Error(data.message);
}`}),e.jsx(b,{})]}),e.jsxs("section",{id:"transaction",ref:t=>d.current.transaction=t,children:[e.jsx(y,{children:"Statut d'une Transaction"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Consultez le statut d'une transaction à tout moment via le"," ",e.jsx(s,{children:"transaction_id"})," retourné lors de l'initiation. Utilisez ce endpoint en complément du webhook."]}),e.jsx(P,{method:"GET",path:"/v1/transaction/:id"}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mb-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(T,{examples:[{language:"javascript",code:`fetch(
  "https://www.ashtechpay.com/v1/transaction/8f3e1c2d-...",
  {
    headers: {
      "Authorization": "Bearer YOUR_API_KEY"
    }
  }
)`},{language:"python",code:`import requests

response = requests.get(
    "https://www.ashtechpay.com/v1/transaction/8f3e1c2d-...",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
)
print(response.json())`},{language:"bash",code:`curl https://www.ashtechpay.com/v1/transaction/8f3e1c2d-... \\
  -H "Authorization: Bearer YOUR_API_KEY"`},{language:"php",code:`$ch = curl_init("https://www.ashtechpay.com/v1/transaction/8f3e1c2d-...");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer YOUR_API_KEY"],
]);
$transaction = json_decode(curl_exec($ch), true);
curl_close($ch);`}]})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse"}),e.jsx(l,{language:"json",code:`{
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-001",
  "status": "success",
  "amount": 5000,
  "credited_amount": 4750,
  "fee_amount": 250,
  "currency": "XAF",
  "phone": "670000000",
  "created_at": "2026-03-15T14:00:00Z",
  "confirmed_at": "2026-03-15T14:02:17Z"
}`})]})]}),e.jsx(h,{children:"Statuts possibles"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Statut","Description","Final ?"]}),e.jsx("tbody",{children:[{status:"pending",color:"text-yellow-700",desc:"En attente de confirmation de l'opérateur",final:!1},{status:"success",color:"text-green-700",desc:"Paiement confirmé — compte marchand crédité",final:!0},{status:"failed",color:"text-red-700",desc:"Paiement refusé, expiré ou annulé",final:!0}].map(({status:t,color:u,desc:x,final:C})=>e.jsx(m,{cells:[e.jsx("span",{className:`font-mono font-semibold text-sm ${u}`,children:t}),x,C?e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Oui"}):e.jsx("span",{className:"text-gray-400 text-xs",children:"Non"})]},t))})]}),e.jsx(b,{})]}),e.jsxs("section",{id:"fees",ref:t=>d.current.fees=t,children:[e.jsx(y,{children:"Grille Tarifaire"}),e.jsx("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:"Retourne la grille tarifaire en vigueur pour chaque pays actif."}),e.jsx(P,{method:"GET",path:"/v1/fees"}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mb-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(T,{examples:[{language:"javascript",code:`fetch("https://www.ashtechpay.com/v1/fees", {
  headers: {
    "Authorization": "Bearer YOUR_API_KEY"
  }
})`},{language:"python",code:`import requests

response = requests.get(
    "https://www.ashtechpay.com/v1/fees",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
)
print(response.json())`},{language:"bash",code:`curl https://www.ashtechpay.com/v1/fees \\
  -H "Authorization: Bearer YOUR_API_KEY"`},{language:"php",code:`$ch = curl_init("https://www.ashtechpay.com/v1/fees");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer YOUR_API_KEY"],
]);
$fees = json_decode(curl_exec($ch), true);
curl_close($ch);`}]})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse"}),e.jsx(l,{language:"json",code:`[
  {
    "country_code": "CM",
    "country_name": "Cameroun",
    "currency": "XAF",
    "total_fee_pct": 5.5,
    "ashtech_margin_pct": 2.0,
    "operators": ["MTN Money", "Orange Money"]
  },
  {
    "country_code": "SN",
    "country_name": "Sénégal",
    "currency": "XOF",
    "total_fee_pct": 5.0,
    "ashtech_margin_pct": 2.0,
    "operators": ["E-money", "Free Money", "Orange Money", "Wave Money"]
  }
  // ...un objet par pays actif
]`})]})]}),e.jsx(h,{children:"Champs de la réponse"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Champ","Type","Description"]}),e.jsx("tbody",{children:[{name:"country_code",type:"string",desc:"Code ISO du pays (CM, SN, CI…)"},{name:"country_name",type:"string",desc:"Nom complet du pays"},{name:"currency",type:"string",desc:"Devise principale (XAF, XOF, CDF…)"},{name:"total_fee_pct",type:"number",desc:"Frais totaux en % appliqués au montant (ex: 5.5 = 5,5%)"},{name:"ashtech_margin_pct",type:"number",desc:"Part Ashtech Pay dans les frais totaux"},{name:"operators",type:"string[]",desc:"Opérateurs disponibles pour ce pays"}].map(({name:t,type:u,desc:x})=>e.jsx(m,{cells:[e.jsx(s,{children:t}),e.jsx(s,{children:u}),x]},t))})]}),e.jsx(h,{children:"Exemple — calculer le montant net avant d'appeler /v1/collect"}),e.jsx(l,{language:"javascript",code:`// Récupérer les frais en cache (une fois au démarrage ou toutes les heures)
const fees = await fetch("https://www.ashtechpay.com/v1/fees", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
}).then(r => r.json());

function getFeeForCountry(countryCode) {
  return fees.find(f => f.country_code === countryCode);
}

function computeNet(grossAmount, countryCode) {
  const fee = getFeeForCountry(countryCode);
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
// → { gross: 10000, fee: 550, net: 9450, fee_pct: 5.5 }`}),e.jsx(b,{})]}),e.jsxs("section",{id:"webhooks",ref:t=>d.current.webhooks=t,children:[e.jsx(y,{children:"Webhooks"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-5",children:["Quand une transaction atteint un état final, Ashtech Pay envoie automatiquement une requête"," ",e.jsx(s,{children:"POST"})," à la ",e.jsx(s,{children:"notify_url"})," que vous avez passée dans votre appel à"," ",e.jsx(s,{children:"/v1/collect"}),". Le champ ",e.jsx(s,{children:"amount"})," correspond au montant net après frais, et ",e.jsx(s,{children:"total_amount"})," au montant brut collecté."]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mb-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Payload — paiement réussi"}),e.jsx(l,{language:"json",code:`{
  "event": "payment.completed",
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-001",
  "status": "completed",
  "amount": 4750,
  "total_amount": 5000,
  "currency": "XAF",
  "type": "deposit",
  "phone": "670000000",
  "timestamp": "2026-03-15T14:02:17.000Z"
}`})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Payload — paiement échoué"}),e.jsx(l,{language:"json",code:`{
  "event": "payment.failed",
  "transaction_id": "8f3e1c2d-...",
  "reference": "ORDER-001",
  "status": "failed",
  "amount": 5000,
  "total_amount": 5000,
  "currency": "XAF",
  "type": "deposit",
  "phone": "670000000",
  "timestamp": "2026-03-15T14:03:55.000Z"
}`})]})]}),e.jsx(h,{children:"Événements disponibles"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Événement","Déclencheur"]}),e.jsx("tbody",{children:[{event:"payment.completed",desc:"Paiement (dépôt) confirmé avec succès"},{event:"payment.failed",desc:"Paiement refusé, expiré ou annulé"},{event:"payout.completed",desc:"Retrait ou virement sortant confirmé"},{event:"payout.failed",desc:"Retrait ou virement échoué"}].map(({event:t,desc:u})=>e.jsx(m,{cells:[e.jsx(s,{children:t}),u]},t))})]}),e.jsx(h,{children:"Handler (Node.js / Express)"}),e.jsx(l,{language:"javascript",code:`app.post("/webhook", express.json(), async (req, res) => {
  // Toujours répondre 200 en premier
  res.status(200).json({ received: true });

  const { event, transaction_id, reference, amount, currency } = req.body;

  if (event === "payment.completed") {
    // Créditer le client dans votre base
    // amount = montant net (après frais)
    await markOrderAsPaid(reference, { transactionId: transaction_id, amount, currency });
  }

  if (event === "payment.failed") {
    await cancelOrder(reference);
  }

  if (event === "payout.completed") {
    await markPayoutDone(reference, { transactionId: transaction_id });
  }

  if (event === "payout.failed") {
    await markPayoutFailed(reference);
  }
});`}),e.jsxs("div",{className:"rounded border border-blue-200 bg-blue-50 p-4 mt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-blue-900 mb-2",children:"Bonnes pratiques"}),e.jsx("ul",{className:"space-y-1.5 text-sm text-blue-800",children:["Répondez toujours HTTP 200 immédiatement pour accuser réception","Traitez la logique métier après avoir répondu 200 (asynchrone)","Vérifiez le transaction_id dans votre base pour éviter les doublons","Le webhook est complémentaire à GET /v1/transaction/:id — utilisez les deux","Votre notify_url doit être une URL HTTPS publique (pas localhost)"].map(t=>e.jsxs("li",{className:"flex items-start gap-2",children:[e.jsx(E,{className:"w-3.5 h-3.5 mt-0.5 text-blue-600 shrink-0"}),t]},t))})]}),e.jsx(b,{})]}),e.jsxs("section",{id:"errors",ref:t=>d.current.errors=t,children:[e.jsx(y,{children:"STATUS CODES"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-5",children:["Ce tableau présente les différents codes de statut HTTP et leurs messages correspondants liés aux résultats des transactions utilisés par ",e.jsx("strong",{children:"Ashtech Pay"}),". Il indique si une transaction a été traitée avec succès, a échoué ou est toujours en attente, ainsi que les raisons spécifiques des échecs."]}),e.jsxs(j,{children:[e.jsx(f,{cols:["Code","Status","Message"]}),e.jsx("tbody",{children:[{code:"200",status:"SUCCESS",bold:!0,msg:"Transaction successfully processed"},{code:"200",status:"FAILED",bold:!0,msg:"Transaction Failed"},{code:"200",status:"PENDING",bold:!0,msg:"Transaction in process"},{code:"400",status:"FAILED",bold:!1,msg:"Bad Request — paramètre manquant ou format invalide"},{code:"400",status:"FAILED",bold:!1,msg:"otp_required — OTP requis, conservez le champ reference"},{code:"400",status:"FAILED",bold:!1,msg:"missing_reference — confirmation OTP sans reference"},{code:"400",status:"FAILED",bold:!1,msg:"otp_expired — session OTP expirée, relancez sans otp"},{code:"401",status:"FAILED",bold:!1,msg:"invalid credentials — clé API manquante ou révoquée"},{code:"403",status:"FAILED",bold:!1,msg:"Unauthorized — transaction n'appartient pas à votre compte"},{code:"404",status:"FAILED",bold:!1,msg:"Not Found — transaction introuvable"},{code:"405",status:"FAILED",bold:!1,msg:"Method Not Allowed"},{code:"408",status:"FAILED",bold:!1,msg:"Request Timeout"},{code:"422",status:"FAILED",bold:!1,msg:"Pays ou opérateur non supporté / devise incorrecte"},{code:"429",status:"FAILED",bold:!1,msg:"Too Many Requests — ralentissez"},{code:"502",status:"FAILED",bold:!1,msg:"gateway_error — réseau de l'opérateur a rejeté le paiement"},{code:"500",status:"FAILED",bold:!1,msg:"server_error — erreur interne, réessayez"}].map((t,u)=>e.jsx(m,{cells:[e.jsx("span",{className:"font-mono font-semibold text-gray-800",children:t.code}),e.jsx("span",{className:t.bold?"font-bold text-gray-900":"text-gray-700",children:t.status}),t.msg]},u))})]}),e.jsx(l,{language:"json",code:`{
  "error": "bad_request",
  "message": "Champs requis : amount, currency, phone, operator, country_code"
}`}),e.jsxs("div",{className:"rounded border border-gray-200 bg-gray-50 p-4 mt-4 text-sm text-gray-700",children:["Pour toute question technique non résolue par cette documentation, contactez notre équipe via"," ",e.jsx(N,{href:"/dashboard/support",className:"text-primary hover:underline font-medium",children:"le support"}),"."]})]}),e.jsxs("section",{id:"sandbox",ref:t=>d.current.sandbox=t,children:[e.jsx(y,{children:"Sandbox & Tests"}),e.jsx("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-5",children:"Le testeur interactif appelle l'API Ashtech Pay avec votre propre clé et déclenche de vraies transactions auprès des opérateurs. Aucun environnement sandbox public, numéro de test ou code OTP universel n'est actuellement disponible."}),e.jsxs("div",{className:"rounded border border-orange-200 bg-orange-50 p-5 space-y-2",children:[e.jsx("p",{className:"text-sm font-semibold text-orange-800",children:"Avant de tester"}),e.jsx("ul",{className:"space-y-1.5 text-sm text-orange-800",children:["Utilisez uniquement une clé API activée sur un compte vérifié.","Saisissez un numéro réel appartenant au portefeuille Mobile Money choisi.","Pour un flux OTP, composez le code USSD indiqué par l'API ou attendez le SMS, puis saisissez le code réellement reçu.","Les frais opérateur et les changements d'état sont réels ; testez avec un petit montant."].map(t=>e.jsxs("li",{className:"flex items-start gap-2",children:[e.jsx(E,{className:"w-3.5 h-3.5 mt-0.5 text-orange-600 shrink-0"}),t]},t))})]}),e.jsxs("div",{className:"rounded border border-yellow-200 bg-yellow-50 p-5 space-y-2 mt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-yellow-800",children:"Expiration OTP"}),e.jsx("ul",{className:"space-y-1.5 text-sm text-yellow-800",children:["La session OTP est valide 15 minutes après la réponse 400 otp_required","Si le délai est dépassé, l'API retourne 400 otp_expired — relancez la requête sans otp pour démarrer une nouvelle session","Un même code OTP ne peut être utilisé qu'une seule fois (protection anti-rejeu)","Pour Orange BF, le code USSD contient le montant exact : *144*4*6*5000# pour 5000 XOF","Ne stockez jamais le code OTP côté serveur — il doit être saisi directement par le client"].map(t=>e.jsxs("li",{className:"flex items-start gap-2",children:[e.jsx(E,{className:"w-3.5 h-3.5 mt-0.5 text-yellow-600 shrink-0"}),t]},t))})]}),e.jsxs("div",{className:"rounded border border-purple-200 bg-purple-50 p-5 space-y-2 mt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-purple-800",children:"Flux Wave"}),e.jsxs("p",{className:"text-sm text-purple-800",children:["Si l'opérateur retourne un ",e.jsx(s,{children:"wave_url"}),", ouvrez-le pour valider ou refuser la transaction réelle. Le webhook ",e.jsx(s,{children:"payment.completed"})," ou ",e.jsx(s,{children:"payment.failed"})," est envoyé après la décision du client."]})]}),e.jsx("div",{className:"mt-6",children:e.jsx(N,{href:"/docs/test-pay",children:e.jsxs(_,{className:"gap-2","data-testid":"link-test-payment-sandbox",children:[e.jsx(A,{className:"w-4 h-4"}),"Ouvrir le testeur API"]})})})]}),e.jsx("div",{className:"h-20"})]})]})]})}export{he as default};
