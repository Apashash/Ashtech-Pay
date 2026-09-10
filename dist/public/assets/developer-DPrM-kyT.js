import{b as I,j as e}from"./vendor-query-xtullyqD.js";import{bL as T,k as F,a$ as E,aj as U,j as z,be as L,by as B,E as X,d as q,bs as Y,a2 as S,ag as N,b as W,K as G,R as K,bx as H,au as J,t as M,am as Q,bv as V,q as $,M as Z}from"./vendor-misc-DfAJR8t0.js";import{B as R}from"./badge-CZztOlJW.js";import{B as w}from"./index-BhRb3AIp.js";import{a as ee}from"./pdf-docs-Bn6c02sb.js";import"./vendor-ui-MWtFJhSW.js";import"./vendor-charts-D9qxrepS.js";import"./jspdf.es.min-BRkD3fGG.js";const k=[{id:"introduction",label:"Introduction",icon:F},{id:"authentication",label:"Authentification",icon:E},{id:"countries",label:"GET /v1/countries",icon:U},{id:"crypto",label:"Pay-In Crypto",icon:z},{id:"collect",label:"POST /v1/collect",icon:L},{id:"flows",label:"Flux de paiement",icon:B},{id:"transaction",label:"GET /v1/transaction",icon:X},{id:"fees",label:"GET /v1/fees",icon:q},{id:"webhooks",label:"Webhooks",icon:Y},{id:"errors",label:"Codes d'erreur",icon:q},{id:"sandbox",label:"Sandbox & Tests",icon:S}],se=[{code:"BJ",name:"Bénin",currency:"XOF",operators:["Celtiis Money","Coris Money","Moov Money","MTN Money"],otpOps:[]},{code:"BF",name:"Burkina Faso",currency:"XOF",operators:["Moov Money","Orange Money","Wallet LigdiCash"],otpOps:["Orange Money"]},{code:"CM",name:"Cameroun",currency:"XAF",operators:["MTN Money","Orange Money"],otpOps:[]},{code:"CI",name:"Côte d'Ivoire",currency:"XOF",operators:["Moov Money","MTN Money","Orange Money","Wave Money"],otpOps:["Orange Money"]},{code:"GA",name:"Gabon",currency:"XAF",operators:["Airtel Money","Moov Money"],otpOps:[]},{code:"ML",name:"Mali",currency:"XOF",operators:["Moov Money","Orange Money"],otpOps:[]},{code:"NE",name:"Niger",currency:"XOF",operators:["Airtel Money"],otpOps:[]},{code:"CD",name:"RD Congo",currency:"CDF",operators:["Afri Money","Airtel Money","Mpesa Money","Orange Money","Vodacom"],otpOps:[]},{code:"SN",name:"Sénégal",currency:"XOF",operators:["E-money","Free Money","Orange Money","Wave Money"],otpOps:["Orange Money"]},{code:"TG",name:"Togo",currency:"XOF",operators:["Flooz (Moov)","T-Money"],otpOps:[]}];function te(a){const n=[];let i=0;for(;i<a.length;)if(a[i]==='"'){let r=i+1;for(;r<a.length;){if(a[r]==="\\"){r+=2;continue}if(a[r]==='"'){r++;break}r++}const y=a.slice(i,r);let c=r;for(;c<a.length&&(a[c]===" "||a[c]==="	");)c++;n.push({t:y,c:a[c]===":"?"#f47067":"#57ab5a"}),i=r}else if(a[i]>="0"&&a[i]<="9"||a[i]==="-"&&i+1<a.length&&a[i+1]>="0"&&a[i+1]<="9"){let r=i+(a[i]==="-"?1:0);for(;r<a.length&&(a[r]>="0"&&a[r]<="9"||a[r]==="."||a[r]==="e"||a[r]==="E");)r++;n.push({t:a.slice(i,r),c:"#6cb6ff"}),i=r}else a.startsWith("true",i)?(n.push({t:"true",c:"#f69d50"}),i+=4):a.startsWith("false",i)?(n.push({t:"false",c:"#f69d50"}),i+=5):a.startsWith("null",i)?(n.push({t:"null",c:"#f69d50"}),i+=4):(n.push({t:a[i],c:"#adbac7"}),i++);return n}function ae(a){const n=[];return a.split(`
`).forEach((r,y)=>{if(y>0&&n.push({t:`
`,c:""}),r.trimStart().startsWith("#")){n.push({t:r,c:"#768390"});return}let c=0;for(;c<r.length;){if(r[c]===" "||r[c]==="	"){let l=c;for(;l<r.length&&(r[l]===" "||r[l]==="	");)l++;n.push({t:r.slice(c,l),c:"#adbac7"}),c=l;continue}if(r[c]==="\\"){n.push({t:"\\",c:"#768390"}),c++;continue}if(r[c]==="'"){let l=c+1;for(;l<r.length&&r[l]!=="'";)l++;n.push({t:r.slice(c,l+1),c:"#57ab5a"}),c=l+1;continue}if(r[c]==='"'){let l=c+1;for(;l<r.length&&(r[l]!=='"'||r[l-1]==="\\");)l++;n.push({t:r.slice(c,l+1),c:"#57ab5a"}),c=l+1;continue}if(r[c]==="-"){let l=c;for(;l<r.length&&r[l]!==" "&&r[l]!=="	"&&r[l]!=="'"&&r[l]!=='"';)l++;n.push({t:r.slice(c,l),c:"#768390"}),c=l;continue}let x=c;for(;x<r.length&&r[x]!==" "&&r[x]!=="	"&&r[x]!=="'"&&r[x]!=='"'&&r[x]!=="\\";)x++;const d=r.slice(c,x),O=["POST","GET","DELETE","PUT","PATCH"].includes(d)?"#f47067":null;n.push({t:d,c:O??(d==="curl"||d.startsWith("http")?"#79c0ff":"#cdd9e5")}),c=x}}),n}function re(a){return a.map((n,i)=>n.c?e.jsx("span",{style:{color:n.c},children:n.t},i):n.t)}function o({code:a,language:n="json"}){const[i,r]=T.useState(!1),[y,c]=T.useState(!1);function x(){navigator.clipboard.writeText(a.trim()),r(!0),setTimeout(()=>r(!1),2e3)}const d={json:"json",javascript:"Node.js",http:"HTTP",bash:"curl",php:"PHP",python:"Python"},O=n==="json"?te(a.trim()):n==="bash"?ae(a.trim()):[{t:a.trim(),c:"#cdd9e5"}];return e.jsxs("div",{className:"rounded-lg overflow-hidden border border-[#3a3a3a] w-full min-w-0 max-w-full",children:[e.jsxs("div",{className:"flex items-center justify-between px-3 py-2 bg-[#2b2b2b] border-b border-[#3a3a3a]",children:[e.jsx("span",{className:"text-[11px] font-mono font-medium text-[#d0d0d0] bg-[#3d3d3d] px-2.5 py-0.5 rounded",children:d[n]??n}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:()=>c(l=>!l),title:"Toggle wrap",className:`text-[#888] hover:text-[#ccc] transition-colors ${y?"text-[#ccc]":""}`,"data-testid":"button-wrap-code",children:e.jsx(V,{className:"w-3.5 h-3.5"})}),e.jsx("button",{onClick:x,className:"text-[#888] hover:text-[#ccc] transition-colors","data-testid":"button-copy-code",children:i?e.jsx($,{className:"w-3.5 h-3.5 text-emerald-400"}):e.jsx(Z,{className:"w-3.5 h-3.5"})})]})]}),e.jsx("div",{className:"overflow-x-auto w-full max-w-full bg-[#1a1a1a]",children:e.jsx("pre",{className:`px-4 py-3.5 leading-relaxed ${y?"w-full whitespace-pre-wrap break-all":"w-max min-w-full whitespace-pre"}`,children:e.jsx("code",{className:"font-mono text-[13px]",children:re(O)})})})]})}function j({children:a}){return e.jsx("div",{className:"overflow-x-auto w-full border border-gray-300 rounded",children:e.jsx("table",{className:"w-full text-sm min-w-[400px] border-collapse",children:a})})}function f({cols:a}){return e.jsx("thead",{children:e.jsx("tr",{children:a.map(n=>e.jsx("th",{className:"px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-300 whitespace-nowrap",children:n},n))})})}function p({cells:a}){return e.jsx("tr",{className:"border-b border-gray-200 last:border-b-0",children:a.map((n,i)=>e.jsx("td",{className:"px-4 py-3 text-sm text-gray-700 align-top",children:n},i))})}function t({children:a}){return e.jsx("code",{className:"font-mono text-[12px] bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-gray-800",children:a})}function ne({m:a}){const n={POST:"text-[#e07a10] font-bold",GET:"text-[#2b7fd4] font-bold",DELETE:"text-[#dc2626] font-bold"};return e.jsx("span",{className:`font-mono text-sm ${n[a]??"text-gray-700 font-bold"}`,children:a})}function _({method:a,path:n,auth:i=!0}){return e.jsxs("div",{className:"flex items-center gap-3 py-3 border-t border-b border-gray-200 my-4",children:[e.jsx(ne,{m:a}),e.jsx("span",{className:"font-mono text-sm text-gray-800 font-semibold",children:n}),i&&e.jsx(Q,{className:"w-3.5 h-3.5 text-gray-400 ml-auto shrink-0"})]})}function b(){return e.jsxs("div",{className:"mt-4 space-y-1",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:"text-xs font-bold tracking-widest text-gray-700 uppercase",children:"AUTHORIZATION"}),e.jsx("span",{className:"text-xs text-gray-400",children:"Bearer Token"})]}),e.jsx("div",{children:e.jsx("span",{className:"text-xs font-semibold text-gray-700",children:"Token"})})]})}function g({id:a,children:n}){return e.jsx("div",{id:a,className:"border-t border-gray-200 pt-10 scroll-mt-20",children:e.jsx("h2",{className:"text-2xl font-bold text-gray-900 tracking-wide uppercase mb-4",children:n})})}function h({children:a}){return e.jsx("h3",{className:"text-base font-bold text-gray-900 mt-6 mb-2",children:a})}function xe({publicMode:a=!1}){const[n,i]=T.useState("introduction"),[r,y]=T.useState(!1),[c,x]=T.useState(!1),d=T.useRef({});function O(){x(!0),setTimeout(()=>{ee(),x(!1)},50)}const{data:l}=I({queryKey:["/api/user/api-key"],enabled:!a});l?.apiKey;const A=se;T.useEffect(()=>{const s=new IntersectionObserver(u=>{for(const m of u)m.isIntersecting&&i(m.target.id)},{rootMargin:"-20% 0px -70% 0px"});for(const u of k){const m=document.getElementById(u.id);m&&s.observe(m)}return()=>s.disconnect()},[]);function D(s){document.getElementById(s)?.scrollIntoView({behavior:"smooth"}),y(!1)}return e.jsxs("div",{className:"min-h-screen bg-white text-gray-900 flex flex-col overflow-x-hidden",style:{fontFamily:"system-ui, -apple-system, 'Segoe UI', sans-serif"},children:[e.jsx("header",{className:"sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm",children:e.jsxs("div",{className:"max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4",children:[e.jsxs("div",{className:"flex items-center gap-3 min-w-0",children:[e.jsx(N,{href:a?"/":"/dashboard/api-keys",children:e.jsxs(w,{variant:"ghost",size:"sm",className:"text-gray-500 hover:text-gray-900 -ml-2 gap-1.5 shrink-0","data-testid":"link-back-api",children:[e.jsx(W,{className:"w-4 h-4"}),e.jsx("span",{className:"hidden sm:inline",children:a?"Accueil":"Retour"})]})}),e.jsx("div",{className:"h-5 w-px bg-gray-200 shrink-0"}),e.jsxs("div",{className:"flex items-center gap-2 min-w-0",children:[e.jsx("div",{className:"w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0",children:e.jsx(G,{className:"w-4 h-4 text-primary-foreground"})}),e.jsx("span",{className:"font-semibold text-sm text-gray-900 truncate",children:"Ashtech Pay"}),e.jsx(R,{variant:"outline",className:"text-[10px] hidden sm:flex shrink-0",children:"API v1"})]})]}),e.jsxs("div",{className:"flex items-center gap-2 shrink-0",children:[a&&e.jsxs("div",{className:"hidden sm:flex items-center gap-2",children:[e.jsx(N,{href:"/login",children:e.jsx(w,{variant:"ghost",size:"sm",className:"text-gray-500 hover:text-gray-900 text-xs","data-testid":"link-login",children:"Connexion"})}),e.jsx(N,{href:"/register",children:e.jsx(w,{size:"sm",className:"text-xs","data-testid":"link-register",children:"S'inscrire"})})]}),e.jsx(N,{href:"/docs/test-pay",children:e.jsxs(w,{size:"sm",className:"gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs hidden sm:flex","data-testid":"link-test-api",children:[e.jsx(S,{className:"w-3.5 h-3.5"}),"Tester l'API"]})}),e.jsxs(w,{variant:"outline",size:"sm",onClick:O,disabled:c,className:"flex gap-1.5 text-gray-700 text-xs","data-testid":"button-download-pdf-sdk",children:[e.jsx(K,{className:"w-3.5 h-3.5"}),e.jsx("span",{className:"hidden sm:inline",children:c?"Génération…":"Télécharger PDF"}),e.jsx("span",{className:"sm:hidden",children:c?"…":"PDF"})]}),e.jsx("button",{className:"lg:hidden text-gray-600 hover:text-gray-900",onClick:()=>y(s=>!s),"data-testid":"button-toggle-mobile-nav",children:r?e.jsx(H,{className:"w-5 h-5"}):e.jsx(J,{className:"w-5 h-5"})})]})]})}),e.jsxs("div",{className:"flex flex-1 max-w-7xl mx-auto w-full min-w-0",children:[e.jsx("aside",{className:`
          ${r?"fixed inset-0 z-30 bg-white pt-14 px-4":"hidden"}
          lg:relative lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:border-r lg:border-gray-200
          lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto
        `,children:e.jsxs("nav",{className:"py-6 space-y-0.5 lg:px-4",children:[e.jsx("p",{className:"text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3 px-2",children:"Documentation"}),k.map(({id:s,label:u,icon:m})=>e.jsxs("button",{onClick:()=>D(s),"data-testid":`nav-${s}`,className:`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-all text-left ${n===s?"bg-primary/10 text-primary font-semibold":"text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`,children:[e.jsx(m,{className:"w-3.5 h-3.5 shrink-0"}),e.jsx("span",{className:"truncate",children:u})]},s)),e.jsx("div",{className:"my-4 h-px bg-gray-200"}),e.jsxs("div",{className:"px-3 py-3 rounded border border-gray-200 space-y-1",children:[e.jsx("p",{className:"text-[11px] font-medium text-gray-500",children:"Votre clé API"}),e.jsx("p",{className:"text-xs font-mono text-gray-400 tracking-wider",children:"•".repeat(28)})]})]})}),e.jsxs("main",{className:"flex-1 min-w-0 w-full px-5 py-10 lg:px-12 xl:px-16 overflow-x-hidden",children:[e.jsx("div",{className:"mb-8",children:e.jsxs("h1",{className:"text-4xl font-bold text-gray-900 leading-tight",children:["Ashtech Pay API",e.jsx("br",{}),"Documentation"]})}),e.jsxs("section",{id:"introduction",ref:s=>d.current.introduction=s,className:"scroll-mt-20",children:[e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-6",children:["L'",e.jsx("strong",{children:"Ashtech Pay API"})," unifie plusieurs passerelles de paiement africaines en une seule interface REST. Elle propose un endpoint de production pour les transactions réelles, permettant d'initialiser des paiements Mobile Money dans"," ",e.jsxs("strong",{children:[A.length,"+ pays africains"]})," sans redirection. Le routage entre opérateurs est automatique."]}),e.jsx(h,{children:"Payment API Overview"}),e.jsx("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-6",children:"L'Ashtech Pay API permet aux marchands d'intégrer facilement des capacités de paiement dans leurs systèmes. Elle supporte les opérations clés telles que le traitement des transactions, la consultation des statuts de paiement, et la réception de notifications sur les mises à jour de transactions. Cela garantit des flux de paiement fluides et efficaces, améliorant l'expérience utilisateur globale dans vos applications."}),e.jsxs("div",{className:"flex items-center justify-between gap-4 rounded border border-primary/20 bg-primary/5 px-5 py-4 mb-6",children:[e.jsxs("div",{className:"space-y-0.5",children:[e.jsx("p",{className:"text-sm font-semibold text-gray-900",children:"Prêt à tester ?"}),e.jsx("p",{className:"text-xs text-gray-600",children:"Initialisez un paiement réel et suivez son statut depuis l'API."})]}),e.jsx(N,{href:"/docs/test-pay",children:e.jsxs(w,{size:"sm",className:"gap-2 shrink-0 whitespace-nowrap","data-testid":"cta-test-api",children:[e.jsx(S,{className:"w-3.5 h-3.5"}),"Tester l'API"]})})]}),e.jsxs("div",{className:"rounded border border-gray-200 bg-gray-50 p-5 space-y-2 mb-2",children:[e.jsx("p",{className:"text-xs font-semibold uppercase tracking-widest text-gray-500",children:"URL de base"}),e.jsxs("div",{className:"flex items-center gap-3 flex-wrap",children:[e.jsx("code",{className:"text-base font-mono font-semibold text-blue-700 break-all",children:"https://ashtechpay.top"}),e.jsx(R,{variant:"outline",className:"border-green-500/30 text-green-700 text-[10px] shrink-0",children:"v1"})]}),e.jsx("p",{className:"text-xs text-gray-500",children:"Toutes les requêtes doivent être envoyées en HTTPS. Réponses JSON uniquement."})]})]}),e.jsxs("section",{id:"authentication",ref:s=>d.current.authentication=s,children:[e.jsx(g,{children:"Access TOKEN"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-5",children:["Toutes les transactions effectuées sur Ashtech Pay nécessitent un token de sécurité valide pour identifier et connecter le client à nos APIs. Vous pouvez obtenir votre clé API (",e.jsx(t,{children:"api_key"}),") depuis votre tableau de bord marchand Ashtech Pay."]}),e.jsx(_,{method:"POST",path:"Authorization: Bearer YOUR_API_KEY"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Incluez votre clé API dans l'en-tête HTTP ",e.jsx(t,{children:"Authorization"})," de chaque requête."]}),e.jsx(o,{language:"http",code:"Authorization: Bearer YOUR_API_KEY"}),e.jsxs("div",{className:"flex gap-3 items-start rounded border border-orange-300 bg-orange-50 p-4 my-4",children:[e.jsx("span",{className:"text-orange-500 mt-0.5 shrink-0 font-bold",children:"⚠"}),e.jsxs("p",{className:"text-sm text-orange-800",children:["Utilisez votre clé API ",e.jsx("strong",{children:"uniquement depuis votre serveur"})," (Node.js, Python, PHP…). Ne l'incluez jamais dans du code côté navigateur ou application mobile."]})]}),e.jsx(h,{children:"Exemple d'appel authentifié (Node.js)"}),e.jsx(o,{language:"javascript",code:`const response = await fetch("https://ashtechpay.top/v1/collect", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ /* ... */ })
});`}),e.jsx(b,{})]}),e.jsxs("section",{id:"countries",ref:s=>d.current.countries=s,children:[e.jsx(g,{children:"Pays et Opérateurs"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Retourne la liste complète des pays actifs et leurs opérateurs Mobile Money disponibles. Cette liste est ",e.jsx("strong",{children:"gérée par l'administrateur"})," — tout ajout ou retrait est immédiatement visible via cet endpoint. Utilisez-le pour peupler dynamiquement votre interface de paiement."]}),e.jsx(_,{method:"GET",path:"/v1/countries"}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mb-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(o,{language:"javascript",code:`fetch("https://ashtechpay.top/v1/countries", {
  headers: {
    "Authorization": "Bearer YOUR_API_KEY"
  }
})`}),e.jsx(o,{language:"bash",code:`curl https://ashtechpay.top/v1/countries \\
  -H "Authorization: Bearer YOUR_API_KEY"`})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse"}),e.jsx(o,{language:"json",code:`[
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
]`})]})]}),e.jsxs(h,{children:["Pays disponibles (",A.length,") — mis à jour en temps réel"]}),e.jsxs(j,{children:[e.jsx(f,{cols:["Pays","Code","Devise","Opérateurs","OTP Required"]}),e.jsx("tbody",{children:A.map(({code:s,name:u,currency:m,operators:C,otpOps:P})=>e.jsx(p,{cells:[e.jsx("span",{className:"font-medium",children:u}),e.jsx(t,{children:s}),e.jsx(t,{children:m}),e.jsx("span",{className:"flex flex-wrap gap-1",children:C.map(v=>e.jsxs("span",{className:`text-[11px] px-1.5 py-0.5 rounded border ${v.toLowerCase().includes("wave")?"bg-purple-50 text-purple-700 border-purple-200":P.includes(v)?"bg-amber-50 text-amber-700 border-amber-200":"bg-white text-gray-600 border-gray-200"}`,children:[v,P.includes(v)&&!v.toLowerCase().includes("wave")?" ⚡":"",v.toLowerCase().includes("wave")?" 🔗":""]},v))}),P.length>0?e.jsxs("span",{className:"text-amber-700 font-semibold text-xs",children:["Yes — ",P.join(", ")]}):e.jsx("span",{className:"text-gray-500 text-xs",children:"No"})]},s))})]}),e.jsxs("div",{className:"flex flex-wrap gap-4 text-xs text-gray-500 mt-2",children:[e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"w-3 h-3 rounded-full bg-gray-200 inline-block"})," USSD Push — pas d'OTP"]}),e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"w-3 h-3 rounded-full bg-amber-200 inline-block"})," ⚡ OTP requis"]}),e.jsxs("span",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"w-3 h-3 rounded-full bg-purple-200 inline-block"})," 🔗 Wave — lien de paiement"]})]}),e.jsx(b,{})]}),e.jsxs("section",{id:"crypto",ref:s=>d.current.crypto=s,children:[e.jsx(g,{children:"Pay-In Crypto"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Créez une adresse de dépôt unique pour recevoir un paiement crypto avec la même clé API",e.jsx(t,{children:"ak_…"}),". Ce flux est séparé de ",e.jsx(t,{children:"/v1/collect"})," : vos intégrations Mobile Money existantes ne changent pas."]}),e.jsxs("div",{className:"rounded border border-green-300 bg-green-50 p-4 space-y-1 mb-5",children:[e.jsx("p",{className:"text-sm font-semibold text-green-900",children:"Confirmation, crédit et webhook"}),e.jsxs("p",{className:"text-sm text-green-800 leading-relaxed",children:["Après la création, le prestataire crypto notifie Ashtech Pay, puis Ashtech Pay passe la transaction à"," ",e.jsx(t,{children:"completed"}),", crédite automatiquement le wallet USDT du marchand avec"," ",e.jsx(t,{children:"credited_amount_usdt"})," et envoie un POST à votre ",e.jsx(t,{children:"notify_url"}),"."]})]}),e.jsx(_,{method:"GET",path:"/v1/crypto/assets"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Retourne uniquement les réseaux crypto actifs et autorisés. Utilisez la valeur",e.jsx(t,{children:"asset_code"})," retournée dans l'appel de création."]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mb-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(o,{language:"bash",code:`curl https://ashtechpay.top/v1/crypto/assets \\
  -H "Authorization: Bearer YOUR_API_KEY"`})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse"}),e.jsx(o,{language:"json",code:`{
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
}`})]})]}),e.jsx(_,{method:"POST",path:"/v1/crypto/collect"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["L'API accepte un montant en ",e.jsx("strong",{children:"USDT"})," ou dans une devise fiat supportée (",e.jsx(t,{children:"XAF"}),", ",e.jsx(t,{children:"XOF"}),", ",e.jsx(t,{children:"CDF"})," ou ",e.jsx(t,{children:"USD"}),"). Les devises fiat sont converties en USDT avec le taux USDT/XAF.",e.jsx(t,{children:"amount"})," est le montant brut ; ",e.jsx(t,{children:"credited_amount_usdt"})," est le net après frais."]}),e.jsxs("div",{className:"rounded border border-blue-300 bg-blue-50 p-4 mb-5",children:[e.jsx("p",{className:"text-sm font-semibold text-blue-900 mb-1",children:"Comment afficher l'adresse et le QR code ?"}),e.jsxs("p",{className:"text-sm text-blue-800 leading-relaxed",children:["La réponse ",e.jsx("strong",{children:"202"})," contient l'adresse unique dans ",e.jsx(t,{children:"address"})," et, pour certains réseaux, le"," ",e.jsx(t,{children:"memo"})," ou le ",e.jsx(t,{children:"tag"}),". Ashtech Pay ne renvoie pas d'image QR : votre interface génère le QR localement à partir de ces valeurs."]})]}),e.jsx(h,{children:"Paramètres"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Paramètre","Required","Description"]}),e.jsx("tbody",{children:[{name:"amount",req:!0,desc:"Montant brut à recevoir, en currency."},{name:"currency",req:!0,desc:"USDT, XAF, XOF, CDF, USD."},{name:"asset_code",req:!0,desc:"Réseau retourné par GET /v1/crypto/assets, ex. USDT.TRC20."},{name:"reference",req:!1,desc:"Référence de votre commande ; générée si absente."},{name:"notify_url",req:!1,desc:"URL HTTPS recevant payment.completed ou payment.failed."},{name:"customer",req:!1,desc:"email, firstName et lastName du payeur."},{name:"refund_address",req:!1,desc:"Adresse de remboursement fournie au prestataire."}].map(s=>e.jsx(p,{cells:[e.jsx(t,{children:s.name}),s.req?e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Yes"}):e.jsx("span",{className:"text-gray-400 text-xs",children:"No"}),s.desc]},s.name))})]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mt-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(o,{language:"javascript",code:`fetch("https://ashtechpay.top/v1/crypto/collect", {
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
})`})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse 202"}),e.jsx(o,{language:"json",code:`{
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
}`})]})]}),e.jsx(h,{children:"Exemple complet — afficher l'adresse, le memo et le QR"}),e.jsxs("p",{className:"text-sm text-gray-700 mb-2 leading-relaxed",children:["Installez une bibliothèque QR dans votre interface, par exemple"," ",e.jsx(t,{children:"npm install qrcode"}),". Pour USDT/TRC20, le QR peut contenir directement l'adresse. Pour un réseau avec memo/tag, utilisez uniquement une URI officiellement supportée."]}),e.jsx(o,{language:"javascript",code:`import QRCode from "qrcode";

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
//         #crypto-qr (canvas) et #crypto-memo`}),e.jsxs("div",{className:"rounded border border-amber-300 bg-amber-50 p-4 mt-4 space-y-1",children:[e.jsx("p",{className:"text-sm font-semibold text-amber-800",children:"Important — memo / tag"}),e.jsxs("p",{className:"text-sm text-amber-800 leading-relaxed",children:["Ne concaténez jamais le memo à l'adresse. ",e.jsx(t,{children:"memo_required"})," indique si le champ est obligatoire et ",e.jsx(t,{children:"memo_type"})," précise ",e.jsx(t,{children:"memo"})," ou ",e.jsx(t,{children:"tag"}),". Un memo/tag manquant peut empêcher l'attribution du paiement. L'adresse est à usage unique pour cette transaction."]})]}),e.jsxs("div",{className:"rounded border border-red-300 bg-red-50 p-4 mt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-red-900 mb-1",children:"Erreurs de création et diagnostic"}),e.jsxs("p",{className:"text-sm text-red-800 leading-relaxed",children:["Une réponse ",e.jsx(t,{children:"502 gateway_error"})," signifie que l'adresse n'a pas pu être générée.",e.jsx(t,{children:"provider_invalid_response"})," signifie que le service a répondu sans adresse exploitable. Une réponse ",e.jsx(t,{children:"500 server_error"})," contient un ",e.jsx(t,{children:"request_id"})," : conservez-le pour le diagnostic."]})]}),e.jsxs("div",{className:"rounded border border-gray-200 bg-gray-50 p-4 mt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-gray-900 mb-1",children:"Après l'affichage : attendre la confirmation"}),e.jsxs("p",{className:"text-sm text-gray-700 leading-relaxed",children:["La création de l'adresse ne signifie pas que le paiement est confirmé. Gardez"," ",e.jsx(t,{children:"transaction_id"})," et ",e.jsx(t,{children:"reference"}),", attendez le webhook ",e.jsx(t,{children:"payment.completed"})," ou"," ",e.jsx(t,{children:"payment.failed"}),", et utilisez ",e.jsx(t,{children:"GET /v1/transaction/:id"})," comme vérification complémentaire. Ne livrez jamais un produit avec le seul statut ",e.jsx(t,{children:"pending"}),"."]})]}),e.jsx(b,{})]}),e.jsxs("section",{id:"collect",ref:s=>d.current.collect=s,children:[e.jsx(g,{children:"Initier un paiement"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Initie un paiement Mobile Money via l'Ashtech Pay API. Le routage entre fournisseurs est automatique selon le pays et l'opérateur. Le client reçoit une demande de validation sur son téléphone (USSD, OTP ou Wave selon l'opérateur). Les frais sont configurés par l'administrateur et déduits automatiquement — le ",e.jsx(t,{children:"credited_amount"})," correspond au montant net crédité sur votre compte. Consultez ",e.jsx(t,{children:"GET /v1/fees"})," pour les frais actuels."]}),e.jsx(_,{method:"POST",path:"/v1/collect"}),e.jsx(h,{children:"Corps de la requête (JSON)"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Paramètre","Type","Statut","Description"]}),e.jsxs("tbody",{children:[e.jsx(p,{cells:[e.jsx(t,{children:"amount"}),"number",e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Requis"}),"Montant brut à collecter"]}),e.jsx(p,{cells:[e.jsx(t,{children:"currency"}),"string",e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Requis"}),"Devise du pays (XAF, XOF, CDF…)"]}),e.jsx(p,{cells:[e.jsx(t,{children:"phone"}),"string",e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Requis"}),"Numéro de téléphone du payeur"]}),e.jsx(p,{cells:[e.jsx(t,{children:"operator"}),"string",e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Requis"}),"Nom exact de l'opérateur (depuis /v1/countries)"]}),e.jsx(p,{cells:[e.jsx(t,{children:"country_code"}),"string",e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Requis"}),"Code ISO du pays (CM, SN, CI…)"]}),e.jsx(p,{cells:[e.jsx(t,{children:"reference"}),"string",e.jsx("span",{className:"text-gray-400 text-xs",children:"Optionnel"}),"Référence unique de votre commande. Obligatoire lors du retry OTP : renvoyer la valeur reçue dans la réponse 400."]}),e.jsx(p,{cells:[e.jsx(t,{children:"otp"}),"string",e.jsx("span",{className:"text-gray-400 text-xs",children:"Optionnel"}),"Code OTP reçu par SMS. Doit toujours être accompagné du champ reference (valeur reçue dans le 400 otp_required)."]}),e.jsx(p,{cells:[e.jsx(t,{children:"notify_url"}),"string",e.jsx("span",{className:"text-gray-400 text-xs",children:"Optionnel"}),"URL webhook pour recevoir le résultat du paiement"]})]})]}),e.jsx(b,{}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mt-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(o,{language:"javascript",code:`fetch("https://ashtechpay.top/v1/collect", {
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
})`}),e.jsx(o,{language:"bash",code:`curl https://ashtechpay.top/v1/collect \\
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
  }'`})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse (202)"}),e.jsx(o,{language:"json",code:`{
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
}`})]})]}),e.jsxs("div",{className:"rounded border border-yellow-300 bg-yellow-50 p-4 mt-5 space-y-3",children:[e.jsx("p",{className:"text-sm font-semibold text-yellow-800",children:"OTP requis — deux variantes selon l'opérateur"}),e.jsxs("p",{className:"text-sm text-yellow-800 leading-relaxed",children:["Certains opérateurs nécessitent un code OTP. L'API retourne"," ",e.jsx(t,{children:"400 otp_required"})," avec un champ ",e.jsx(t,{children:"reference"})," et un champ ",e.jsx(t,{children:"ussd_code"}),". Il existe deux variantes :"," ",e.jsx("strong",{children:"OTP USSD"})," ","(Orange CI, SN, BF — le client compose le code USSD affiché, l'OTP s'affiche dans le menu téléphonique,"," ",e.jsx("em",{children:"aucun SMS n'est envoyé"}),") et"," ",e.jsx("strong",{children:"OTP SMS"})," ","(certains opérateurs — SMS déclenché automatiquement, ",e.jsx(t,{children:"ussd_code"})," est null). Dans les deux cas, relancez la requête avec ",e.jsx(t,{children:"otp"})," ",e.jsx("strong",{children:"et"})," ",e.jsx(t,{children:"reference"}),"."]}),e.jsx(h,{children:"Opérateur Orange — disponibilité et OTP"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Operator","otp_code","Phone Code","Payment Method","Payin","Payout","Available","Currency"]}),e.jsx("tbody",{children:[{phone:"+225",otp:"Required",currency:"XOF"},{phone:"+226",otp:"Required",currency:"XOF"},{phone:"+223",otp:"No",currency:"XOF"},{phone:"+221",otp:"Required",currency:"XOF"},{phone:"+224",otp:"Required",currency:"GNF"},{phone:"+237",otp:"No",currency:"XAF"},{phone:"+243",otp:"No",currency:"CDF"}].map(({phone:s,otp:u,currency:m})=>e.jsx(p,{cells:[e.jsx("span",{className:"font-medium",children:"Orange"}),e.jsx("span",{className:u==="Required"?"text-green-700 font-semibold":"text-gray-700",children:u}),e.jsx(t,{children:s}),e.jsx("span",{className:"font-mono text-xs",children:"orange"}),e.jsx("span",{className:"text-green-700 font-semibold",children:"Yes"}),e.jsx("span",{className:"text-green-700 font-semibold",children:"Yes"}),e.jsx("span",{className:"text-green-700 font-semibold",children:"Yes"}),e.jsx(t,{children:m})]},s))})]}),e.jsx(o,{language:"json",code:`// Étape 1 — Requête initiale (sans otp) → réponse 400
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
// → 202 pending → webhook payment.completed`})]})]}),e.jsxs("section",{id:"flows",ref:s=>d.current.flows=s,children:[e.jsx(g,{children:"Flux de Paiement"}),e.jsx("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-5",children:"Selon le pays et l'opérateur, l'API utilise automatiquement l'un des 4 flux ci-dessous. Votre code doit gérer chacun différemment car la réponse et les étapes varient."}),e.jsxs(j,{children:[e.jsx(f,{cols:["Flux","Opérateurs concernés","Réponse initiale","Action requise"]}),e.jsx("tbody",{children:[{name:"USSD Push",color:"text-blue-700",ops:"MTN, Moov, Airtel, Orange, Free, E-money, T-Money, Flooz, M-Pesa, Afri Money…",resp:"202 pending",rcolor:"text-green-700",action:"Attendre le webhook. Le client valide directement sur son téléphone."},{name:"OTP USSD",color:"text-orange-700",ops:"Orange Money CI (#144*82#), SN (#144*391#), BF (*144*4*6*montant#)",resp:'400 otp_required  ussd_code: "#144*82#"',rcolor:"text-orange-700",action:"Afficher le ussd_code au client — il compose, l'OTP s'affiche dans le menu USSD. Relancer avec otp + reference."},{name:"OTP SMS",color:"text-yellow-700",ops:"Certains opérateurs — SMS envoyé automatiquement",resp:"400 otp_required  ussd_code: null",rcolor:"text-orange-700",action:"Le fournisseur envoie le SMS OTP. Relancer avec otp + reference."},{name:"Wave",color:"text-purple-700",ops:"Wave (CI), Wave (SN)",resp:'202 pending  flow: "wave", wave_url: "..."',rcolor:"text-purple-700",action:"Afficher le wave_url en bouton ou QR code. Le client ouvre Wave pour confirmer."}].map(s=>e.jsx(p,{cells:[e.jsx("span",{className:`font-semibold text-sm ${s.color}`,children:s.name}),s.ops,e.jsx("code",{className:`font-mono text-xs whitespace-pre-line ${s.rcolor}`,children:s.resp}),s.action]},s.name))})]}),e.jsxs("div",{className:"rounded border border-blue-200 bg-blue-50 p-5 space-y-4 mt-6",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0",children:"1"}),e.jsx("h3",{className:"font-bold text-blue-800",children:"Flux USSD Push — La majorité des opérateurs"})]}),e.jsxs("p",{className:"text-sm text-gray-700",children:["Flux le plus simple. Le client reçoit une demande USSD sur son téléphone et valide en composant son PIN. Vous recevez la confirmation par webhook. ",e.jsx("strong",{children:"Pas d'OTP à gérer côté merchant."})]}),e.jsxs("div",{className:"text-xs text-gray-600",children:[e.jsx("strong",{children:"Exemples :"})," ","MTN (CM, BJ, CG, GN, CD), Moov (BJ, CI, BF, GA, ML, TG), Airtel (CG, GA, NE, CD, TD), Orange (CM), Free Money (SN), E-money (SN), T-Money (TG), Flooz (TG), Mpesa Money (CD), Afri Money (CD), Vodacom (CD)"]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-4 min-w-0 [&>div]:min-w-0",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Requête"}),e.jsx(o,{language:"javascript",code:`// Orange Money Cameroun — flux USSD push
const res = await fetch("https://ashtechpay.top/v1/collect", {
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
// → Attendre le webhook payment.completed / payment.failed`})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Réponse 202"}),e.jsx(o,{language:"json",code:`{
  "transaction_id": "abc-123",
  "status": "pending",
  "amount": 5000,
  "credited_amount": 4750,
  "fee_amount": 250,
  "currency": "XAF"
}

// Le client reçoit la demande USSD
// sur son téléphone → valide avec PIN
// Webhook envoyé à notify_url`})]})]})]}),e.jsxs("div",{className:"rounded border border-orange-200 bg-orange-50 p-5 space-y-4 mt-4",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white shrink-0",children:"2"}),e.jsx("h3",{className:"font-bold text-orange-800",children:"Flux OTP USSD — Orange Money CI, SN, BF"})]}),e.jsxs("p",{className:"text-sm text-gray-700",children:["Pour Orange Money en Côte d'Ivoire, Sénégal et Burkina Faso. L'API retourne un ",e.jsx(t,{children:"ussd_code"})," ","que le client compose depuis son téléphone — l'OTP s'affiche directement dans le menu USSD (pas de SMS envoyé)."]}),e.jsxs("div",{className:"text-xs text-gray-600",children:[e.jsx("strong",{children:"Codes USSD par pays :"})," ","CI — ",e.jsx(t,{children:"#144*82#"}),"  |  SN — ",e.jsx(t,{children:"#144*391#"}),"  |  BF — ",e.jsx(t,{children:"*144*4*6*montant#"})]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-4 min-w-0 [&>div]:min-w-0",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Étape 1 — Requête initiale (sans OTP)"}),e.jsx(o,{language:"javascript",code:`// Orange Money CI — étape 1 : sans OTP
const res = await fetch("https://ashtechpay.top/v1/collect", {
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
// ussd_code contient le code à composer`})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Réponse 400 + Étape 2"}),e.jsx(o,{language:"json",code:`// Réponse 400 — CI :
{
  "error": "otp_required",
  "message": "OTP requis. Composez #144*82# …",
  "reference": "DEP-A1B2C3D4",
  "ussd_code": "#144*82#"
}

// Afficher le ussd_code au client :
// "Composez #144*82# sur votre téléphone"`}),e.jsx(o,{language:"javascript",code:`// Étape 2 : même requête + otp + reference
body: JSON.stringify({
  amount: 1000, currency: "XOF",
  phone: "0700000000",
  operator: "Orange Money",
  country_code: "CI",
   otp: "VOTRE_CODE_OTP",
  reference: "DEP-A1B2C3D4", // ← obligatoire
  notify_url: "https://monsite.com/webhook"
})
// → 202 pending → webhook`})]})]})]}),e.jsxs("div",{className:"rounded border border-yellow-200 bg-yellow-50 p-5 space-y-4 mt-4",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-white shrink-0",children:"3"}),e.jsx("h3",{className:"font-bold text-yellow-800",children:"Flux OTP SMS — selon la configuration fournisseur"})]}),e.jsxs("p",{className:"text-sm text-gray-700",children:["Pour certains opérateurs, l'API déclenche automatiquement l'envoi d'un SMS OTP au numéro du client — ",e.jsx("strong",{children:"aucun code USSD à composer."})," ","Le champ ",e.jsx(t,{children:"ussd_code"})," est ",e.jsx("code",{className:"font-mono text-red-600",children:"null"}),"."]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-4 min-w-0 [&>div]:min-w-0",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Étape 1 — Requête initiale (sans OTP)"}),e.jsx(o,{language:"javascript",code:`// Opérateur OTP SMS — étape 1
const res = await fetch("https://ashtechpay.top/v1/collect", {
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
// ussd_code est null — SMS envoyé automatiquement`})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Réponse 400 + Étape 2"}),e.jsx(o,{language:"json",code:`// Réponse 400 :
{
  "error": "otp_required",
  "message": "OTP requis. Un code a été envoyé par SMS.",
  "reference": "DEP-X9Y8Z7W6",
  "ussd_code": null
}

// Le client reçoit son OTP par SMS
// Étape 2 : relancer avec otp + reference`}),e.jsx(o,{language:"javascript",code:`// Étape 2 : même requête + otp + reference
body: JSON.stringify({
  amount: 5000, currency: "XOF",
  phone: "04000000",
  operator: "Orange Money",
  country_code: "BF",
  otp: "456789",
  reference: "DEP-X9Y8Z7W6", // ← obligatoire
  notify_url: "https://monsite.com/webhook"
})
// → 202 pending → webhook`})]})]})]}),e.jsxs("div",{className:"rounded border border-purple-200 bg-purple-50 p-5 space-y-4 mt-4",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0",children:"4"}),e.jsx("h3",{className:"font-bold text-purple-800",children:"Flux Wave — Côte d'Ivoire et Sénégal"})]}),e.jsxs("p",{className:"text-sm text-gray-700",children:["Pour Wave CI et Wave SN. L'API retourne directement un ",e.jsx(t,{children:"wave_url"})," dans la réponse 202. Votre interface doit afficher ce lien (bouton ou QR code) pour que le client l'ouvre dans son application Wave.",e.jsx("strong",{children:" Pas d'OTP."})," Le numéro de téléphone n'est pas requis pour Wave."]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-4 min-w-0 [&>div]:min-w-0",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Requête"}),e.jsx(o,{language:"javascript",code:`// Wave Côte d'Ivoire
const res = await fetch("https://ashtechpay.top/v1/collect", {
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
}`})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-gray-500 font-semibold mb-1",children:"Réponse 202"}),e.jsx(o,{language:"json",code:`{
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
// → Webhook payment.completed envoyé`})]})]})]}),e.jsx(h,{children:"Comment détecter le bon flux dans votre code"}),e.jsx(o,{language:"javascript",code:`async function collectPayment(params) {
  const res = await fetch("https://ashtechpay.top/v1/collect", {
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
}`}),e.jsx(b,{})]}),e.jsxs("section",{id:"transaction",ref:s=>d.current.transaction=s,children:[e.jsx(g,{children:"Statut d'une Transaction"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:["Consultez le statut d'une transaction à tout moment via le"," ",e.jsx(t,{children:"transaction_id"})," retourné lors de l'initiation. Utilisez ce endpoint en complément du webhook."]}),e.jsx(_,{method:"GET",path:"/v1/transaction/:id"}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mb-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(o,{language:"javascript",code:`fetch(
  "https://ashtechpay.top/v1/transaction/8f3e1c2d-...",
  {
    headers: {
      "Authorization": "Bearer YOUR_API_KEY"
    }
  }
)`}),e.jsx(o,{language:"bash",code:`curl https://ashtechpay.top/v1/transaction/8f3e1c2d-... \\
  -H "Authorization: Bearer YOUR_API_KEY"`})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse"}),e.jsx(o,{language:"json",code:`{
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
}`})]})]}),e.jsx(h,{children:"Statuts possibles"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Statut","Description","Final ?"]}),e.jsx("tbody",{children:[{status:"pending",color:"text-yellow-700",desc:"En attente de confirmation de l'opérateur",final:!1},{status:"success",color:"text-green-700",desc:"Paiement confirmé — compte marchand crédité",final:!0},{status:"failed",color:"text-red-700",desc:"Paiement refusé, expiré ou annulé",final:!0}].map(({status:s,color:u,desc:m,final:C})=>e.jsx(p,{cells:[e.jsx("span",{className:`font-mono font-semibold text-sm ${u}`,children:s}),m,C?e.jsx("span",{className:"text-green-700 font-semibold text-xs",children:"Oui"}):e.jsx("span",{className:"text-gray-400 text-xs",children:"Non"})]},s))})]}),e.jsx(b,{})]}),e.jsxs("section",{id:"fees",ref:s=>d.current.fees=s,children:[e.jsx(g,{children:"Grille Tarifaire"}),e.jsx("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-4",children:"Retourne la grille tarifaire en vigueur pour chaque pays actif."}),e.jsx(_,{method:"GET",path:"/v1/fees"}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mb-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Requête"}),e.jsx(o,{language:"javascript",code:`fetch("https://ashtechpay.top/v1/fees", {
  headers: {
    "Authorization": "Bearer YOUR_API_KEY"
  }
})`}),e.jsx(o,{language:"bash",code:`curl https://ashtechpay.top/v1/fees \\
  -H "Authorization: Bearer YOUR_API_KEY"`})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Réponse"}),e.jsx(o,{language:"json",code:`[
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
]`})]})]}),e.jsx(h,{children:"Champs de la réponse"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Champ","Type","Description"]}),e.jsx("tbody",{children:[{name:"country_code",type:"string",desc:"Code ISO du pays (CM, SN, CI…)"},{name:"country_name",type:"string",desc:"Nom complet du pays"},{name:"currency",type:"string",desc:"Devise principale (XAF, XOF, CDF…)"},{name:"total_fee_pct",type:"number",desc:"Frais totaux en % appliqués au montant (ex: 5.5 = 5,5%)"},{name:"ashtech_margin_pct",type:"number",desc:"Part Ashtech Pay dans les frais totaux"},{name:"operators",type:"string[]",desc:"Opérateurs disponibles pour ce pays"}].map(({name:s,type:u,desc:m})=>e.jsx(p,{cells:[e.jsx(t,{children:s}),e.jsx(t,{children:u}),m]},s))})]}),e.jsx(h,{children:"Exemple — calculer le montant net avant d'appeler /v1/collect"}),e.jsx(o,{language:"javascript",code:`// Récupérer les frais en cache (une fois au démarrage ou toutes les heures)
const fees = await fetch("https://ashtechpay.top/v1/fees", {
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
// → { gross: 10000, fee: 550, net: 9450, fee_pct: 5.5 }`}),e.jsx(b,{})]}),e.jsxs("section",{id:"webhooks",ref:s=>d.current.webhooks=s,children:[e.jsx(g,{children:"Webhooks"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-5",children:["Quand une transaction atteint un état final, Ashtech Pay envoie automatiquement une requête"," ",e.jsx(t,{children:"POST"})," à la ",e.jsx(t,{children:"notify_url"})," que vous avez passée dans votre appel à"," ",e.jsx(t,{children:"/v1/collect"}),". Le champ ",e.jsx(t,{children:"amount"})," correspond au montant net après frais, et ",e.jsx(t,{children:"total_amount"})," au montant brut collecté."]}),e.jsxs("div",{className:"grid lg:grid-cols-2 gap-5 mb-5",children:[e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Payload — paiement réussi"}),e.jsx(o,{language:"json",code:`{
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
}`})]}),e.jsxs("div",{className:"space-y-2 min-w-0",children:[e.jsx("p",{className:"text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1",children:"Payload — paiement échoué"}),e.jsx(o,{language:"json",code:`{
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
}`})]})]}),e.jsx(h,{children:"Événements disponibles"}),e.jsxs(j,{children:[e.jsx(f,{cols:["Événement","Déclencheur"]}),e.jsx("tbody",{children:[{event:"payment.completed",desc:"Paiement (dépôt) confirmé avec succès"},{event:"payment.failed",desc:"Paiement refusé, expiré ou annulé"},{event:"payout.completed",desc:"Retrait ou virement sortant confirmé"},{event:"payout.failed",desc:"Retrait ou virement échoué"}].map(({event:s,desc:u})=>e.jsx(p,{cells:[e.jsx(t,{children:s}),u]},s))})]}),e.jsx(h,{children:"Handler (Node.js / Express)"}),e.jsx(o,{language:"javascript",code:`app.post("/webhook", express.json(), async (req, res) => {
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
});`}),e.jsxs("div",{className:"rounded border border-blue-200 bg-blue-50 p-4 mt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-blue-900 mb-2",children:"Bonnes pratiques"}),e.jsx("ul",{className:"space-y-1.5 text-sm text-blue-800",children:["Répondez toujours HTTP 200 immédiatement pour accuser réception","Traitez la logique métier après avoir répondu 200 (asynchrone)","Vérifiez le transaction_id dans votre base pour éviter les doublons","Le webhook est complémentaire à GET /v1/transaction/:id — utilisez les deux","Votre notify_url doit être une URL HTTPS publique (pas localhost)"].map(s=>e.jsxs("li",{className:"flex items-start gap-2",children:[e.jsx(M,{className:"w-3.5 h-3.5 mt-0.5 text-blue-600 shrink-0"}),s]},s))})]}),e.jsx(b,{})]}),e.jsxs("section",{id:"errors",ref:s=>d.current.errors=s,children:[e.jsx(g,{children:"STATUS CODES"}),e.jsxs("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-5",children:["Ce tableau présente les différents codes de statut HTTP et leurs messages correspondants liés aux résultats des transactions utilisés par ",e.jsx("strong",{children:"Ashtech Pay"}),". Il indique si une transaction a été traitée avec succès, a échoué ou est toujours en attente, ainsi que les raisons spécifiques des échecs."]}),e.jsxs(j,{children:[e.jsx(f,{cols:["Code","Status","Message"]}),e.jsx("tbody",{children:[{code:"200",status:"SUCCESS",bold:!0,msg:"Transaction successfully processed"},{code:"200",status:"FAILED",bold:!0,msg:"Transaction Failed"},{code:"200",status:"PENDING",bold:!0,msg:"Transaction in process"},{code:"400",status:"FAILED",bold:!1,msg:"Bad Request — paramètre manquant ou format invalide"},{code:"400",status:"FAILED",bold:!1,msg:"otp_required — OTP requis, conservez le champ reference"},{code:"400",status:"FAILED",bold:!1,msg:"missing_reference — confirmation OTP sans reference"},{code:"400",status:"FAILED",bold:!1,msg:"otp_expired — session OTP expirée, relancez sans otp"},{code:"401",status:"FAILED",bold:!1,msg:"invalid credentials — clé API manquante ou révoquée"},{code:"403",status:"FAILED",bold:!1,msg:"Unauthorized — transaction n'appartient pas à votre compte"},{code:"404",status:"FAILED",bold:!1,msg:"Not Found — transaction introuvable"},{code:"405",status:"FAILED",bold:!1,msg:"Method Not Allowed"},{code:"408",status:"FAILED",bold:!1,msg:"Request Timeout"},{code:"422",status:"FAILED",bold:!1,msg:"Pays ou opérateur non supporté / devise incorrecte"},{code:"429",status:"FAILED",bold:!1,msg:"Too Many Requests — ralentissez"},{code:"502",status:"FAILED",bold:!1,msg:"gateway_error — réseau de l'opérateur a rejeté le paiement"},{code:"500",status:"FAILED",bold:!1,msg:"server_error — erreur interne, réessayez"}].map((s,u)=>e.jsx(p,{cells:[e.jsx("span",{className:"font-mono font-semibold text-gray-800",children:s.code}),e.jsx("span",{className:s.bold?"font-bold text-gray-900":"text-gray-700",children:s.status}),s.msg]},u))})]}),e.jsx(o,{language:"json",code:`{
  "error": "bad_request",
  "message": "Champs requis : amount, currency, phone, operator, country_code"
}`}),e.jsxs("div",{className:"rounded border border-gray-200 bg-gray-50 p-4 mt-4 text-sm text-gray-700",children:["Pour toute question technique non résolue par cette documentation, contactez notre équipe via"," ",e.jsx(N,{href:"/dashboard/support",className:"text-primary hover:underline font-medium",children:"le support"}),"."]})]}),e.jsxs("section",{id:"sandbox",ref:s=>d.current.sandbox=s,children:[e.jsx(g,{children:"Sandbox & Tests"}),e.jsx("p",{className:"text-[15px] text-gray-700 leading-relaxed mb-5",children:"Le testeur interactif appelle l'API Ashtech Pay avec votre propre clé et déclenche de vraies transactions auprès des opérateurs. Aucun environnement sandbox public, numéro de test ou code OTP universel n'est actuellement disponible."}),e.jsxs("div",{className:"rounded border border-orange-200 bg-orange-50 p-5 space-y-2",children:[e.jsx("p",{className:"text-sm font-semibold text-orange-800",children:"Avant de tester"}),e.jsx("ul",{className:"space-y-1.5 text-sm text-orange-800",children:["Utilisez uniquement une clé API activée sur un compte vérifié.","Saisissez un numéro réel appartenant au portefeuille Mobile Money choisi.","Pour un flux OTP, composez le code USSD indiqué par l'API ou attendez le SMS, puis saisissez le code réellement reçu.","Les frais opérateur et les changements d'état sont réels ; testez avec un petit montant."].map(s=>e.jsxs("li",{className:"flex items-start gap-2",children:[e.jsx(M,{className:"w-3.5 h-3.5 mt-0.5 text-orange-600 shrink-0"}),s]},s))})]}),e.jsxs("div",{className:"rounded border border-yellow-200 bg-yellow-50 p-5 space-y-2 mt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-yellow-800",children:"Expiration OTP"}),e.jsx("ul",{className:"space-y-1.5 text-sm text-yellow-800",children:["La session OTP est valide 15 minutes après la réponse 400 otp_required","Si le délai est dépassé, l'API retourne 400 otp_expired — relancez la requête sans otp pour démarrer une nouvelle session","Un même code OTP ne peut être utilisé qu'une seule fois (protection anti-rejeu)","Pour Orange BF, le code USSD contient le montant exact : *144*4*6*5000# pour 5000 XOF","Ne stockez jamais le code OTP côté serveur — il doit être saisi directement par le client"].map(s=>e.jsxs("li",{className:"flex items-start gap-2",children:[e.jsx(M,{className:"w-3.5 h-3.5 mt-0.5 text-yellow-600 shrink-0"}),s]},s))})]}),e.jsxs("div",{className:"rounded border border-purple-200 bg-purple-50 p-5 space-y-2 mt-4",children:[e.jsx("p",{className:"text-sm font-semibold text-purple-800",children:"Flux Wave"}),e.jsxs("p",{className:"text-sm text-purple-800",children:["Si l'opérateur retourne un ",e.jsx(t,{children:"wave_url"}),", ouvrez-le pour valider ou refuser la transaction réelle. Le webhook ",e.jsx(t,{children:"payment.completed"})," ou ",e.jsx(t,{children:"payment.failed"})," est envoyé après la décision du client."]})]}),e.jsx("div",{className:"mt-6",children:e.jsx(N,{href:"/docs/test-pay",children:e.jsxs(w,{className:"gap-2","data-testid":"link-test-payment-sandbox",children:[e.jsx(S,{className:"w-4 h-4"}),"Ouvrir le testeur API"]})})})]}),e.jsx("div",{className:"h-20"})]})]})]})}export{xe as default};
