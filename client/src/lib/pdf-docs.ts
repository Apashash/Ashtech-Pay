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

/** Code block with dark background */
function codeBlock(doc: jsPDF, code: string, y: number, lang = ""): number {
  const lines = code.split("\n");
  const lineH = 4.8;
  const padV = 4;
  const padH = 5;
  const blockH = lines.length * lineH + padV * 2 + (lang ? 6 : 0);

  y = checkPage(doc, y, Math.min(blockH + 4, 60));

  if (lang) {
    fill(doc, [30, 40, 55]);
    doc.rect(ML, y, CW, 6, "F");
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 120, 150);
    doc.text(lang, ML + padH, y + 4.2);
    y += 6;
  }

  fill(doc, C.codeBg);
  doc.rect(ML, y, CW, lines.length * lineH + padV * 2, "F");

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  rgb(doc, C.codeText);

  let cy = y + padV + lineH * 0.7;
  for (const line of lines) {
    if (cy > PAGE_H - 20) {
      doc.addPage();
      fill(doc, C.codeBg);
      doc.rect(ML, 15, CW, (lines.length - lines.indexOf(line)) * lineH + padV * 2, "F");
      cy = 22;
    }
    const trimmed = line.slice(0, 90); // clip very long lines
    doc.text(trimmed, ML + padH, cy);
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
  const title = "Documentation — Hosted Payment Page v1";

  // ── Cover ──────────────────────────────────────────────────────────────────
  fill(doc, C.cover);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Gold accent bar
  fill(doc, C.gold);
  doc.rect(0, 0, 6, PAGE_H, "F");

  // Logo / brand
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

  // Divider
  fill(doc, C.gold);
  doc.rect(ML + 6, 99, 40, 0.8, "F");

  // Description
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  rgb(doc, [148, 163, 184]);
  const desc = "Créez des liens de paiement hébergés et acceptez des paiements Mobile Money dans 20+ pays africains et asiatiques, sans gérer vous-même la page de paiement.";
  const descLines = doc.splitTextToSize(desc, CW - 6);
  doc.text(descLines, ML + 6, 108);

  // Metadata boxes
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

  // Footer note
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  rgb(doc, [71, 85, 105]);
  doc.text("ashtechpay.top  •  support@ashtechpay.top", ML + 6, PAGE_H - 18);

  // ── Page 2+ — Content ──────────────────────────────────────────────────────
  doc.addPage();
  let y = 22;

  // Table of contents
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  rgb(doc, C.navy);
  doc.text("Sommaire", ML, y);
  y += 8;
  draw(doc, [203, 213, 225]);
  doc.line(ML, y, ML + CW, y);
  y += 6;

  const toc = [
    "1.  Les 3 types de clés API",
    "2.  Créer un lien de paiement   POST /api/v1/hosted-payment/create",
    "3.  Prix fixe — montant défini à l'avance",
    "4.  Prix libre — le client choisit le montant",
    "5.  Filtrer par pays",
    "6.  Vérifier le statut   GET /api/v1/hosted-payment/:id",
    "7.  Créditement des wallets",
    "8.  Webhook — notification automatique",
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

  // ── §1  Clés API ──────────────────────────────────────────────────────────
  y = sectionTitle(doc, "1. Les 3 types de clés API", y);
  y = paragraph(doc, "Ashtech Pay utilise trois clés API distinctes selon le cas d'usage. Obtenez-les dans Tableau de bord → Paramètres API Keys.", y);
  y += 4;

  y = table(doc,
    ["Clé", "Préfixe", "Usage"],
    [
      ["Clé publique",          "pk_live_",  "Identification publique de votre compte (côté navigateur autorisé)"],
      ["Clé secrète",           "sk_live_",  "Opérations back-end sensibles — ne jamais exposer côté client"],
      ["Clé Hosted Page",       "hp_live_",  "Créer et gérer les liens de paiement hébergés"],
    ],
    y, [38, 32, 100]
  );
  y = banner(doc, "warn", "Gardez sk_live_ et hp_live_ strictement côté serveur. Ne les exposez jamais dans du code front-end ou mobile.", y);

  // ── §2  Créer un lien ─────────────────────────────────────────────────────
  y = sectionTitle(doc, "2. Créer un lien de paiement", y);
  y = subHeading(doc, "POST /api/v1/hosted-payment/create", y);
  y = paragraph(doc, "Crée un lien de paiement hébergé unique. Le client est redirigé vers une page Ashtech Pay sécurisée pour finaliser le paiement.", y);
  y += 3;
  y = subHeading(doc, "En-têtes requis", y);
  y = codeBlock(doc, `Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx\nContent-Type: application/json`, y, "http");
  y = subHeading(doc, "Corps de la requête (JSON)", y);
  y = table(doc,
    ["Paramètre", "Type", "Statut", "Description"],
    [
      ["currency",          "string",  "Requis",    "Devise ISO (XAF, XOF, GNF…) ou code pays spécifique"],
      ["amount",            "number",  "Optionnel", "Montant fixe à collecter (omettre pour prix libre)"],
      ["description",       "string",  "Optionnel", "Description affichée sur la page de paiement"],
      ["is_fixed_amount",   "boolean", "Optionnel", "true = montant verrouillé  /  false = client choisit"],
      ["allowed_countries", "string[]","Optionnel", "Codes pays autorisés, ex: [\"CM\",\"SN\"]. null = tous"],
      ["notify_url",        "string",  "Optionnel", "URL webhook — remplace l'URL par défaut pour ce lien"],
      ["expires_in",        "number",  "Optionnel", "Durée de validité en heures (défaut : 72h)"],
    ],
    y, [35, 24, 24, 87]
  );
  y = subHeading(doc, "Réponse 200 (succès)", y);
  y = codeBlock(doc, `{\n  "payment_link": "https://ashtechpay.top/hpay/hp-ab12cd34ef56",\n  "payment_id":   "uuid-de-la-session",\n  "expires_at":   "2026-03-18T03:00:00.000Z",\n  "status":       "pending",\n  "amount":       5000,\n  "currency":     "XAF"\n}`, y, "json");

  // ── §3  Prix fixe ─────────────────────────────────────────────────────────
  y = sectionTitle(doc, "3. Prix fixe — montant défini à l'avance", y);
  y = paragraph(doc, "Passez amount + is_fixed_amount: true (ou omettez simplement is_fixed_amount — il sera déduit automatiquement si amount est fourni). Le client ne peut pas modifier le montant.", y);
  y += 3;
  y = codeBlock(doc, `// Prix fixe — 5 000 XAF\n{\n  "currency": "XAF",\n  "amount": 5000,\n  "description": "Commande #123",\n  "allowed_countries": ["CM"]\n}`, y, "json");

  // ── §4  Prix libre ────────────────────────────────────────────────────────
  y = sectionTitle(doc, "4. Prix libre — le client choisit le montant", y);
  y = paragraph(doc, "Omettez amount ou passez is_fixed_amount: false. Le client saisit le montant qu'il souhaite sur la page de paiement. Utile pour les dons, pourboires ou factures ouvertes.", y);
  y += 3;
  y = codeBlock(doc, `// Prix libre — don\n{\n  "currency": "XOF",\n  "description": "Don — saisissez le montant de votre choix",\n  "is_fixed_amount": false\n}`, y, "json");

  // ── §5  Filtrer par pays ──────────────────────────────────────────────────
  y = sectionTitle(doc, "5. Filtrer par pays", y);
  y = paragraph(doc, "Passez allowed_countries pour n'afficher que certains opérateurs. Sans ce champ (ou null), tous les 20+ pays sont disponibles.", y);
  y += 3;
  y = codeBlock(doc, `// Lien restreint au Cameroun et Sénégal\n{\n  "currency": "XAF",\n  "amount": 10000,\n  "allowed_countries": ["CM", "SN"]\n}`, y, "json");
  y += 2;

  y = table(doc,
    ["Pays", "Code", "Devise wallet"],
    [
      ["Cameroun","CM","XAF"],["Gabon","GA","XAFG"],["Congo","CG","XAFC"],["RD Congo","CD","CDF"],
      ["Sénégal","SN","XOFS"],["Côte d'Ivoire","CI","XOFC"],["Burkina Faso","BF","XOFF"],["Mali","ML","XOF"],
      ["Bénin","BJ","XOFB"],["Togo","TG","XOFT"],["Tanzanie","TZ","TZS"],["Ouganda","UG","UGX"],
      ["Nigeria","NG","NGN"],["Kenya","KE","KES"],["Niger","NE","XOFN"],["Rwanda","RW","RWF"],
      ["Guinée","GN","GNF"],["Ghana","GH","GHS"],["Gambie","GM","GMD"],
    ],
    y, [55, 35, 80]
  );

  // ── §6  Statut ─────────────────────────────────────────────────────────────
  y = sectionTitle(doc, "6. Vérifier le statut d'un lien", y);
  y = subHeading(doc, "GET /api/v1/hosted-payment/:payment_id", y);
  y = codeBlock(doc, `curl https://ashtechpay.top/api/v1/hosted-payment/UUID_DU_LIEN \\\n  -H "Authorization: Bearer hp_live_xxxxxxxx"`, y, "bash");
  y = paragraph(doc, "Réponse :", y);
  y = codeBlock(doc, `{\n  "status":   "success",    // pending | processing | success | failed | expired\n  "paid_at":  "2026-03-16T14:23:00Z",\n  "amount":   5000,\n  "currency": "XAF",\n  "phone":    "656123456"\n}`, y, "json");

  y = table(doc,
    ["Statut", "Signification", "Final ?"],
    [
      ["pending",    "Lien créé — aucun paiement encore",      "Non"],
      ["processing", "Paiement initié, en attente confirmation","Non"],
      ["success",    "Paiement confirmé — wallet crédité",     "Oui"],
      ["failed",     "Paiement refusé ou annulé",              "Oui"],
      ["expired",    "Lien expiré avant tout paiement",        "Oui"],
    ],
    y, [35, 100, 35]
  );

  // ── §7  Créditement ───────────────────────────────────────────────────────
  y = sectionTitle(doc, "7. Créditement des wallets", y);
  y = paragraph(doc, "Après un paiement réussi, le montant net (après déduction des frais) est automatiquement crédité :", y);
  y += 3;
  y = paragraph(doc, "• Paiements XAF/XOF et variantes (XAFC, XAFG, XOFB, XOFS…) → créditent le wallet principal (balance).", y, 3);
  y += 2;
  y = paragraph(doc, "• Paiements dans une autre devise (NGN, KES, GHS…) → créditent un wallet secondaire dédié à cette devise.", y, 3);
  y += 2;
  y = paragraph(doc, "Le amount dans le webhook correspond au montant net crédité sur votre wallet. Le total_amount est le montant brut payé par le client.", y, 3);
  y += 4;
  y = banner(doc, "tip", "Vous pouvez convertir vos wallets secondaires en XAF/XOF depuis Tableau de bord → Wallets.", y);

  // ── §8  Webhook ───────────────────────────────────────────────────────────
  y = sectionTitle(doc, "8. Webhook — notification automatique", y);
  y = paragraph(doc, "Configurez votre Webhook URL dans Paramètres → API Keys. Elle est récupérée automatiquement à chaque paiement Hosted Page — pas besoin de la passer dans chaque création de lien.", y);
  y += 2;
  y = banner(doc, "info", "Vous pouvez aussi passer un notify_url spécifique lors de la création d'un lien — il remplace l'URL par défaut pour ce lien uniquement.", y);
  y = subHeading(doc, "Payload reçu (POST → votre serveur)", y);
  y = codeBlock(doc, `{\n  "event":          "payment.completed",  // ou "payment.failed"\n  "transaction_id": "uuid-de-la-txn",\n  "reference":      "ASHPAY-DEP-XXXXXXXXXX",\n  "status":         "completed",\n  "amount":         4750,     // net crédité sur votre wallet\n  "total_amount":   5000,     // brut payé par le client\n  "currency":       "XAF",\n  "type":           "deposit",\n  "phone":          "656123456",\n  "timestamp":      "2026-03-16T03:00:00.000Z"\n}`, y, "json");

  y = subHeading(doc, "Récepteur webhook — Node.js / Express", y);
  y = codeBlock(doc, `app.post("/webhooks/ashtechpay", express.json(), (req, res) => {\n  res.sendStatus(200);  // Répondre 200 AVANT tout traitement\n\n  const { event, transaction_id, amount, currency } = req.body;\n\n  if (event === "payment.completed") {\n    // Paiement confirmé → créditer client, livrer commande\n    console.log(\`Reçu : \${amount} \${currency}\`);\n  }\n\n  if (event === "payment.failed") {\n    // Paiement échoué → annuler commande\n  }\n});`, y, "javascript");
  y = banner(doc, "warn", "Répondez toujours HTTP 200 immédiatement. Si votre serveur répond autre chose, le webhook ne sera pas renvoyé.", y);

  // ── §9  Exemples ──────────────────────────────────────────────────────────
  y = sectionTitle(doc, "9. Exemples de code", y);

  y = subHeading(doc, "Node.js", y);
  y = codeBlock(doc, `const HP_KEY = process.env.HP_LIVE_KEY;\n\nasync function createLink({ amount, currency, description, countries }) {\n  const res = await fetch("https://ashtechpay.top/api/v1/hosted-payment/create", {\n    method: "POST",\n    headers: {\n      "Authorization": \`Bearer \${HP_KEY}\`,\n      "Content-Type": "application/json",\n    },\n    body: JSON.stringify({\n      currency,\n      amount,\n      description,\n      is_fixed_amount: !!amount,\n      allowed_countries: countries ?? null,\n    }),\n  });\n  return res.json();\n  // { payment_link, payment_id, expires_at, ... }\n}\n\nasync function checkStatus(paymentId) {\n  const res = await fetch(\n    \`https://ashtechpay.top/api/v1/hosted-payment/\${paymentId}\`,\n    { headers: { "Authorization": \`Bearer \${HP_KEY}\` } }\n  );\n  return res.json();\n  // { status: "pending" | "success" | "failed" | "expired", paid_at, amount }\n}`, y, "javascript");

  y = subHeading(doc, "PHP", y);
  y = codeBlock(doc, `$hpKey = getenv("HP_LIVE_KEY");\n\nfunction createPaymentLink($currency, $amount, $description) {\n  global $hpKey;\n  $ch = curl_init("https://ashtechpay.top/api/v1/hosted-payment/create");\n  curl_setopt_array($ch, [\n    CURLOPT_POST           => true,\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_HTTPHEADER     => [\n      "Authorization: Bearer $hpKey",\n      "Content-Type: application/json",\n    ],\n    CURLOPT_POSTFIELDS => json_encode([\n      "currency"        => $currency,\n      "amount"          => $amount,\n      "description"     => $description,\n      "is_fixed_amount" => !empty($amount),\n    ]),\n  ]);\n  $result = json_decode(curl_exec($ch), true);\n  curl_close($ch);\n  return $result;\n}\n\n$link = createPaymentLink("XAF", 10000, "Facture #456");\nheader("Location: " . $link["payment_link"]);`, y, "php");

  y = subHeading(doc, "cURL", y);
  y = codeBlock(doc, `# Prix fixe — Cameroun uniquement\ncurl -X POST https://ashtechpay.top/api/v1/hosted-payment/create \\\n  -H "Authorization: Bearer hp_live_xxxxxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"currency":"XAF","amount":5000,"description":"Commande","allowed_countries":["CM"]}'\n\n# Prix libre — tous les pays\ncurl -X POST https://ashtechpay.top/api/v1/hosted-payment/create \\\n  -H "Authorization: Bearer hp_live_xxxxxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"currency":"XOF","description":"Don","is_fixed_amount":false}'\n\n# Vérifier le statut\ncurl https://ashtechpay.top/api/v1/hosted-payment/UUID_DU_LIEN \\\n  -H "Authorization: Bearer hp_live_xxxxxxxx"`, y, "bash");

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
  doc.text("v1  •  Mobile Money — 16 pays africains", ML + 6, 93);

  fill(doc, C.gold);
  doc.rect(ML + 6, 99, 50, 0.8, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  rgb(doc, [148, 163, 184]);
  const desc2 = "Initiez des paiements Mobile Money directement depuis votre serveur, sans redirection. Gérez les flux USSD Push, OTP SMS, OTP USSD et Wave en 16 pays.";
  doc.text(doc.splitTextToSize(desc2, CW - 6), ML + 6, 108);

  const meta2 = [
    ["Endpoint collect",  "POST /v1/collect"],
    ["Authentification",  "Bearer ak_live_xxxxxxxx"],
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
    "3.  GET /v1/countries — Pays et opérateurs",
    "4.  POST /v1/collect — Initier un paiement",
    "5.  Flux de paiement   (USSD Push · OTP SMS · OTP USSD · Wave)",
    "6.  GET /v1/transaction/:id — Statut d'une transaction",
    "7.  Webhooks",
    "8.  Codes d'erreur",
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
  y = paragraph(doc, "L'API Ashtech Pay permet à vos applications d'initier des paiements Mobile Money dans 16 pays africains, sans redirection. Elle gère automatiquement le routage entre les opérateurs et vous notifie du résultat via webhook.", y);
  y += 3;
  y = table(doc,
    ["Caractéristique", "Détail"],
    [
      ["Base URL",        "https://ashtechpay.top"],
      ["Format",          "JSON uniquement — Content-Type: application/json"],
      ["Authentification","Bearer token dans l'en-tête Authorization"],
      ["Protocole",       "HTTPS obligatoire"],
      ["Versioning",      "Préfixe /v1/ dans tous les endpoints"],
    ],
    y, [55, 115]
  );

  // ── §2  Auth ──────────────────────────────────────────────────────────────
  y = sectionTitle(doc, "2. Authentification", y);
  y = paragraph(doc, "Toutes les requêtes doivent inclure votre clé API dans l'en-tête HTTP Authorization.", y);
  y += 3;
  y = codeBlock(doc, `Authorization: Bearer ak_live_xxxxxxxxxxxxxxxxxxxxxxxx`, y, "http");
  y = banner(doc, "warn", "Utilisez votre clé API uniquement depuis votre serveur (Node.js, Python, PHP…). Ne l'incluez jamais dans du code côté navigateur ou application mobile.", y);
  y = paragraph(doc, "Exemple d'appel authentifié (Node.js) :", y);
  y = codeBlock(doc, `const response = await fetch("https://ashtechpay.top/v1/collect", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer ak_live_xxxxxxxx",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({ /* ... */ })\n});`, y, "javascript");

  // ── §3  Countries ─────────────────────────────────────────────────────────
  y = sectionTitle(doc, "3. Pays et opérateurs — GET /v1/countries", y);
  y = paragraph(doc, "Retourne la liste complète des pays actifs et leurs opérateurs Mobile Money. Utilisez cet endpoint pour peupler dynamiquement votre interface de paiement.", y);
  y += 3;
  y = codeBlock(doc, `fetch("https://ashtechpay.top/v1/countries", {\n  headers: { "Authorization": "Bearer ak_live_xxxxxxxx" }\n})`, y, "javascript");
  y = subHeading(doc, "Pays disponibles (16)", y);
  y = table(doc,
    ["Pays", "Code", "Devise", "Opérateurs"],
    [
      ["Bénin",         "BJ","XOFB","Moov Money, MTN Mobile Money"],
      ["Burkina Faso",  "BF","XOFF","Moov Money, Orange Money ⚡"],
      ["Cameroun",      "CM","XAF", "MTN Mobile Money, Orange Money"],
      ["Centrafrique",  "CF","XAF", "Orange Money ⚡"],
      ["Congo",         "CG","XAFC","Airtel Money, MTN Mobile Money"],
      ["Côte d'Ivoire", "CI","XOFC","Moov Money, MTN, Orange ⚡, Wave 🔗"],
      ["Gabon",         "GA","XAFG","Airtel Money, Moov Money"],
      ["Guinée Conakry","GN","GNF", "MTN Mobile Money, Orange Money ⚡"],
      ["Guinée éq.",    "GQ","XAF", "Orange Money ⚡"],
      ["Guinée-Bissau", "GW","XOF", "Orange Money ⚡"],
      ["Mali",          "ML","XOF", "Moov Money, Orange Money ⚡"],
      ["Niger",         "NE","XOFN","Airtel Money"],
      ["RD Congo",      "CD","CDF", "Afrimoney, Airtel, Orange ⚡, Vodacom M-Pesa"],
      ["Sénégal",       "SN","XOFS","Free Money, Orange Money ⚡, Wave 🔗"],
      ["Tchad",         "TD","XAF", "Airtel Money, Moov Money"],
      ["Togo",          "TG","XOFT","Flooz (Moov), T-Money"],
    ],
    y, [38, 14, 20, 98]
  );
  y = paragraph(doc, "Légende : ⚡ OTP requis (SMS reçu)   •   🔗 Wave — lien de paiement", y);
  y += 4;

  // ── §4  Collect ───────────────────────────────────────────────────────────
  y = sectionTitle(doc, "4. Initier un paiement — POST /v1/collect", y);
  y = paragraph(doc, "Initie un paiement Mobile Money. Le client reçoit une demande de validation sur son téléphone. Les frais de la plateforme sont déduits automatiquement — le champ `credited_amount` est le montant net crédité.", y);
  y += 3;
  y = subHeading(doc, "Corps de la requête (JSON)", y);
  y = table(doc,
    ["Paramètre", "Type", "Statut", "Description"],
    [
      ["amount",       "number", "Requis",    "Montant brut à collecter"],
      ["currency",     "string", "Requis",    "Devise du pays (XAF, XOF, GNF, CDF…)"],
      ["phone",        "string", "Requis",    "Numéro de téléphone du payeur"],
      ["operator",     "string", "Requis",    "Nom exact de l'opérateur (depuis /v1/countries)"],
      ["country_code", "string", "Requis",    "Code ISO du pays (CM, SN, CI…)"],
      ["reference",    "string", "Optionnel", "Référence unique de votre commande"],
      ["otp",          "string", "Optionnel", "Code OTP si requis (voir réponse 400 otp_required)"],
      ["notify_url",   "string", "Optionnel", "URL webhook pour recevoir le résultat du paiement"],
    ],
    y, [35, 22, 24, 89]
  );
  y = subHeading(doc, "Requête exemple", y);
  y = codeBlock(doc, `fetch("https://ashtechpay.top/v1/collect", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer ak_live_xxxxxxxx",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    amount: 5000,\n    currency: "XAF",\n    phone: "670000000",\n    operator: "MTN Mobile Money",\n    country_code: "CM",\n    reference: "ORDER-001",\n    notify_url: "https://monsite.com/webhook"\n  })\n})`, y, "javascript");
  y = subHeading(doc, "Réponse 202 (succès USSD Push)", y);
  y = codeBlock(doc, `{\n  "transaction_id": "8f3e1c2d-...",\n  "reference":      "ORDER-001",\n  "status":         "pending",\n  "amount":         5000,\n  "credited_amount":4750,\n  "fee_amount":     250,\n  "currency":       "XAF"\n}`, y, "json");

  // ── §5  Flux ──────────────────────────────────────────────────────────────
  y = sectionTitle(doc, "5. Flux de paiement", y);
  y = paragraph(doc, "Selon le pays et l'opérateur, l'API utilise automatiquement l'un des 4 flux. Votre code doit gérer chacun différemment.", y);
  y += 3;
  y = table(doc,
    ["Flux", "Opérateurs", "Réponse", "Action"],
    [
      ["USSD Push","MTN, Moov, Airtel, Orange CM, Free SN, T-Money…","202 pending","Attendre webhook — client valide sur son tél."],
      ["OTP SMS",  "Orange (CI, SN, ML, GN, CF, CG, GA, GW, GQ, CD)","400 otp_required, ussd_code=null","Le client reçoit SMS OTP. Relancer avec otp."],
      ["OTP USSD", "Orange Money BF uniquement","400 otp_required, ussd_code: *144*...", "Client compose le code USSD puis renvoie OTP."],
      ["Wave",     "Wave CI, Wave SN","202 pending, flow: wave, wave_url: ...","Afficher wave_url comme bouton/QR code."],
    ],
    y, [25, 55, 42, 48]
  );
  y = subHeading(doc, "Détection du flux dans votre code", y);
  y = codeBlock(doc, `const res  = await fetch("/v1/collect", { method: "POST", ... });\nconst data = await res.json();\n\nif (res.status === 202 && data.flow === "wave") {\n  // Flux Wave → afficher data.wave_url\n  return { type: "wave", waveUrl: data.wave_url };\n}\nif (res.status === 202) {\n  // Flux USSD Push → attendre webhook\n  return { type: "ussd_push", txId: data.transaction_id };\n}\nif (res.status === 400 && data.error === "otp_required") {\n  if (data.ussd_code) {\n    // OTP USSD (BF Orange) → afficher code USSD\n    return { type: "otp_ussd", ussdCode: data.ussd_code };\n  } else {\n    // OTP SMS → demander OTP au client\n    return { type: "otp_sms" };\n  }\n}\nthrow new Error(data.message);`, y, "javascript");

  // ── §6  Transaction ───────────────────────────────────────────────────────
  y = sectionTitle(doc, "6. Statut d'une transaction — GET /v1/transaction/:id", y);
  y = paragraph(doc, "Consultez le statut d'une transaction à tout moment via le transaction_id retourné lors de l'initiation.", y);
  y += 3;
  y = codeBlock(doc, `fetch("https://ashtechpay.top/v1/transaction/8f3e1c2d-...", {\n  headers: { "Authorization": "Bearer ak_live_xxxxxxxx" }\n})`, y, "javascript");
  y = codeBlock(doc, `{\n  "transaction_id":  "8f3e1c2d-...",\n  "reference":       "ORDER-001",\n  "status":          "success",\n  "amount":          5000,\n  "credited_amount": 4750,\n  "fee_amount":      250,\n  "currency":        "XAF",\n  "phone":           "670000000",\n  "created_at":      "2026-03-15T14:00:00Z",\n  "confirmed_at":    "2026-03-15T14:02:17Z"\n}`, y, "json");
  y = table(doc,
    ["Statut", "Description", "Final ?"],
    [
      ["pending", "En attente de confirmation de l'opérateur", "Non"],
      ["success", "Paiement confirmé — compte marchand crédité","Oui"],
      ["failed",  "Paiement refusé, expiré ou annulé",         "Oui"],
    ],
    y, [30, 115, 25]
  );

  // ── §7  Webhooks ──────────────────────────────────────────────────────────
  y = sectionTitle(doc, "7. Webhooks", y);
  y = paragraph(doc, "Quand une transaction atteint un état final, Ashtech Pay envoie une requête POST à la notify_url passée dans votre appel à /v1/collect.", y);
  y += 3;
  y = codeBlock(doc, `// Paiement réussi\n{\n  "event":          "payment.completed",\n  "transaction_id": "8f3e1c2d-...",\n  "reference":      "ORDER-001",\n  "status":         "completed",\n  "amount":         4750,       // net après frais\n  "total_amount":   5000,       // brut collecté\n  "currency":       "XAF",\n  "phone":          "670000000",\n  "timestamp":      "2026-03-15T14:02:17.000Z"\n}`, y, "json");
  y = subHeading(doc, "Événements disponibles", y);
  y = table(doc,
    ["Événement", "Déclencheur"],
    [
      ["payment.completed","Paiement (dépôt) confirmé avec succès"],
      ["payment.failed",   "Paiement refusé, expiré ou annulé"],
      ["payout.completed", "Retrait ou virement sortant confirmé"],
      ["payout.failed",    "Retrait ou virement échoué"],
    ],
    y, [55, 115]
  );
  y = subHeading(doc, "Handler — Node.js / Express", y);
  y = codeBlock(doc, `app.post("/webhook", express.json(), async (req, res) => {\n  res.status(200).json({ received: true }); // Répondre 200 en PREMIER\n\n  const { event, transaction_id, reference, amount, currency } = req.body;\n\n  if (event === "payment.completed") {\n    await markOrderAsPaid(reference, { transaction_id, amount, currency });\n  }\n  if (event === "payment.failed")    { await cancelOrder(reference); }\n  if (event === "payout.completed")  { await markPayoutDone(reference); }\n  if (event === "payout.failed")     { await markPayoutFailed(reference); }\n});`, y, "javascript");
  y = banner(doc, "info", "Répondez toujours HTTP 200 immédiatement. Traitez la logique métier après. Vérifiez le transaction_id pour éviter les doublons. Votre notify_url doit être une URL HTTPS publique (pas localhost).", y);

  // ── §8  Erreurs ───────────────────────────────────────────────────────────
  y = sectionTitle(doc, "8. Codes d'erreur", y);
  y = paragraph(doc, "En cas d'erreur, l'API retourne un objet JSON avec les champs `error` et `message`.", y);
  y += 3;
  y = codeBlock(doc, `{\n  "error":   "bad_request",\n  "message": "Champs requis : amount, currency, phone, operator, country_code"\n}`, y, "json");
  y = table(doc,
    ["HTTP", "Erreur", "Signification"],
    [
      ["400","bad_request",   "Paramètre manquant ou format invalide"],
      ["400","otp_required",  "OTP nécessaire — vérifiez ussd_code dans la réponse"],
      ["401","unauthorized",  "Clé API manquante, invalide ou révoquée"],
      ["403","forbidden",     "Cette transaction n'appartient pas à votre compte"],
      ["404","not_found",     "Transaction introuvable"],
      ["422","unprocessable", "Pays ou opérateur non supporté / devise incorrecte"],
      ["429","rate_limited",  "Trop de requêtes — ralentissez"],
      ["502","gateway_error", "Le réseau de l'opérateur a rejeté le paiement"],
      ["500","server_error",  "Erreur interne — réessayez"],
    ],
    y, [18, 38, 114]
  );
  y = banner(doc, "info", "Pour toute question technique non résolue par cette documentation, contactez notre équipe via le support intégré à l'application.", y);

  // ── Footers ───────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p > 1) addFooter(doc, p - 1, total - 1, "Ashtech Pay — Documentation API Direct v1");
  }

  doc.save("AshtechPay_API_Direct_v1.pdf");
}
