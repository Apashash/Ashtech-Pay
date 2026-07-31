import { jsPDF } from "jspdf";

// ─── Palette ───────────────────────────────────────────────
const C = {
  bg:      [255, 255, 255] as [number,number,number],
  cover:   [11,  14,  17]  as [number,number,number],
  gold:    [240, 185, 11]  as [number,number,number],
  navy:    [15,  23,  42]  as [number,number,number],
  sectionBg: [241, 245, 249] as [number,number,number],
  codeBg:  [15,  17,  22]  as [number,number,number],
  codeText:[230, 237, 243] as [number,number,number],
  body:    [51,  65,  85]  as [number,number,number],
  muted:   [100, 116, 139] as [number,number,number],
  green:   [34,  197, 94]  as [number,number,number],
  blue:    [99,  179, 237] as [number,number,number],
  orange:  [251, 146, 60]  as [number,number,number],
  red:     [248, 113, 113] as [number,number,number],
  yellow:  [250, 204, 21]  as [number,number,number],
  white:   [255, 255, 255] as [number,number,number],
};

const PAGE_W = 210;
const PAGE_H = 297;
const ML = 18;   // margin left
const MR = 18;   // margin right
const CW = PAGE_W - ML - MR;   // content width

// ─── Helpers ───────────────────────────────────────────────

function rgb(doc: jsPDF, color: [number,number,number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function fill(doc: jsPDF, color: [number,number,number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function draw(doc: jsPDF, color: [number,number,number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

/** Wrap + print text, return new Y */
function text(doc: jsPDF, str: string, x: number, y: number, maxW: number, lineH = 5.5): number {
  const lines = doc.splitTextToSize(str, maxW);
  doc.text(lines, x, y);
  return y + lines.length * lineH;
}

/** Check remaining space — add page if needed, returns updated y */
function checkPage(doc: jsPDF, y: number, needed = 20): number {
  if (y + needed > PAGE_H - 20) {
    doc.addPage();
    return 22;
  }
  return y;
}

/** Section heading with gold left bar */
function sectionTitle(doc: jsPDF, title: string, y: number): number {
  y = checkPage(doc, y, 20);
  fill(doc, C.gold);
  doc.rect(ML, y - 4, 2.5, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  rgb(doc, C.navy);
  doc.text(title, ML + 5, y + 2);
  draw(doc, [226, 232, 240]);
  doc.line(ML, y + 7, ML + CW, y + 7);
  return y + 13;
}

/** Sub-heading */
function subHeading(doc: jsPDF, title: string, y: number): number {
  y = checkPage(doc, y, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  rgb(doc, C.navy);
  doc.text(title, ML, y);
  return y + 7;
}

/** Body paragraph */
function paragraph(doc: jsPDF, str: string, y: number, indent = 0): number {
  y = checkPage(doc, y, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  rgb(doc, C.body);
  return text(doc, str, ML + indent, y, CW - indent, 5.2);
}

/** Inline code chip in body text — just wraps with backtick style for PDF */
function inlineCode(s: string) { return `\`${s}\``; }

// ─── PDF Syntax Highlighting ────────────────────────────────────────────────
type PdfTok = { t: string; r: number; g: number; b: number };

function pt(t: string, r: number, g: number, b: number): PdfTok { return { t, r, g, b }; }

// AfribaPAY dark theme palette
const PK = { // key (JSON)
  r: 244, g: 112, b: 103,
};
const PS = { r: 87, g: 171, b: 90 };   // strings/values
const PN = { r: 108, g: 182, b: 255 }; // numbers
const PW = { r: 246, g: 157, b: 80 };  // booleans/null
const PM = { r: 118, g: 131, b: 144 }; // muted (comments, flags)
const PB = { r: 121, g: 192, b: 255 }; // blue (curl, URLs)
const PD = { r: 205, g: 217, b: 229 }; // default text
const PP = { r: 173, g: 186, b: 199 }; // punctuation

function _pdfJsonLine(line: string): PdfTok[] {
  const out: PdfTok[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '\\') { j += 2; continue; }
        if (line[j] === '"') { j++; break; }
        j++;
      }
      const s = line.slice(i, j);
      let k = j;
      while (k < line.length && (line[k] === ' ' || line[k] === '\t')) k++;
      const c = line[k] === ':' ? PK : PS;
      out.push(pt(s, c.r, c.g, c.b));
      i = j;
    } else if ((line[i] >= '0' && line[i] <= '9') || (line[i] === '-' && i + 1 < line.length && line[i+1] >= '0' && line[i+1] <= '9')) {
      let j = i + (line[i] === '-' ? 1 : 0);
      while (j < line.length && (line[j] >= '0' && line[j] <= '9' || line[j] === '.' || line[j] === 'e' || line[j] === 'E')) j++;
      out.push(pt(line.slice(i, j), PN.r, PN.g, PN.b)); i = j;
    } else if (line.startsWith('true', i))  { out.push(pt('true',  PW.r, PW.g, PW.b)); i += 4;
    } else if (line.startsWith('false', i)) { out.push(pt('false', PW.r, PW.g, PW.b)); i += 5;
    } else if (line.startsWith('null', i))  { out.push(pt('null',  PW.r, PW.g, PW.b)); i += 4;
    } else { out.push(pt(line[i], PP.r, PP.g, PP.b)); i++; }
  }
  return out;
}

function _pdfBashLine(line: string): PdfTok[] {
  const out: PdfTok[] = [];
  if (line.trimStart().startsWith('#')) { out.push(pt(line, PM.r, PM.g, PM.b)); return out; }
  let i = 0;
  while (i < line.length) {
    if (line[i] === ' ' || line[i] === '\t') {
      let j = i; while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j++;
      out.push(pt(line.slice(i, j), PP.r, PP.g, PP.b)); i = j; continue;
    }
    if (line[i] === '\\') { out.push(pt('\\', PM.r, PM.g, PM.b)); i++; continue; }
    if (line[i] === "'") {
      let j = i + 1; while (j < line.length && line[j] !== "'") j++;
      out.push(pt(line.slice(i, j + 1), PS.r, PS.g, PS.b)); i = j + 1; continue;
    }
    if (line[i] === '"') {
      let j = i + 1; while (j < line.length && (line[j] !== '"' || line[j-1] === '\\')) j++;
      out.push(pt(line.slice(i, j + 1), PS.r, PS.g, PS.b)); i = j + 1; continue;
    }
    if (line[i] === '-') {
      let j = i; while (j < line.length && line[j] !== ' ' && line[j] !== '\t' && line[j] !== "'" && line[j] !== '"') j++;
      out.push(pt(line.slice(i, j), PM.r, PM.g, PM.b)); i = j; continue;
    }
    let j = i;
    while (j < line.length && line[j] !== ' ' && line[j] !== '\t' && line[j] !== "'" && line[j] !== '"' && line[j] !== '\\') j++;
    const w = line.slice(i, j);
    const isMeth = ['POST','GET','DELETE','PUT','PATCH'].includes(w);
    const c = isMeth ? PK : (w === 'curl' ? PB : (w.startsWith('http') ? PB : PD));
    out.push(pt(w, c.r, c.g, c.b)); i = j;
  }
  return out;
}

function _pdfTokenize(code: string, lang: string): PdfTok[][] {
  const lines = code.split('\n');
  if (lang === 'json') return lines.map(_pdfJsonLine);
  if (lang === 'bash') return lines.map(_pdfBashLine);
  return lines.map(l => [pt(l, PD.r, PD.g, PD.b)]);
}

function _renderLineToks(doc: jsPDF, toks: PdfTok[], x: number, y: number, maxX: number) {
  let cx = x;
  for (const tk of toks) {
    if (!tk.t || cx >= maxX) break;
    doc.setTextColor(tk.r, tk.g, tk.b);
    const w = doc.getTextWidth(tk.t);
    // Clip token if it would overflow
    if (cx + w > maxX) {
      const chars = Math.floor((maxX - cx) / (w / tk.t.length));
      if (chars > 0) doc.text(tk.t.slice(0, chars), cx, y);
      break;
    }
    doc.text(tk.t, cx, y);
    cx += w;
  }
}
// ────────────────────────────────────────────────────────────────────────────

/** Code block with dark background + syntax highlighting */
function codeBlock(doc: jsPDF, code: string, y: number, lang = ""): number {
  const langLabel: Record<string, string> = {
    json: "json", javascript: "Node.js", http: "HTTP",
    bash: "curl", php: "PHP", python: "Python",
  };
  const label = langLabel[lang] ?? lang;

  const lines = code.split("\n");
  const lineH = 4.8;
  const padV = 4;
  const padH = 5;
  const headerH = label ? 7 : 0;
  const blockH = lines.length * lineH + padV * 2 + headerH;

  y = checkPage(doc, y, Math.min(blockH + 4, 60));

  // Header bar (AfribaPAY style: darker strip with label badge)
  if (label) {
    fill(doc, [28, 33, 40]); // #1c2128
    doc.rect(ML, y, CW, headerH, "F");

    // Label badge background
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    const labelW = doc.getTextWidth(label) + 4;
    fill(doc, [45, 51, 59]); // #2d333b
    doc.rect(ML + padH - 1, y + 1.2, labelW, 4.5, "F");
    doc.setTextColor(205, 217, 229); // #cdd9e5
    doc.text(label, ML + padH + 1, y + 4.8);
    y += headerH;
  }

  // Code background
  fill(doc, [22, 27, 34]); // #161b22 (AfribaPAY bg)
  doc.rect(ML, y, CW, lines.length * lineH + padV * 2, "F");

  doc.setFont("courier", "normal");
  doc.setFontSize(8);

  const tokenizedLines = _pdfTokenize(code, lang);

  let cy = y + padV + lineH * 0.7;
  for (let li = 0; li < lines.length; li++) {
    if (cy > PAGE_H - 20) {
      doc.addPage();
      fill(doc, [22, 27, 34]);
      doc.rect(ML, 15, CW, (lines.length - li) * lineH + padV * 2, "F");
      cy = 22;
    }
    _renderLineToks(doc, tokenizedLines[li] ?? [], ML + padH, cy, ML + CW - 2);
    cy += lineH;
  }

  return cy + padV + 4;
}

/** Simple table */
function table(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  y: number,
  colWidths?: number[]
): number {
  const colW = colWidths ?? Array(headers.length).fill(CW / headers.length);
  const rowH = 7;
  const padH = 3;

  y = checkPage(doc, y, 30);

  // Header row
  fill(doc, C.navy);
  doc.rect(ML, y, CW, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  rgb(doc, C.white);
  let cx = ML;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cx + padH, y + rowH * 0.65);
    cx += colW[i];
  }

  y += rowH;

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (let ri = 0; ri < rows.length; ri++) {
    y = checkPage(doc, y, rowH + 2);
    if (ri % 2 === 1) {
      fill(doc, C.sectionBg);
      doc.rect(ML, y, CW, rowH, "F");
    }
    cx = ML;
    for (let ci = 0; ci < rows[ri].length; ci++) {
      rgb(doc, C.body);
      doc.text(String(rows[ri][ci]).slice(0, 60), cx + padH, y + rowH * 0.65);
      cx += colW[ci];
    }
    y += rowH;
  }

  // Bottom border
  draw(doc, [203, 213, 225]);
  doc.line(ML, y, ML + CW, y);

  return y + 6;
}

/** Info / warning banner */
function banner(doc: jsPDF, type: "info" | "warn" | "tip", text_: string, y: number): number {
  const colors: Record<string, [number,number,number][]> = {
    info: [[219, 234, 254], [37, 99, 235]],
    warn: [[254, 243, 199], [217, 119, 6]],
    tip:  [[220, 252, 231], [21, 128, 61]],
  };
  const [bg, accent] = colors[type];
  const lines = doc.splitTextToSize(text_, CW - 12);
  const h = lines.length * 5.2 + 8;
  y = checkPage(doc, y, h + 6);
  fill(doc, bg);
  doc.rect(ML, y, CW, h, "F");
  fill(doc, accent);
  doc.rect(ML, y, 3, h, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  rgb(doc, [30, 41, 59]);
  doc.text(lines, ML + 7, y + 5.5);
  return y + h + 6;
}

/** Page number footer */
function addFooter(doc: jsPDF, pageNum: number, total: number, title: string) {
  const y = PAGE_H - 10;
  draw(doc, [203, 213, 225]);
  doc.line(ML, y - 3, ML + CW, y - 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  rgb(doc, C.muted);
  doc.text(title, ML, y);
  doc.text(`Page ${pageNum} / ${total}`, ML + CW, y, { align: "right" });
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSTED PAGE PDF
// ─────────────────────────────────────────────────────────────────────────────

export function downloadHostedPagePDF() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ── Cover ──────────────────────────────────────────────────────────────────
  fill(doc, C.cover);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  fill(doc, C.gold);
  doc.rect(0, 0, 6, PAGE_H, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  rgb(doc, C.gold);
  doc.text("Ashtech Pay", ML + 6, 70);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  rgb(doc, [148, 163, 184]);
  doc.text("Hosted Payment Page", ML + 6, 82);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  rgb(doc, C.white);
  doc.text("v1  •  API Documentation", ML + 6, 93);

  fill(doc, C.gold);
  doc.rect(ML + 6, 99, 40, 0.8, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  rgb(doc, [148, 163, 184]);
  const desc = "Créez des liens de paiement hébergés et acceptez des paiements Mobile Money dans 22+ pays africains, sans gérer vous-même la page de paiement.";
  doc.text(doc.splitTextToSize(desc, CW - 6), ML + 6, 108);

  const meta = [
    ["Endpoint principal", "POST /api/v1/hosted-payment/create"],
    ["Authentification",   "Bearer hp_live_xxxxxxxx"],
    ["Base URL",           "https://ashtechpay.top"],
    ["Version",            "v1 — Mai 2026"],
  ];

  let my = 140;
  for (const [k, v] of meta) {
    fill(doc, [22, 27, 34]);
    doc.rect(ML + 6, my, CW - 6, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    rgb(doc, [100, 116, 139]);
    doc.text(k.toUpperCase(), ML + 10, my + 4);
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    rgb(doc, C.gold);
    doc.text(v, ML + 10, my + 8.2);
    my += 13;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  rgb(doc, [71, 85, 105]);
  doc.text("ashtechpay.top  •  support@ashtechpay.top", ML + 6, PAGE_H - 18);

  // ── Page 2+ — Content ──────────────────────────────────────────────────────
  doc.addPage();
  let y = 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  rgb(doc, C.navy);
  doc.text("Sommaire", ML, y);
  y += 8;
  draw(doc, [203, 213, 225]);
  doc.line(ML, y, ML + CW, y);
  y += 6;

  const toc = [
    "1.  Les 3 clés API (pk_live_ · sk_live_ · hp_live_)",
    "2.  Créer un lien de paiement   POST /api/v1/hosted-payment/create",
    "3.  Prix fixe — montant défini à l'avance",
    "4.  Prix libre — le client choisit le montant",
    "5.  Filtrer les pays affichés (22 pays disponibles)",
    "6.  Vérifier le statut   GET /api/v1/hosted-payment/:payment_id",
    "7.  Créditement automatique du wallet",
    "8.  Webhook — notification automatique (notify_url)",
    "9.  Exemples de code   (Node.js · PHP · cURL)",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  rgb(doc, C.body);
  for (const item of toc) {
    doc.text(item, ML + 3, y);
    y += 6.5;
  }
  y += 8;

  // ── §1  Les 3 clés API ────────────────────────────────────────────────────
  y = sectionTitle(doc, "1. Les 3 clés API", y);
  y = paragraph(doc, "En generant tes cles dans l'onglet Hosted Page, tu obtiens 3 cles distinctes :", y);
  y += 4;

  y = table(doc,
    ["Cle", "Prefixe", "Role", "Ou l'utiliser"],
    [
      ["Public Key",       "pk_live_", "Identification publique",    "Frontend JS — identifie ton compte cote client"],
      ["Secret Key",       "sk_live_", "Operations sensibles",       "Backend uniquement — webhooks, remboursements"],
      ["Hosted Page Key",  "hp_live_", "Liens de paiement heberges", "Backend — creer des liens via API"],
    ],
    y, [30, 26, 35, 79]
  );
  y = banner(doc, "warn", "Securite — sk_live_ et hp_live_ doivent rester dans des variables d'environnement cote serveur. Ne les publie jamais dans du code frontend ni dans un depot Git public.", y);

  // ── §2  Créer un lien ─────────────────────────────────────────────────────
  y = sectionTitle(doc, "2. Creer un lien de paiement", y);
  y = subHeading(doc, "POST /api/v1/hosted-payment/create", y);
  y = paragraph(doc, "Cree un lien de paiement heberge unique. Le client est redirige vers une page Ashtech Pay securisee pour finaliser le paiement Mobile Money.", y);
  y += 3;
  y = subHeading(doc, "En-tetes requis", y);
  y = codeBlock(doc, `Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx\nContent-Type: application/json`, y, "http");
  y = subHeading(doc, "Corps de la requete (JSON)", y);
  y = table(doc,
    ["Parametre", "Type", "Statut", "Description"],
    [
      ["currency",          "string",   "Requis",    "Devise : XOF, XAF, GNF, CDF…"],
      ["amount",            "number",   "Optionnel", "Montant fixe. Obligatoire si is_fixed_amount est true"],
      ["description",       "string?",  "Optionnel", "Titre affiche sur la page de paiement"],
      ["is_fixed_amount",   "boolean?", "Optionnel", "true (defaut) = prix fixe. false = client saisit le montant"],
      ["allowed_countries", "string[]?","Optionnel", "Codes ISO des pays a afficher. Ex: [\"CM\",\"SN\"]. Vide = tous"],
      ["notify_url",        "string?",  "Optionnel", "Surcharge la Webhook URL configuree pour ce lien specifique"],
    ],
    y, [35, 24, 24, 87]
  );
  y = paragraph(doc, "* champ obligatoire", y);
  y += 3;
  y = subHeading(doc, "Reponse 200 (succes)", y);
  y = codeBlock(doc, `{\n  "status":       "success",\n  "payment_link": "https://ashtechpay.top/pay/hp-ab12cd34",\n  "payment_id":   "uuid-du-lien",\n  "slug":         "hp-ab12cd34",\n  "is_fixed_amount": true,\n  "amount":       5000,\n  "currency":     "XAF",\n  "allowed_countries": null,\n  "expires_at":   "2026-03-15T15:30:00.000Z"\n}`, y, "json");

  // ── §3  Prix fixe ─────────────────────────────────────────────────────────
  y = sectionTitle(doc, "3. Prix fixe — tu definis le montant", y);
  y = paragraph(doc, "Le montant est defini a la creation. Le client voit le montant sur la page et ne peut pas le modifier. Ideal pour les produits, abonnements, factures.", y);
  y += 3;
  y = codeBlock(doc, `fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {\n  method: "POST",\n  headers: {\n    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({\n    currency: "XAF",\n    amount: 5000,\n    description: "Abonnement mensuel",\n    is_fixed_amount: true,\n    // notify_url definie dans vos parametres — recuperee automatiquement\n  }),\n})`, y, "javascript");

  // ── §4  Prix libre ────────────────────────────────────────────────────────
  y = sectionTitle(doc, "4. Prix libre — le client choisit le montant", y);
  y = paragraph(doc, "La page de paiement affiche un champ de saisie pour le montant. Le client entre ce qu'il veut payer. Ideal pour les dons, pourboires, paiements a montant variable.", y);
  y += 3;
  y = codeBlock(doc, `fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {\n  method: "POST",\n  headers: {\n    "Authorization": \`Bearer \${process.env.HP_LIVE_KEY}\`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({\n    currency: "XOF",\n    description: "Don libre",\n    is_fixed_amount: false,   // <- le client saisit son montant\n    // pas besoin de "amount"\n  }),\n})`, y, "javascript");
  y = banner(doc, "info", "En mode prix libre, le montant reel paye par le client est disponible dans GET /api/v1/hosted-payment/:payment_id une fois le statut passe a success, dans le champ amount.", y);

  // ── §5  Filtrer les pays ──────────────────────────────────────────────────
  y = sectionTitle(doc, "5. Filtrer les pays affiches", y);
  y = paragraph(doc, "Par defaut, tous les pays actifs sont disponibles. Tu peux restreindre a un sous-ensemble en passant leurs codes ISO dans allowed_countries.", y);
  y += 3;
  y = codeBlock(doc, `body: JSON.stringify({\n  currency: "XAF",\n  amount: 10000,\n  description: "Achat produit",\n  allowed_countries: ["CM", "SN"],  // uniquement Cameroun + Senegal\n})`, y, "javascript");
  y += 2;

  y = table(doc,
    ["Code ISO", "Pays", "Wallet credite", "Operateurs"],
    [
      ["CM","Cameroun",         "XAF",  "MTN, Orange"],
      ["SN","Senegal",          "XOFS", "Orange, Wave, Free"],
      ["CI","Cote d'Ivoire",    "XOFC", "Orange, MTN, Wave"],
      ["BJ","Benin",            "XOFB", "MTN, Moov"],
      ["BF","Burkina Faso",     "XOFF", "Orange, Moov, Coris"],
      ["ML","Mali",             "XOFM", "Orange, Moov"],
      ["TG","Togo",             "XOFT", "Flooz, Tmoney"],
      ["NE","Niger",            "XOFN", "Orange, Airtel"],
      ["GW","Guinee-Bissau",    "XOF",  "MTN"],
      ["GN","Guinee",           "GNF",  "Orange, MTN"],
      ["CD","Congo RDC",        "CDF",  "Airtel, Orange"],
      ["GA","Gabon",            "XAFG", "Airtel, Moov"],
      ["CG","Congo",            "XAFC", "Airtel, MTN"],
      ["CF","Centrafrique",     "XAF",  "Orange"],
      ["TD","Tchad",            "XAF",  "Airtel, Moov"],
      ["RW","Rwanda",           "RWF",  "MTN, Airtel"],
      ["GH","Ghana",            "GHS",  "MTN, Vodafone, Airtel"],
      ["NG","Nigeria",          "NGN",  "MTN, Airtel"],
      ["KE","Kenya",            "KES",  "M-Pesa"],
      ["TZ","Tanzanie",         "TZS",  "Vodacom, Airtel, Tigo"],
      ["UG","Ouganda",          "UGX",  "MTN, Airtel"],
      ["GM","Gambie",           "GMD",  "Afrimoney, QMoney"],
    ],
    y, [18, 36, 28, 88]
  );
  y = banner(doc, "info", "Si allowed_countries est absent ou vide, tous les pays actifs sont disponibles. L'administrateur controle quels pays et operateurs sont actifs — tout changement s'applique automatiquement sans modifier votre code.", y);

  // ── §6  Statut ─────────────────────────────────────────────────────────────
  y = sectionTitle(doc, "6. Verifier le statut d'un paiement", y);
  y = subHeading(doc, "GET /api/v1/hosted-payment/:payment_id", y);
  y = codeBlock(doc, `{\n  "payment_id":      "uuid-du-lien",\n  "slug":            "hp-ab12cd34",\n  "is_fixed_amount": true,\n  "amount":          5000,\n  "currency":        "XAF",\n  "description":     "Abonnement Premium",\n  "allowed_countries": ["CM"],\n  "status":          "success",\n  "paid_at":         "2026-03-15T15:12:34.000Z",\n  "created_at":      "2026-03-15T15:00:00.000Z",\n  "expires_at":      "2026-03-15T15:30:00.000Z"\n}`, y, "json");

  y = table(doc,
    ["Statut", "Signification", "Action"],
    [
      ["pending",    "Lien cree — le client n'a pas encore paye",   "Continuer a poller (toutes les 5s)"],
      ["processing", "Le client a initie le paiement",              "Continuer a poller"],
      ["success",    "Paiement confirme — wallet credite",          "Livrer le produit / service"],
      ["failed",     "Paiement echoue ou refuse",                   "Notifier le client"],
      ["expired",    "30 min depassees sans paiement",              "Creer un nouveau lien"],
    ],
    y, [28, 72, 70]
  );
  y = banner(doc, "warn", "Important — Ne livre jamais avant d'avoir verifie status === \"success\". Le statut processing signifie que le paiement est initie mais pas encore confirme par l'operateur.", y);

  // ── §7  Créditement ───────────────────────────────────────────────────────
  y = sectionTitle(doc, "7. Creditement automatique du wallet", y);
  y = paragraph(doc, "Des que l'operateur Mobile Money confirme le paiement, Ashtech Pay credite automatiquement ton wallet marchand dans la devise du pays du client. Aucune action requise.", y);
  y += 4;

  y = subHeading(doc, "Etapes du creditement", y);
  const steps = [
    "1. Le client confirme le paiement sur son telephone (USSD / OTP / Wave)",
    "2. L'operateur Mobile Money notifie Ashtech Pay",
    "3. La transaction est enregistree comme completed",
    "4. Ton wallet marchand est credite dans la devise du pays (frais deduits)",
    "5. Le statut passe a success — tu peux livrer",
  ];
  for (const step of steps) {
    y = paragraph(doc, step, y, 3);
    y += 1;
  }
  y += 4;

  y = subHeading(doc, "Wallet credite par pays", y);
  y = table(doc,
    ["Pays du client", "Wallet marchand credite"],
    [
      ["Benin",          "XOFB"], ["Senegal",       "XOFS"], ["Cote d'Ivoire", "XOFC"],
      ["Burkina Faso",   "XOFF"], ["Mali",          "XOFM"], ["Togo",          "XOFT"],
      ["Niger",          "XOFN"], ["Guinee-Bissau", "XOF"],  ["Cameroun",      "XAF"],
      ["Gabon",          "XAFG"], ["Congo",         "XAFC"], ["Centrafrique",  "XAF"],
      ["Tchad",          "XAF"],  ["Guinee",        "GNF"],  ["Congo RDC",     "CDF"],
      ["Rwanda",         "RWF"],  ["Ghana",         "GHS"],  ["Nigeria",       "NGN"],
      ["Kenya",          "KES"],  ["Tanzanie",      "TZS"],  ["Ouganda",       "UGX"],
      ["Gambie",         "GMD"],
    ],
    y, [100, 70]
  );
  y = banner(doc, "info", "Chaque pays credite un wallet separe dans ta balance. Tu peux ensuite convertir ces wallets en XOF, XAF ou toute autre devise depuis ton tableau de bord → Wallets.", y);

  // ── §8  Webhook ───────────────────────────────────────────────────────────
  y = sectionTitle(doc, "8. Webhook — notification automatique", y);
  y = paragraph(doc, "Configure ta Webhook URL une seule fois dans tes parametres API Keys. Ashtech Pay la recupere automatiquement a chaque paiement Hosted Page.", y);
  y += 2;
  y = banner(doc, "info", "Tu peux aussi passer un notify_url specifique lors de la creation d'un lien — il remplacera l'URL configuree par defaut pour ce lien uniquement. Le webhook est envoye depuis nos serveurs vers ton serveur — l'URL doit etre publiquement accessible (pas localhost).", y);
  y = subHeading(doc, "Payload recu (POST -> votre serveur)", y);
  y = codeBlock(doc, `{\n  "event":          "payment.completed",  // ou "payment.failed"\n  "transaction_id": "uuid-de-la-txn",\n  "reference":      "ASHPAY-DEP-XXXXXXXXXX",\n  "status":         "completed",\n  "amount":         4750,     // montant net credite sur ton wallet (frais deduits)\n  "total_amount":   5000,     // montant brut paye par le client\n  "currency":       "XAF",\n  "type":           "deposit",\n  "phone":          "656123456",\n  "timestamp":      "2026-03-16T03:00:00.000Z"\n}`, y, "json");

  y = subHeading(doc, "Exemple de recepteur webhook (Node.js / Express)", y);
  y = codeBlock(doc, `app.post("/webhooks/ashtechpay", express.json(), (req, res) => {\n  // Toujours repondre 200 d'abord, traiter ensuite\n  res.sendStatus(200);\n\n  const { event, transaction_id, reference, amount, total_amount, currency } = req.body;\n\n  if (event === "payment.completed") {\n    // amount      = montant net credite sur votre wallet (apres frais)\n    // total_amount = montant brut paye par le client\n    console.log(\`Paiement recu : \${amount} \${currency}\`);\n    // crediter le compte client, livrer la commande...\n  }\n\n  if (event === "payment.failed") {\n    console.log(\`Paiement echoue | ref: \${reference}\`);\n    // annuler la commande, notifier le client...\n  }\n});`, y, "javascript");
  y = banner(doc, "warn", "Reponds toujours HTTP 200 immediatement — meme si une erreur survient cote serveur. Si ton serveur repond autre chose, le webhook ne sera pas renvoye.", y);

  // ── §9  Exemples ──────────────────────────────────────────────────────────
  y = sectionTitle(doc, "9. Exemples de code", y);

  y = subHeading(doc, "Node.js — creer et surveiller un lien de paiement", y);
  y = codeBlock(doc, `const HP_KEY = process.env.HP_LIVE_KEY;\n\n// Creer un lien de paiement\nasync function createLink({ amount, currency, description, countries }) {\n  const res = await fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {\n    method: "POST",\n    headers: {\n      "Authorization": \`Bearer \${HP_KEY}\`,\n      "Content-Type": "application/json",\n    },\n    body: JSON.stringify({\n      currency, amount, description,\n      is_fixed_amount: !!amount,\n      allowed_countries: countries ?? null,\n    }),\n  });\n  return res.json();\n  // { payment_link, payment_id, expires_at, ... }\n}\n\n// Verifier le statut\nasync function checkStatus(paymentId) {\n  const res = await fetch(\n    \`https://ashtechpay.top/api/v1/hosted-payment/\${paymentId}\`,\n    { headers: { "Authorization": \`Bearer \${HP_KEY}\` } }\n  );\n  return res.json();\n}\n\n// Polling toutes les 5 secondes\nconst link = await createLink({ amount: 5000, currency: "XAF", description: "Commande #123" });\nconst interval = setInterval(async () => {\n  const { status } = await checkStatus(link.payment_id);\n  if (status === "success") {\n    clearInterval(interval);\n    console.log("Paiement confirme — livrer le produit");\n  } else if (status === "failed" || status === "expired") {\n    clearInterval(interval);\n    console.log("Paiement non abouti :", status);\n  }\n}, 5000);`, y, "javascript");

  y = subHeading(doc, "PHP", y);
  y = codeBlock(doc, `<?php\n$hpKey = getenv("HP_LIVE_KEY");\n\nfunction createPaymentLink($currency, $amount, $description, $countries = null) {\n  global $hpKey;\n  $payload = array_filter([\n    "currency"          => $currency,\n    "amount"            => $amount,\n    "description"       => $description,\n    "is_fixed_amount"   => !empty($amount),\n    "allowed_countries" => $countries,\n  ]);\n  $ch = curl_init("https://ashtechpay.top/api/v1/hosted-payment/create");\n  curl_setopt_array($ch, [\n    CURLOPT_POST            => true,\n    CURLOPT_RETURNTRANSFER  => true,\n    CURLOPT_HTTPHEADER      => [\n      "Authorization: Bearer $hpKey",\n      "Content-Type: application/json",\n    ],\n    CURLOPT_POSTFIELDS => json_encode($payload),\n  ]);\n  $result = json_decode(curl_exec($ch), true);\n  curl_close($ch);\n  return $result;\n}\n\n$link = createPaymentLink("XAF", 10000, "Facture #456", ["CM"]);\nheader("Location: " . $link["payment_link"]);`, y, "php");

  y = subHeading(doc, "cURL", y);
  y = codeBlock(doc, `# Prix fixe — Cameroun uniquement\ncurl -X POST https://ashtechpay.top/api/v1/hosted-payment/create \\\n  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"currency":"XAF","amount":5000,"description":"Commande","allowed_countries":["CM"]}'\n\n# Prix libre — tous les pays\ncurl -X POST https://ashtechpay.top/api/v1/hosted-payment/create \\\n  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"currency":"XOF","description":"Don","is_fixed_amount":false}'\n\n# Verifier le statut\ncurl https://ashtechpay.top/api/v1/hosted-payment/UUID_DU_LIEN \\\n  -H "Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"`, y, "bash");

  // ── Footers ───────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p > 1) addFooter(doc, p - 1, total - 1, "Ashtech Pay — Documentation Hosted Payment Page v1");
  }

  doc.save("AshtechPay_HostedPage_API_v1.pdf");
}

// ─────────────────────────────────────────────────────────────────────────────
// SDK / DIRECT API PDF
// ─────────────────────────────────────────────────────────────────────────────

export function downloadSDKDocs() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ── Cover ──────────────────────────────────────────────────────────────────
  fill(doc, C.cover);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  fill(doc, C.gold);
  doc.rect(0, 0, 6, PAGE_H, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  rgb(doc, C.gold);
  doc.text("Ashtech Pay", ML + 6, 70);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  rgb(doc, [148, 163, 184]);
  doc.text("Direct API — SDK Documentation", ML + 6, 82);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  rgb(doc, C.white);
   doc.text("v1  •  Mobile Money + Pay-In Crypto — 16 pays africains", ML + 6, 93);

  fill(doc, C.gold);
  doc.rect(ML + 6, 99, 50, 0.8, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  rgb(doc, [148, 163, 184]);
  const desc2 = "Initiez des paiements Mobile Money directement depuis votre serveur, sans redirection. Gerez les flux USSD Push, OTP SMS, OTP USSD et Wave en 16 pays africains.";
  doc.text(doc.splitTextToSize(desc2, CW - 6), ML + 6, 108);

  const meta2 = [
    ["Endpoint collect",  "POST /v1/collect"],
    ["Authentification",  "Bearer YOUR_API_KEY"],
    ["Base URL",          "https://ashtechpay.top"],
    ["Version",           "v1 — Mai 2026"],
  ];

  let my2 = 140;
  for (const [k, v] of meta2) {
    fill(doc, [22, 27, 34]);
    doc.rect(ML + 6, my2, CW - 6, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    rgb(doc, [100, 116, 139]);
    doc.text(k.toUpperCase(), ML + 10, my2 + 4);
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    rgb(doc, C.gold);
    doc.text(v, ML + 10, my2 + 8.2);
    my2 += 13;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  rgb(doc, [71, 85, 105]);
  doc.text("ashtechpay.top  •  support@ashtechpay.top", ML + 6, PAGE_H - 18);

  // ── Content pages ──────────────────────────────────────────────────────────
  doc.addPage();
  let y = 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  rgb(doc, C.navy);
  doc.text("Sommaire", ML, y);
  y += 8;
  draw(doc, [203, 213, 225]);
  doc.line(ML, y, ML + CW, y);
  y += 6;

  const toc2 = [
    "1.  Introduction",
    "2.  Authentification",
    "3.  GET /v1/countries — Pays et operateurs",
     "4.  Pay-In Crypto — /v1/crypto/assets + /v1/crypto/collect",
     "5.  POST /v1/collect — Initier un paiement Mobile Money",
     "6.  Flux de paiement   (USSD Push · OTP SMS · OTP USSD · Wave)",
     "7.  GET /v1/transaction/:id — Statut d'une transaction",
     "8.  GET /v1/fees — Grille tarifaire en temps reel",
     "9.  Webhooks",
     "10. Codes d'erreur",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  rgb(doc, C.body);
  for (const item of toc2) {
    doc.text(item, ML + 3, y);
    y += 6.5;
  }
  y += 8;

  // ── §1  Introduction ──────────────────────────────────────────────────────
  y = sectionTitle(doc, "1. Introduction", y);
  y = paragraph(doc, "L'Ashtech Pay API unifie plusieurs passerelles de paiement africaines en une seule interface REST. Initiez des paiements Mobile Money dans 22+ pays africains sans redirection. Le routage entre les operateurs est automatique — vous n'avez pas a choisir le fournisseur.", y);
  y += 3;
  y = table(doc,
    ["Caracteristique", "Detail"],
    [
      ["Base URL",        "https://ashtechpay.top"],
      ["Format",          "JSON uniquement — Content-Type: application/json"],
      ["Authentification","Bearer token dans l'en-tete Authorization"],
      ["Protocole",       "HTTPS obligatoire"],
      ["Versioning",      "Prefixe /v1/ dans tous les endpoints"],
    ],
    y, [55, 115]
  );

  // ── §2  Auth ──────────────────────────────────────────────────────────────
  y = sectionTitle(doc, "2. Authentification", y);
  y = paragraph(doc, "Toutes les requetes doivent inclure votre cle API dans l'en-tete HTTP Authorization.", y);
  y += 3;
  y = codeBlock(doc, `Authorization: Bearer YOUR_API_KEY`, y, "http");
  y = banner(doc, "warn", "Utilisez votre cle API uniquement depuis votre serveur (Node.js, Python, PHP…). Ne l'incluez jamais dans du code cote navigateur ou application mobile.", y);
  y = paragraph(doc, "Exemple d'appel authentifie (Node.js) :", y);
  y = codeBlock(doc, `const response = await fetch("https://ashtechpay.top/v1/collect", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer YOUR_API_KEY",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({ /* ... */ })\n});`, y, "javascript");

  // ── §3  Countries ─────────────────────────────────────────────────────────
  y = sectionTitle(doc, "3. Pays et operateurs — GET /v1/countries", y);
  y = paragraph(doc, "Retourne la liste complete des pays actifs et leurs operateurs Mobile Money disponibles. Cette liste est geree par l'administrateur — tout ajout ou retrait de pays/operateur est immediatement visible via cet endpoint.", y);
  y += 3;
  y = codeBlock(doc, `fetch("https://ashtechpay.top/v1/countries", {\n  headers: { "Authorization": "Bearer YOUR_API_KEY" }\n})`, y, "javascript");
  y = codeBlock(doc, `curl https://ashtechpay.top/v1/countries \\\n  -H "Authorization: Bearer YOUR_API_KEY"`, y, "bash");
  y = subHeading(doc, "Reponse", y);
  y = codeBlock(doc, `[\n  {\n    "code": "CM",\n    "name": "Cameroun",\n    "currency": "XAF",\n    "operators": ["MTN Mobile Money", "Orange Money"]\n  },\n  {\n    "code": "SN",\n    "name": "Senegal",\n    "currency": "XOF",\n    "operators": ["Free Money", "Orange Money", "Wave"]\n  }\n  // ...\n]`, y, "json");
  y = subHeading(doc, "Pays disponibles (16)", y);
  y = table(doc,
    ["Pays", "Code", "Devise", "Operateurs"],
    [
      ["Benin",          "BJ","XOFB","Moov Money, MTN Mobile Money"],
      ["Burkina Faso",   "BF","XOFF","Moov Money, Orange Money (OTP)"],
      ["Cameroun",       "CM","XAF", "MTN Mobile Money, Orange Money"],
      ["Centrafrique",   "CF","XAF", "Orange Money (OTP)"],
      ["Congo",          "CG","XAFC","Airtel Money, MTN Mobile Money"],
      ["Cote d'Ivoire",  "CI","XOFC","Moov Money, MTN, Orange (OTP), Wave"],
      ["Gabon",          "GA","XAFG","Airtel Money, Moov Money"],
      ["Guinee Conakry", "GN","GNF", "MTN Mobile Money, Orange Money"],
      ["Guinee equat.",  "GQ","XAF", "Orange Money (OTP)"],
      ["Guinee-Bissau",  "GW","XOF", "Orange Money (OTP)"],
      ["Mali",           "ML","XOF", "Moov Money, Orange Money (OTP)"],
      ["Niger",          "NE","XOFN","Airtel Money"],
      ["RD Congo",       "CD","CDF", "Afrimoney, Airtel, Orange (OTP), Vodacom M-Pesa"],
      ["Senegal",        "SN","XOFS","Free Money, Orange Money (OTP), Wave"],
      ["Tchad",          "TD","XAF", "Airtel Money, Moov Money"],
      ["Togo",           "TG","XOFT","Flooz (Moov), T-Money"],
    ],
    y, [38, 14, 20, 98]
  );
  y = paragraph(doc, "Legende : (OTP USSD) = code a composer pour recevoir l'OTP   •   (OTP SMS) = SMS automatique   •   Wave = lien de paiement Wave", y);
  y += 4;

   // ── §4  Crypto Pay-In ─────────────────────────────────────────────────────
   y = sectionTitle(doc, "4. Pay-In Crypto — /v1/crypto/assets + /v1/crypto/collect", y);
   y = paragraph(doc, "Le Pay-In Crypto utilise la meme cle API ak_… que Mobile Money, mais des endpoints dedies afin de ne modifier aucun contrat existant. Commencez par recuperer les reseaux autorises, puis creez une adresse de depot unique.", y);
    y = paragraph(doc, "GET /v1/crypto/assets ne retourne que les reseaux actifs. Une desactivation admin est appliquee immediatement ; un coin sans reseau actif disparait du catalogue et une creation directe sur un reseau desactive retourne asset_disabled. Utilisez toujours asset_code tel qu'il est retourne par ce catalogue.", y);
   y += 3;
   y = subHeading(doc, "GET /v1/crypto/assets", y);
   y = codeBlock(doc, `curl https://ashtechpay.top/v1/crypto/assets \\\n  -H "Authorization: Bearer YOUR_API_KEY"`, y, "bash");
   y = codeBlock(doc, `{\n  "assets": [\n    {\n      "asset_code": "USDT.TRC20",\n      "coin": "USDT",\n      "name": "Tether",\n      "network": "TRC20",\n      "network_label": "TRON (TRC20)",\n      "memo_required": false,\n      "memo_type": null,\n      "currency": "USDT"\n    }\n  ]\n}`, y, "json");
   y = subHeading(doc, "POST /v1/crypto/collect", y);
   y = table(doc,
     ["Parametre", "Type", "Statut", "Description"],
     [
       ["amount", "number", "Requis", "Montant brut dans la devise currency"],
       ["currency", "string", "Requis", "USDT, XAF, XOF, GNF, CDF ou USD"],
       ["asset_code", "string", "Requis", "Reseau retourne par /v1/crypto/assets"],
       ["reference", "string", "Optionnel", "Reference de commande, generee si absente"],
       ["notify_url", "string", "Optionnel", "URL HTTPS du webhook marchand"],
       ["customer", "object", "Optionnel", "firstName, lastName, email"],
       ["refund_address", "string", "Optionnel", "Adresse de remboursement"],
     ],
     y, [33, 22, 24, 89]
   );
   y = codeBlock(doc, `fetch("https://ashtechpay.top/v1/crypto/collect", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer YOUR_API_KEY",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    amount: 25,\n    currency: "USDT",\n    asset_code: "USDT.TRC20",\n    reference: "ORDER-CRYPTO-001",\n    notify_url: "https://monsite.com/webhook",\n    customer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }\n  })\n})`, y, "javascript");
   y = codeBlock(doc, `{\n  "transaction_id": "8f3e1c2d-...",\n  "reference": "ORDER-CRYPTO-001",\n  "status": "pending",\n  "payment_method": "crypto",\n  "asset_code": "USDT.TRC20",\n  "network": "TRC20",\n  "address": "TX…",\n  "memo": null,\n  "memo_type": null,\n  "amount": 25,\n  "currency": "USDT",\n  "amount_usdt": 25,\n  "credited_amount": 24.375,\n  "fee_amount": 0.625,\n  "credited_amount_usdt": 24.375,\n  "fee_amount_usdt": 0.625,\n  "fee_percent": 2.5,\n  "expires_at": "2026-07-31T19:00:00Z"\n}`, y, "json");
    y = paragraph(doc, "Pour une devise fiat, amount est converti en USDT avec le taux USDT/XAF configure par l'administrateur. Les frais Ashtech Pay et fournisseur sont inclus dans fee_amount_usdt. Quand memo_required vaut true, memo_type indique memo ou tag : copiez address et memo separement, sans jamais concatener ou remplacer le memo par l'adresse.", y);

   // ── §5  Collect ───────────────────────────────────────────────────────────
   y = sectionTitle(doc, "5. Initier un paiement — POST /v1/collect", y);
  y = paragraph(doc, "Initie un paiement Mobile Money. Le client recoit une demande de validation sur son telephone. Le routage entre fournisseurs est automatique selon le pays et l'operateur. Les frais sont deduits automatiquement — le champ credited_amount est le montant net credite.", y);
  y += 3;
  y = subHeading(doc, "Corps de la requete (JSON)", y);
  y = table(doc,
    ["Parametre", "Type", "Statut", "Description"],
    [
      ["amount",       "number", "Requis",    "Montant brut a collecter"],
      ["currency",     "string", "Requis",    "Devise du pays (XAF, XOF, GNF, CDF…)"],
      ["phone",        "string", "Requis",    "Numero de telephone du payeur"],
      ["operator",     "string", "Requis",    "Nom exact de l'operateur (depuis /v1/countries)"],
      ["country_code", "string", "Requis",    "Code ISO du pays (CM, SN, CI…)"],
      ["reference",    "string", "Optionnel*", "Reference unique de votre commande. *Obligatoire lors du retry OTP."],
      ["otp",          "string", "Optionnel", "Code OTP recu par SMS. Doit etre accompagne du champ reference (valeur recue dans le 400)."],
      ["notify_url",   "string", "Optionnel", "URL webhook pour recevoir le resultat du paiement"],
    ],
    y, [35, 22, 24, 89]
  );
  y = subHeading(doc, "Requete exemple", y);
  y = codeBlock(doc, `fetch("https://ashtechpay.top/v1/collect", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer YOUR_API_KEY",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    amount: 5000,\n    currency: "XAF",\n    phone: "670000000",\n    operator: "MTN Mobile Money",\n    country_code: "CM",\n    reference: "ORDER-001",\n    notify_url: "https://monsite.com/webhook"\n  })\n})`, y, "javascript");
  y = codeBlock(doc, `curl https://ashtechpay.top/v1/collect \\\n  -X POST \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"amount":5000,"currency":"XAF","phone":"670000000",\n       "operator":"MTN Mobile Money","country_code":"CM",\n       "reference":"ORDER-001",\n       "notify_url":"https://monsite.com/webhook"}'`, y, "bash");
  y = subHeading(doc, "Reponse 202 (succes USSD Push)", y);
  y = codeBlock(doc, `{\n  "transaction_id": "8f3e1c2d-...",\n  "reference":      "ORDER-001",\n  "status":         "pending",\n  "amount":         5000,\n  "credited_amount":4750,\n  "fee_amount":     250,\n  "currency":       "XAF",\n  "operator":       "MTN Mobile Money",\n  "phone":          "670000000",\n  "country_code":   "CM",\n  "created_at":     "2026-03-15T14:00:00Z"\n}`, y, "json");

  y = subHeading(doc, "OTP requis — Orange CI/SN/BF/ML (USSD) et LigdiCash BF (SMS)", y);
  y = paragraph(doc, "Orange CI/SN/BF/ML → OTP USSD : le serveur retourne un ussd_code a afficher au client, qui le compose sur son telephone (l'OTP s'affiche dans le menu, aucun SMS envoye). LigdiCash BF → OTP SMS : le serveur envoie un SMS automatiquement (ussd_code = null). Dans les deux cas, la reponse 400 contient un champ 'reference' obligatoire pour l'etape 2.", y);
  y += 2;
  y = codeBlock(doc, `// Etape 1 — Requete initiale (sans otp) → reponse 400\n{\n  "error": "otp_required",\n  "message": "OTP requis. Un code a ete envoye par SMS.",\n  "reference": "DEP-A1B2C3D4",   // ← a conserver absolument\n  "ussd_code": null               // null=SMS auto | "#144*82#"=USSD a composer\n}\n\n// Etape 2 — Retry avec OTP recu + reference du 400 → reponse 202\n{\n  "amount": 5000, "currency": "XOF", "phone": "07XXXXXXXX",\n  "operator": "Orange Money", "country_code": "CI",\n  "otp": "123456",\n  "reference": "DEP-A1B2C3D4",   // ← meme valeur que la reponse 400\n  "notify_url": "https://monsite.com/webhook"\n}`, y, "json");

   // ── §6  Flux ──────────────────────────────────────────────────────────────
   y = sectionTitle(doc, "6. Flux de paiement", y);
  y = paragraph(doc, "Selon le pays et l'operateur, l'API utilise automatiquement l'un des 4 flux ci-dessous. Votre code doit gerer chacun differemment car la reponse et les etapes varient.", y);
  y += 3;
  y = table(doc,
    ["Flux", "Operateurs concernes", "Reponse initiale", "Action requise"],
    [
      ["USSD Push", "MTN, Moov, Airtel, Orange CM, Free SN, T-Money, Flooz, M-Pesa, Afrimoney", "202 pending", "Attendre le webhook. Le client valide sur son telephone."],
      ["OTP USSD",  "Orange CI (#144*82#), SN (#144*391#), BF (*144*4*6*montant#)", "400 otp_required, reference: \"DEP-...\", ussd_code: \"#144*82#\"", "L'API envoie l'OTP par SMS. Relancer avec otp + reference (valeur recue dans le 400)."],
      ["OTP SMS",   "LigdiCash BF (wallet) — SMS envoye automatiquement", "400 otp_required, reference: \"DEP-...\", ussd_code: null", "SMS envoye automatiquement. Relancer avec otp + reference (valeur recue dans le 400)."],
      ["Wave",      "Wave CI, Wave SN", "202 pending, flow: wave, wave_url: ...", "Afficher le wave_url en bouton ou QR code. Le client ouvre Wave."],
    ],
    y, [25, 52, 42, 51]
  );
  y = subHeading(doc, "Detection du flux dans votre code", y);
  y = codeBlock(doc, `async function collectPayment(params) {\n  const res  = await fetch("https://ashtechpay.top/v1/collect", {\n    method: "POST",\n    headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },\n    body: JSON.stringify(params)\n  });\n  const data = await res.json();\n\n  if (res.status === 202 && data.flow === "wave") {\n    // Flux Wave : afficher data.wave_url\n    return { type: "wave", waveUrl: data.wave_url, transactionId: data.transaction_id };\n  }\n  if (res.status === 202) {\n    // Flux USSD Push : attendre webhook\n    return { type: "ussd_push", transactionId: data.transaction_id };\n  }\n  if (res.status === 400 && data.error === "otp_required") {\n    // Stocker data.reference — obligatoire pour le retry OTP\n    if (data.ussd_code) {\n      // OTP USSD (Orange CI, SN, BF) : afficher le code a composer\n      // CI=#144*82#  SN=#144*391#  BF=*144*4*6*montant#\n      return { type: "otp_ussd", ussdCode: data.ussd_code, reference: data.reference };\n    } else {\n      // OTP SMS (Orange CI, SN, ML, LigdiCash BF…) : SMS envoye automatiquement\n      return { type: "otp_sms", reference: data.reference };\n    }\n  }\n  throw new Error(data.message);\n}`, y, "javascript");

   // ── §7  Transaction ───────────────────────────────────────────────────────
   y = sectionTitle(doc, "7. Statut d'une transaction — GET /v1/transaction/:id", y);
  y = paragraph(doc, "Consultez le statut d'une transaction a tout moment via le transaction_id retourne lors de l'initiation. Vous pouvez utiliser ce endpoint en complement du webhook.", y);
  y += 3;
  y = codeBlock(doc, `fetch("https://ashtechpay.top/v1/transaction/8f3e1c2d-...", {\n  headers: { "Authorization": "Bearer YOUR_API_KEY" }\n})`, y, "javascript");
  y = codeBlock(doc, `curl https://ashtechpay.top/v1/transaction/8f3e1c2d-... \\\n  -H "Authorization: Bearer YOUR_API_KEY"`, y, "bash");
  y = codeBlock(doc, `{\n  "transaction_id":  "8f3e1c2d-...",\n  "reference":       "ORDER-001",\n  "status":          "success",\n  "amount":          5000,\n  "credited_amount": 4750,\n  "fee_amount":      250,\n  "currency":        "XAF",\n  "phone":           "670000000",\n  "created_at":      "2026-03-15T14:00:00Z",\n  "confirmed_at":    "2026-03-15T14:02:17Z"\n}`, y, "json");
  y = table(doc,
    ["Statut", "Description", "Final ?"],
    [
      ["pending", "En attente de confirmation de l'operateur", "Non"],
      ["success", "Paiement confirme — compte marchand credite","Oui"],
      ["failed",  "Paiement refuse, expire ou annule",         "Oui"],
    ],
    y, [30, 115, 25]
  );

   // ── §8  Fees ──────────────────────────────────────────────────────────────
   y = sectionTitle(doc, "8. Grille tarifaire en temps reel — GET /v1/fees", y);
  y = paragraph(doc, "Retourne la grille tarifaire en vigueur pour chaque pays actif. Les frais sont configures par l'administrateur et peuvent changer a tout moment. Consultez cet endpoint pour calculer le montant net avant d'appeler /v1/collect.", y);
  y += 3;
  y = codeBlock(doc, `fetch("https://ashtechpay.top/v1/fees", {\n  headers: { "Authorization": "Bearer YOUR_API_KEY" }\n})`, y, "javascript");
  y = codeBlock(doc, `curl https://ashtechpay.top/v1/fees \\\n  -H "Authorization: Bearer YOUR_API_KEY"`, y, "bash");
  y = subHeading(doc, "Reponse", y);
  y = codeBlock(doc, `[\n  {\n    "country_code": "CM",\n    "country_name": "Cameroun",\n    "currency": "XAF",\n    "deposit_fee_pct": 3.5,\n    "withdrawal_fee_pct": 1.5,\n    "transfer_fee_pct": 1.0,\n    "total_fee_pct": 5.5\n  },\n  // ...\n]`, y, "json");
  y = subHeading(doc, "Exemple — calculer le montant net avant d'appeler /v1/collect", y);
  y = codeBlock(doc, `// Recuperer les frais en cache (une fois au demarrage ou toutes les heures)\nconst fees = await fetch("https://ashtechpay.top/v1/fees", {\n  headers: { "Authorization": "Bearer YOUR_API_KEY" }\n}).then(r => r.json());\n\n// Calculer le montant net credite sur votre compte\nfunction computeNet(grossAmount, countryCode) {\n  const fee = fees.find(f => f.country_code === countryCode);\n  if (!fee) return grossAmount;\n  const feeAmount = Math.round(grossAmount * fee.total_fee_pct / 100);\n  return {\n    gross: grossAmount,\n    fee: feeAmount,\n    net: grossAmount - feeAmount,\n    fee_pct: fee.total_fee_pct,\n  };\n}\n\n// Exemple :\nconsole.log(computeNet(10000, "CM"));\n// -> { gross: 10000, fee: 550, net: 9450, fee_pct: 5.5 }`, y, "javascript");

   // ── §9  Webhooks ──────────────────────────────────────────────────────────
   y = sectionTitle(doc, "9. Webhooks", y);
  y = paragraph(doc, "Quand une transaction atteint un etat final, Ashtech Pay envoie automatiquement une requete POST a la notify_url passee dans votre appel a /v1/collect. Le champ amount correspond au montant net apres frais, et total_amount au montant brut collecte.", y);
  y += 3;
  y = subHeading(doc, "Payload — paiement reussi", y);
  y = codeBlock(doc, `{\n  "event":          "payment.completed",\n  "transaction_id": "8f3e1c2d-...",\n  "reference":      "ORDER-001",\n  "status":         "completed",\n  "amount":         4750,       // net apres frais\n  "total_amount":   5000,       // brut collecte\n  "currency":       "XAF",\n  "type":           "deposit",\n  "phone":          "670000000",\n  "timestamp":      "2026-03-15T14:02:17.000Z"\n}`, y, "json");
  y = subHeading(doc, "Evenements disponibles", y);
  y = table(doc,
    ["Evenement", "Declencheur"],
    [
      ["payment.completed","Paiement (depot) confirme avec succes"],
      ["payment.failed",   "Paiement refuse, expire ou annule"],
      ["payout.completed", "Retrait ou virement sortant confirme"],
      ["payout.failed",    "Retrait ou virement echoue"],
    ],
    y, [55, 115]
  );
  y = subHeading(doc, "Handler — Node.js / Express", y);
  y = codeBlock(doc, `app.post("/webhook", express.json(), async (req, res) => {\n  // Toujours repondre 200 en premier\n  res.status(200).json({ received: true });\n\n  const { event, transaction_id, reference, amount, currency } = req.body;\n\n  if (event === "payment.completed") {\n    // amount = montant net (apres frais)\n    await markOrderAsPaid(reference, { transactionId: transaction_id, amount, currency });\n  }\n  if (event === "payment.failed")   { await cancelOrder(reference); }\n  if (event === "payout.completed") { await markPayoutDone(reference, { transactionId: transaction_id }); }\n  if (event === "payout.failed")    { await markPayoutFailed(reference); }\n});`, y, "javascript");
  y = banner(doc, "info", "Bonnes pratiques : Repondez toujours HTTP 200 immediatement. Traitez la logique metier apres avoir repondu 200 (asynchrone). Verifiez le transaction_id dans votre base pour eviter les doublons. Votre notify_url doit etre une URL HTTPS publique (pas localhost).", y);

   // ── §10  Erreurs ──────────────────────────────────────────────────────────
   y = sectionTitle(doc, "10. Codes d'erreur", y);
  y = paragraph(doc, "En cas d'erreur, l'API retourne un objet JSON avec les champs error et message.", y);
  y += 3;
  y = codeBlock(doc, `{\n  "error":   "bad_request",\n  "message": "Champs requis : amount, currency, phone, operator, country_code"\n}`, y, "json");
  y = table(doc,
    ["HTTP", "Erreur", "Signification"],
    [
      ["400","bad_request",        "Parametre manquant ou format invalide"],
      ["400","otp_required",       "OTP requis — conservez le champ reference de la reponse, obligatoire pour la confirmation"],
      ["400","missing_reference",  "Confirmation OTP sans le champ reference — utilisez la valeur recue dans la reponse otp_required"],
      ["400","otp_expired",        "Session OTP expiree (15 min) ou introuvable — relancez sans otp pour initier une nouvelle session"],
      ["401","unauthorized",       "Cle API manquante, invalide ou revoquee"],
      ["403","forbidden",     "Cette transaction n'appartient pas a votre compte"],
      ["404","not_found",     "Transaction introuvable"],
       ["422","unprocessable", "Pays, operateur ou reseau crypto non supporte / devise incorrecte"],
       ["422","asset_disabled", "Le reseau crypto a ete desactive par l'administrateur"],
       ["503","crypto_unavailable", "Le catalogue ou le service de paiement crypto est indisponible"],
      ["429","rate_limited",  "Trop de requetes — ralentissez"],
      ["502","gateway_error", "Le reseau de l'operateur a rejete le paiement"],
      ["500","server_error",  "Erreur interne — reessayez"],
    ],
    y, [18, 38, 114]
  );
  y = banner(doc, "info", "Pour toute question technique non resolue par cette documentation, contactez notre equipe via le support integre a l'application.", y);

  // ── Footers ───────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p > 1) addFooter(doc, p - 1, total - 1, "Ashtech Pay — Documentation API Direct v1");
  }

  doc.save("AshtechPay_API_Direct_v1.pdf");
}
