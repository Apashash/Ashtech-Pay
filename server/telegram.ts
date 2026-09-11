/**
 * Service de notifications Telegram — AshTech Pay
 * Envoie des alertes en temps réel pour toutes les transactions et événements de sécurité.
 */

import crypto from "crypto";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BOT_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

const TELEGRAM_API = BOT_TOKEN
  ? `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
  : null;

function isConfigured(): boolean {
  return !!(BOT_TOKEN && CHAT_ID);
}

async function callBotApi(method: string, body: Record<string, any>): Promise<any> {
  if (!BOT_API) {
    console.warn("[Telegram] callBotApi: BOT_API non configuré — TELEGRAM_BOT_TOKEN manquant.");
    return null;
  }
  try {
    const res = await fetch(`${BOT_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) {
      console.error(`[Telegram] ${method} réponse d'erreur:`, JSON.stringify(json));
    }
    return json;
  } catch (err: any) {
    console.error(`[Telegram] ${method} exception:`, err?.message);
    return null;
  }
}

export async function sendMessage(text: string): Promise<void> {
  if (!isConfigured()) return;
  await callBotApi("sendMessage", {
    chat_id: CHAT_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

async function sendMessageWithKeyboard(text: string, inline_keyboard: any[][]): Promise<number | null> {
  if (!isConfigured()) return null;
  const result = await callBotApi("sendMessage", {
    chat_id: CHAT_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard },
  });
  return result?.result?.message_id ?? null;
}

export type TelegramKycFile = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
};

async function sendDocumentBuffer(document: TelegramKycFile, caption?: string): Promise<void> {
  if (!isConfigured() || !BOT_API) return;

  try {
    const form = new FormData();
    form.append("chat_id", CHAT_ID!);
    form.append(
      "document",
      new Blob([new Uint8Array(document.buffer)], { type: document.contentType }),
      document.fileName,
    );
    if (caption) {
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
    }

    const response = await fetch(`${BOT_API}/sendDocument`, {
      method: "POST",
      body: form,
    });
    const result = await response.json();
    if (!result.ok) {
      console.error("[Telegram] sendDocument (KYC) réponse d'erreur:", JSON.stringify(result));
    }
  } catch (error: any) {
    console.error("[Telegram] sendDocument (KYC) exception:", error?.message || error);
  }
}

async function sendWithBanner(
  chatId: string,
  bannerType: string,
  text: string,
  replyMarkup?: any
): Promise<void> {
  if (!BOT_API) return;
  const appUrl = process.env.APP_URL || "";
  const extra = replyMarkup ? { reply_markup: replyMarkup } : {};
  if (!appUrl) {
    await callBotApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
    return;
  }
  const photoUrl = `${appUrl}/api/bot/banner/${bannerType}`;
  if (text.length <= 1024) {
    await callBotApi("sendPhoto", { chat_id: chatId, photo: photoUrl, caption: text, parse_mode: "HTML", ...extra });
  } else {
    await callBotApi("sendPhoto", { chat_id: chatId, photo: photoUrl });
    await callBotApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await callBotApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text ?? "",
    show_alert: !!text,
  });
}

async function editMessageKeyboard(messageId: number, inline_keyboard: any[][] | null): Promise<void> {
  if (!isConfigured()) return;
  await callBotApi("editMessageReplyMarkup", {
    chat_id: CHAT_ID,
    message_id: messageId,
    reply_markup: inline_keyboard ? { inline_keyboard } : {},
  });
}

async function editMessageText(messageId: number, text: string): Promise<void> {
  if (!isConfigured()) return;
  await callBotApi("editMessageText", {
    chat_id: CHAT_ID,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

// State: waiting for custom rejection reason (chatId → submissionId + messageId)
const pendingCustomRejections = new Map<string, { submissionId: string; messageId: number; ts: number }>();
// State: waiting for withdrawal rejection reason (chatId → reference + messageId)
const pendingWithdrawalRejections = new Map<string, { reference: string; messageId: number; ts: number }>();
// State: waiting for withdrawal number change rejection reason (chatId → changeId + messageId)
const pendingWncRejections = new Map<string, { changeId: string; messageId: number; ts: number }>();
// State: waiting for ticket reply text (chatId → ticketId + timestamp)
const pendingTicketReplies = new Map<string, { ticketId: string; ts: number }>();

// ── Cleanup stale pending states every 30 minutes ─────────────────────────────
// Without this, Maps grow indefinitely if Telegram callbacks never arrive
// (bot disconnected, admin closed chat, etc.) → memory leak → OOM crash over time.
const PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutes
setInterval(() => {
  const cutoff = Date.now() - PENDING_TTL_MS;
  for (const [k, v] of pendingCustomRejections) if (v.ts < cutoff) pendingCustomRejections.delete(k);
  for (const [k, v] of pendingWithdrawalRejections) if (v.ts < cutoff) pendingWithdrawalRejections.delete(k);
  for (const [k, v] of pendingWncRejections) if (v.ts < cutoff) pendingWncRejections.delete(k);
  for (const [k, v] of pendingTicketReplies) if (v.ts < cutoff) pendingTicketReplies.delete(k);
}, PENDING_TTL_MS);

function fmt(amount: string | number, currency: string): string {
  return `${parseFloat(String(amount)).toLocaleString("fr-FR")} ${currency}`;
}

function now(): string {
  return new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" });
}

// ─── DRAPEAUX & PAYS ──────────────────
const COUNTRY_INFO: Record<string, { flag: string; name: string }> = {
  CM: { flag: "🇨🇲", name: "Cameroun" },
  SN: { flag: "🇸🇳", name: "Sénégal" },
  CI: { flag: "🇨🇮", name: "Côte d'Ivoire" },
  BF: { flag: "🇧🇫", name: "Burkina Faso" },
  ML: { flag: "🇲🇱", name: "Mali" },
  BJ: { flag: "🇧🇯", name: "Bénin" },
  TG: { flag: "🇹🇬", name: "Togo" },
  NE: { flag: "🇳🇪", name: "Niger" },
  GA: { flag: "🇬🇦", name: "Gabon" },
  CG: { flag: "🇨🇬", name: "Congo" },
  CF: { flag: "🇨🇫", name: "Centrafrique" },
  TD: { flag: "🇹🇩", name: "Tchad" },
  CD: { flag: "🇨🇩", name: "RD Congo" },
  TZ: { flag: "🇹🇿", name: "Tanzanie" },
  UG: { flag: "🇺🇬", name: "Ouganda" },
  RW: { flag: "🇷🇼", name: "Rwanda" },
  MG: { flag: "🇲🇬", name: "Madagascar" },
  MZ: { flag: "🇲🇿", name: "Mozambique" },
  ZM: { flag: "🇿🇲", name: "Zambie" },
  ZW: { flag: "🇿🇼", name: "Zimbabwe" },
  TN: { flag: "🇹🇳", name: "Tunisie" },
  MA: { flag: "🇲🇦", name: "Maroc" },
  DZ: { flag: "🇩🇿", name: "Algérie" },
  EG: { flag: "🇪🇬", name: "Égypte" },
  US: { flag: "🇺🇸", name: "États-Unis" },
  GB: { flag: "🇬🇧", name: "Royaume-Uni" },
  FR: { flag: "🇫🇷", name: "France" },
  DE: { flag: "🇩🇪", name: "Allemagne" },
  CN: { flag: "🇨🇳", name: "Chine" },
  IN: { flag: "🇮🇳", name: "Inde" },
  JP: { flag: "🇯🇵", name: "Japon" },
  EU: { flag: "🇪🇺", name: "Europe" },
  GQ: { flag: "🇬🇶", name: "Guinée Équatoriale" },
  ET: { flag: "🇪🇹", name: "Éthiopie" },
  GH: { flag: "🇬🇭", name: "Ghana" },
  GW: { flag: "🇬🇼", name: "Guinée-Bissau" },
  KE: { flag: "🇰🇪", name: "Kenya" },
  LS: { flag: "🇱🇸", name: "Lesotho" },
  MW: { flag: "🇲🇼", name: "Malawi" },
  NG: { flag: "🇳🇬", name: "Nigeria" },
  SL: { flag: "🇸🇱", name: "Sierra Leone" },
};

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  XAF: "CM", XAFCF: "CF", XAFC: "CG", XAFTD: "TD", XAFG: "GA",
  XOF: "SN", XOFGW: "GW", XOFB: "BJ", XOFC: "CI", XOFF: "BF",
  XOFM: "ML", XOFN: "NE", XOFT: "TG", XOFS: "SN",
  TZS: "TZ", UGX: "UG", RWF: "RW", GHS: "GH", KES: "KE", MWK: "MW",
  MZN: "MZ", NGN: "NG", ETB: "ET", LSL: "LS", SLE: "SL", ZMW: "ZM",
  USD: "US", EUR: "EU", GBP: "GB", CNY: "CN", CDF: "CD",
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  cameroun: "CM", "côte d'ivoire": "CI", "cote d'ivoire": "CI",
  sénégal: "SN", senegal: "SN", bénin: "BJ", benin: "BJ",
  togo: "TG", mali: "ML", niger: "NE", "burkina faso": "BF",
  gabon: "GA", congo: "CG",
  "rd congo": "CD", "rdc": "CD", tanzanie: "TZ", tanzania: "TZ", ouganda: "UG", uganda: "UG",
  rwanda: "RW", madagascar: "MG", "états-unis": "US", france: "FR",
  "royaume-uni": "GB", europe: "EU", tchad: "TD", centrafrique: "CF",
  "guinée équatoriale": "GQ", éthiopie: "ET", ethiopie: "ET", ethiopia: "ET",
  ghana: "GH", "guinée-bissau": "GW", "guinea-bissau": "GW", kenya: "KE",
  lesotho: "LS", malawi: "MW", nigeria: "NG", "sierra leone": "SL",
  zambie: "ZM", zambia: "ZM",
};

const PAWAPAY_ALPHA3_TO_CODE: Record<string, string> = {
  CMR: "CM", SEN: "SN", CIV: "CI", BFA: "BF", MLI: "ML", BEN: "BJ",
  TGO: "TG", NER: "NE", GAB: "GA", COG: "CG", CAF: "CF", TCD: "TD",
  COD: "CD", TZA: "TZ", UGA: "UG", RWA: "RW", MDG: "MG", MOZ: "MZ",
  ZMB: "ZM", ZWE: "ZW", GNQ: "GQ", GNB: "GW", ETH: "ET", GHA: "GH",
  KEN: "KE", LSO: "LS", MWI: "MW", NGA: "NG", SLE: "SL",
};

/** Retourne "🇨🇲 Cameroun" à partir d'un code pays, d'un nom ou d'un code devise */
function countryDisplay(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (COUNTRY_INFO[upper]) return `${COUNTRY_INFO[upper].flag} ${COUNTRY_INFO[upper].name}`;
  const fromPawaCountry = PAWAPAY_ALPHA3_TO_CODE[upper];
  if (fromPawaCountry && COUNTRY_INFO[fromPawaCountry]) {
    return `${COUNTRY_INFO[fromPawaCountry].flag} ${COUNTRY_INFO[fromPawaCountry].name}`;
  }
  const fromCurrency = CURRENCY_TO_COUNTRY[upper];
  if (fromCurrency && COUNTRY_INFO[fromCurrency]) return `${COUNTRY_INFO[fromCurrency].flag} ${COUNTRY_INFO[fromCurrency].name}`;
  const fromName = COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()];
  if (fromName && COUNTRY_INFO[fromName]) return `${COUNTRY_INFO[fromName].flag} ${COUNTRY_INFO[fromName].name}`;
  if (upper.length === 2 && /^[A-Z]+$/.test(upper)) {
    const flag = upper.split("").map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
    return `${flag} ${trimmed}`;
  }
  return trimmed;
}

function walletLine(label: string, walletCurrency: string | undefined, fallbackCurrency: string): string {
  const wallet = walletCurrency || fallbackCurrency;
  return wallet ? `${label} : <b>${wallet}</b>\n` : "";
}

function providerDisplay(provider: string | undefined): string {
  if (provider === "pawapay") return "PawaPay";
  if (provider === "afribapay") return "AfribaPay";
  if (provider === "pixpay") return "PixPay";
  return provider || "";
}

function isPawaPay(provider: string | undefined): boolean {
  return (provider || "").toLowerCase() === "pawapay";
}

// ─── DÉPÔTS ──────────────────

export async function notifyNewDeposit(opts: {
  userName: string;
  userEmail: string;
  userPhone?: string;
  userCountry?: string;
  amount: string | number;
  currency: string;
  method: string;
  phone?: string;
  operator?: string;
  reference: string;
  externalReference?: string;
  provider?: string;
  country?: string;
  walletCurrency?: string;
  grossAmount?: string | number;
  source?: string;
}): Promise<void> {
  const payerPays = opts.country ? countryDisplay(opts.country) : countryDisplay(opts.currency);
  const beneficiaryPays = opts.userCountry ? countryDisplay(opts.userCountry) : "";
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const sourceLabel = opts.source === "api" ? "🔌 <b>Paiement via API</b>\n" : opts.source === "hosted_page" ? "🖥️ <b>Page de paiement hébergée (API)</b>\n" : "";
  const msg =
    `${isPawaPay(opts.provider) ? "⏳ <b>PAWAPAY — DÉPÔT EN ATTENTE</b>" : "🟡 <b>NOUVEAU DÉPÔT EN ATTENTE</b>"}\n` +
    `──────────────────\n` +
    (sourceLabel ? sourceLabel : "") +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant crédité : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    walletLine("💼 Wallet cible", opts.walletCurrency, opts.currency) +
    (opts.provider ? `🔌 Passerelle : ${providerDisplay(opts.provider)}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    (opts.externalReference ? `🔗 Réf. Fournisseur : <code>${opts.externalReference}</code>\n` : "") +
    `🕐 Heure : ${now()}\n` +
    `──── 📤 EXPÉDITEUR (PAYEUR) ────\n` +
    (opts.phone ? `📞 Téléphone : ${opts.phone}\n` : "") +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (payerPays ? `🌍 Pays : <b>${payerPays}</b>\n` : "") +
    `📱 Méthode : ${opts.method}\n` +
    `──── 📥 BÉNÉFICIAIRE ────\n` +
    `👤 Nom : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (opts.userPhone ? `📞 Téléphone : ${opts.userPhone}\n` : "") +
    (beneficiaryPays ? `🌍 Pays : <b>${beneficiaryPays}</b>\n` : "");
  await sendMessage(msg);
}

export async function notifyDepositConfirmed(opts: {
  userName: string;
  userEmail: string;
  userPhone?: string;
  userCountry?: string;
  amount: string | number;
  currency: string;
  reference: string;
  externalReference?: string;
  provider?: string;
  country?: string;
  walletCurrency?: string;
  grossAmount?: string | number;
  depositType?: string;
  paymentMethod?: string;
  phone?: string;
  operator?: string;
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;
  beneficiaryUsername?: string;
  beneficiaryPhone?: string;
  creditedCurrency?: string;
  linkTitle?: string;
  source?: string;
  providerFeeAmount?: string | number;
  providerFeePercent?: string | number;
  ashtechFeeAmount?: string | number;
  ashtechFeePercent?: string | number;
  totalFeeAmount?: string | number;
  totalFeePercent?: string | number;
}): Promise<void> {
  const payerPays = opts.country ? countryDisplay(opts.country) : countryDisplay(opts.currency);
  const beneficiaryPays = opts.userCountry ? countryDisplay(opts.userCountry) : "";
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const isLink = opts.depositType === "payment_link";
  const typeLabel = isLink ? "Lien de paiement" : "Dépôt normal";
  const methodLabel = opts.paymentMethod === "mobile_money" ? "Mobile Money" : opts.paymentMethod || "";
  const sourceLabel = opts.source === "api" ? "🔌 <b>Paiement via API</b>\n" : opts.source === "hosted_page" ? "🖥️ <b>Page de paiement hébergée (API)</b>\n" : "";
  const payerPhone = isLink ? (opts.payerPhone || opts.phone) : opts.phone;
  const payerName = isLink ? opts.payerName : undefined;
  const payerEmail = isLink ? opts.payerEmail : undefined;
  const isCrypto = opts.paymentMethod === "crypto";
  const hasFeeBreakdown = isCrypto && (
    opts.providerFeeAmount != null ||
    opts.ashtechFeeAmount != null ||
    opts.totalFeeAmount != null
  );

  const msg =
    `${isPawaPay(opts.provider) ? "✅ <b>PAWAPAY — DÉPÔT CONFIRMÉ</b>" : "✅ <b>PAIEMENT REÇU / DÉPÔT CONFIRMÉ</b>"}\n` +
    `──────────────────\n` +
    (sourceLabel ? sourceLabel : "") +
    `📋 Type : <b>${typeLabel}</b>\n` +
    (isLink && opts.linkTitle ? `🔗 Lien : <b>${opts.linkTitle}</b>\n` : "") +
    (hasGross || isCrypto ? `💰 Montant brut : <b>${fmt(opts.grossAmount ?? opts.amount, opts.currency)}</b>\n` : "") +
    (hasFeeBreakdown ? `🏦 Frais fournisseur${opts.providerFeePercent != null ? ` (${opts.providerFeePercent}%)` : ""} : <b>${fmt(opts.providerFeeAmount ?? 0, opts.currency)}</b>\n` : "") +
    (hasFeeBreakdown ? `🧾 Frais AshTechPay${opts.ashtechFeePercent != null ? ` (${opts.ashtechFeePercent}%)` : ""} : <b>${fmt(opts.ashtechFeeAmount ?? 0, opts.currency)}</b>\n` : "") +
    (hasFeeBreakdown ? `📊 Total des frais${opts.totalFeePercent != null ? ` (${opts.totalFeePercent}%)` : ""} : <b>${fmt(opts.totalFeeAmount ?? 0, opts.currency)}</b>\n` : "") +
    `💳 Montant crédité : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    walletLine("💼 Wallet crédité", opts.creditedCurrency || opts.walletCurrency, opts.currency) +
    (opts.provider ? `🔌 Passerelle : ${providerDisplay(opts.provider)}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    (opts.externalReference ? `🔗 Réf. Fournisseur : <code>${opts.externalReference}</code>\n` : "") +
    `🕐 Heure : ${now()}\n` +
    `──── 📤 EXPÉDITEUR (PAYEUR) ────\n` +
    (payerName ? `👤 Nom : <b>${payerName}</b>\n` : "") +
    (payerEmail ? `📧 Email : ${payerEmail}\n` : "") +
    (payerPhone ? `📞 Téléphone : ${payerPhone}\n` : "") +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (payerPays ? `🌍 Pays : <b>${payerPays}</b>\n` : "") +
    (methodLabel ? `📱 Méthode : ${methodLabel}\n` : "") +
    `──── 📥 BÉNÉFICIAIRE ────\n` +
    `👤 Nom : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (opts.beneficiaryUsername ? `🔑 Username : ${opts.beneficiaryUsername}\n` : "") +
    ((opts.beneficiaryPhone || opts.userPhone) ? `📞 Téléphone : ${opts.beneficiaryPhone || opts.userPhone}\n` : "") +
    (beneficiaryPays ? `🌍 Pays : <b>${beneficiaryPays}</b>\n` : "");

  await sendMessage(msg);
}

export async function notifyDepositFailed(opts: {
  userName: string;
  userEmail: string;
  userPhone?: string;
  userCountry?: string;
  amount: string | number;
  currency: string;
  reference: string;
  externalReference?: string;
  reason?: string;
  provider?: string;
  country?: string;
  walletCurrency?: string;
  depositType?: string;
  paymentMethod?: string;
  phone?: string;
  operator?: string;
  source?: string;
  payerName?: string;
  payerEmail?: string;
}): Promise<void> {
  const payerPays = opts.country ? countryDisplay(opts.country) : countryDisplay(opts.currency);
  const beneficiaryPays = opts.userCountry ? countryDisplay(opts.userCountry) : "";
  const isLink = opts.depositType === "payment_link";
  const typeLabel = isLink ? "Lien de paiement" : "Dépôt normal";
  const methodLabel = opts.paymentMethod === "mobile_money" ? "Mobile Money" : opts.paymentMethod || "";
  const sourceLabel = opts.source === "api" ? "🔌 <b>Paiement via API</b>\n" : opts.source === "hosted_page" ? "🖥️ <b>Page de paiement hébergée (API)</b>\n" : "";
  const msg =
    `❌ <b>ÉCHEC DE PAIEMENT (DÉPÔT)</b>\n` +
    `──────────────────\n` +
    (sourceLabel ? sourceLabel : "") +
    `📋 Type : <b>${typeLabel}</b>\n` +
    `💰 Montant : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    (opts.reason ? `⚠️ Raison : ${opts.reason}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    (opts.externalReference ? `🔗 Réf. Fournisseur : <code>${opts.externalReference}</code>\n` : "") +
    `🕐 Heure : ${now()}\n` +
    `──── 📤 EXPÉDITEUR (PAYEUR) ────\n` +
    (isLink && opts.payerName ? `👤 Nom : <b>${opts.payerName}</b>\n` : "") +
    (isLink && opts.payerEmail ? `📧 Email : ${opts.payerEmail}\n` : "") +
    (opts.phone ? `📞 Téléphone : ${opts.phone}\n` : "") +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (payerPays ? `🌍 Pays : <b>${payerPays}</b>\n` : "") +
    (methodLabel ? `📱 Méthode : ${methodLabel}\n` : "") +
    `──── 📥 BÉNÉFICIAIRE ────\n` +
    `👤 Nom : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (opts.userPhone ? `📞 Téléphone : ${opts.userPhone}\n` : "") +
    (beneficiaryPays ? `🌍 Pays : <b>${beneficiaryPays}</b>\n` : "");
  await sendMessage(msg);
}

// ─── MODIFICATION NUMÉRO DE RETRAIT ──────────────────

export async function notifyWithdrawalNumberChangeRequest(opts: {
  changeId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  userCountry?: string;
  userBalance?: string | number;
  userCurrency?: string;
  userKyc?: string;
  action: "add" | "update" | "delete";
  newPhoneNumber?: string;
  newOperatorName?: string;
  newLabel?: string;
  oldPhoneNumber?: string;
  oldOperatorName?: string;
}): Promise<void> {
  const actionLabel =
    opts.action === "add" ? "➕ AJOUT" :
    opts.action === "update" ? "✏️ MODIFICATION" : "🗑️ SUPPRESSION";

  const pays = opts.userCountry ? countryDisplay(opts.userCountry) : "";
  const kycIcon =
    opts.userKyc === "verified" ? "✅ Vérifié" :
    opts.userKyc === "pending" ? "⏳ En attente" : "❌ Non vérifié";

  let msg =
    `📱 <b>DEMANDE DE ${actionLabel} — NUMÉRO DE RETRAIT</b>\n` +
    `──────────────────\n` +
    `👤 <b>Utilisateur</b>\n` +
    `  Nom : <b>${opts.userName}</b>\n` +
    `  Email : ${opts.userEmail}\n` +
    (opts.userPhone ? `  Tél. : ${opts.userPhone}\n` : "") +
    (pays ? `  Pays : <b>${pays}</b>\n` : "") +
    `  KYC : ${kycIcon}\n` +
    (opts.userBalance != null ? `  Solde : <b>${fmt(opts.userBalance, opts.userCurrency || "XAF")}</b>\n` : "") +
    `──────────────────\n` +
    `📋 <b>Demande</b>\n` +
    `  Action : <b>${actionLabel}</b>\n`;

  if (opts.action === "update" && opts.oldPhoneNumber) {
    msg += `  Ancien numéro : <code>${opts.oldPhoneNumber}</code>\n`;
    if (opts.oldOperatorName) msg += `  Ancien opérateur : ${opts.oldOperatorName}\n`;
    msg += `  ──\n`;
  }
  if (opts.newPhoneNumber) msg += `  Nouveau numéro : <b><code>${opts.newPhoneNumber}</code></b>\n`;
  if (opts.newOperatorName) msg += `  Opérateur : <b>${opts.newOperatorName}</b>\n`;
  if (opts.newLabel) msg += `  Libellé : ${opts.newLabel}\n`;
  msg += `  ID demande : <code>${opts.changeId}</code>\n`;
  msg += `🕐 Heure : ${now()}`;

  await sendMessageWithKeyboard(msg, [
    [
      { text: "✅ Approuver", callback_data: `wnca:${opts.changeId}` },
      { text: "❌ Rejeter", callback_data: `wncr:${opts.changeId}:can` },
    ],
    [
      { text: "⚠️ Numéro invalide", callback_data: `wncr:${opts.changeId}:inv` },
      { text: "🚫 Activité suspecte", callback_data: `wncr:${opts.changeId}:frau` },
    ],
    [
      { text: "✍️ Raison personnalisée", callback_data: `wncc:${opts.changeId}` },
    ],
  ]);
}

// ─── RETRAITS ──────────────────

export async function notifyWithdrawalRequest(opts: {
  userName: string;
  userEmail: string;
  userPhone?: string;
  amount: string | number;
  currency: string;
  phone: string;
  operator?: string;
  reference: string;
  externalReference?: string;
  provider?: string;
  walletCurrency?: string;
  senderCountry?: string;
  recipientCountry?: string;
  grossAmount?: string | number;
  recipientName?: string;
}): Promise<void> {
  const senderPays = countryDisplay(opts.senderCountry || opts.currency);
  const recipientPays = countryDisplay(opts.recipientCountry || opts.currency);
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const msg =
    `🔵 <b>DEMANDE DE RETRAIT</b>\n` +
    `──────────────────\n` +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    walletLine("💼 Wallet débité", opts.walletCurrency, opts.currency) +
    (opts.provider ? `🔌 Passerelle : ${providerDisplay(opts.provider)}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    (opts.externalReference ? `🔗 Réf. Fournisseur : <code>${opts.externalReference}</code>\n` : "") +
    `🕐 Heure : ${now()}\n` +
    `──── 👤 EXPÉDITEUR ────\n` +
    `👤 Nom : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (opts.userPhone ? `📞 Téléphone : ${opts.userPhone}\n` : "") +
    (senderPays ? `🌍 Pays : <b>${senderPays}</b>\n` : "") +
    `──── 📲 DESTINATAIRE ────\n` +
    (opts.recipientName ? `👤 Nom : <b>${opts.recipientName}</b>\n` : "") +
    `📞 Téléphone : ${opts.phone}\n` +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (recipientPays ? `🌍 Pays : <b>${recipientPays}</b>\n` : "");
  const ref = opts.reference;
  const approvalButtons = opts.provider === "pawapay"
    ? [{ text: "✅ PawaPay", callback_data: `wap:${ref}:pawapay` }]
    : [
        { text: "✅ AfribaPay", callback_data: `wap:${ref}:afribapay` },
        { text: "✅ PixPay", callback_data: `wap:${ref}:pixpay` },
      ];
  await sendMessageWithKeyboard(msg, [
    approvalButtons,
    [
      { text: "❌ Rejeter", callback_data: `wrd:${ref}:can` },
      { text: "💸 Solde insuffisant", callback_data: `wrd:${ref}:ins` },
    ],
    [
      { text: "⚠️ Activité suspecte", callback_data: `wrd:${ref}:frau` },
      { text: "✍️ Raison personnalisée", callback_data: `wrc:${ref}` },
    ],
  ]);
}

export async function notifyWithdrawalPendingManual(opts: {
  userName: string;
  userEmail: string;
  userPhone?: string;
  amount: string | number;
  currency: string;
  phone: string;
  operator?: string;
  reference: string;
  externalReference?: string;
  provider?: string;
  walletCurrency?: string;
  senderCountry?: string;
  recipientCountry?: string;
  grossAmount?: string | number;
  recipientName?: string;
}): Promise<void> {
  const senderPays = countryDisplay(opts.senderCountry || opts.currency);
  const recipientPays = countryDisplay(opts.recipientCountry || opts.currency);
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const msg =
    `${isPawaPay(opts.provider) ? "⏸ <b>PAWAPAY — RETRAIT EN ATTENTE MANUELLE</b>" : "⏸ <b>RETRAIT EN ATTENTE MANUELLE</b>"}\n` +
    `──────────────────\n` +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    walletLine("💼 Wallet débité", opts.walletCurrency, opts.currency) +
    (opts.provider ? `🔌 Passerelle : ${providerDisplay(opts.provider)}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    (opts.externalReference ? `🔗 Réf. Fournisseur : <code>${opts.externalReference}</code>\n` : "") +
    `⚠️ <b>Validation manuelle requise !</b>\n` +
    `🕐 Heure : ${now()}\n` +
    `──── 👤 EXPÉDITEUR ────\n` +
    `👤 Nom : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (opts.userPhone ? `📞 Téléphone : ${opts.userPhone}\n` : "") +
    (senderPays ? `🌍 Pays : <b>${senderPays}</b>\n` : "") +
    `──── 📲 DESTINATAIRE ────\n` +
    (opts.recipientName ? `👤 Nom : <b>${opts.recipientName}</b>\n` : "") +
    `📞 Téléphone : ${opts.phone}\n` +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (recipientPays ? `🌍 Pays : <b>${recipientPays}</b>\n` : "");
  const ref = opts.reference;
  const approvalButtons = opts.provider === "pawapay"
    ? [{ text: "✅ PawaPay", callback_data: `wap:${ref}:pawapay` }]
    : [
        { text: "✅ AfribaPay", callback_data: `wap:${ref}:afribapay` },
        { text: "✅ PixPay", callback_data: `wap:${ref}:pixpay` },
      ];
  await sendMessageWithKeyboard(msg, [
    approvalButtons,
    [
      { text: "❌ Annuler & Rembourser", callback_data: `wrd:${ref}:can` },
      { text: "✍️ Raison personnalisée", callback_data: `wrc:${ref}` },
    ],
  ]);
}

export async function notifyWithdrawalAutoValidated(opts: {
  userName: string;
  userEmail: string;
  userPhone?: string;
  amount: string | number;
  currency: string;
  reference: string;
  externalReference?: string;
  provider?: string;
  walletCurrency?: string;
  grossAmount?: string | number;
  recipientName?: string;
  recipientPhone?: string;
  recipientCountry?: string;
  operator?: string;
  senderCountry?: string;
  txType?: string;  // "transfer_out" → shows TRANSFERT CONFIRMÉ instead of RETRAIT VALIDÉ
}): Promise<void> {
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const senderPays = countryDisplay(opts.senderCountry || opts.currency);
  const recipientPays = countryDisplay(opts.recipientCountry || opts.currency);
  const isTransfer = opts.txType === "transfer_out";
  const header = isTransfer
    ? `✅ <b>TRANSFERT CONFIRMÉ PAR ${providerDisplay(opts.provider || "FOURNISSEUR").toUpperCase()}</b>\n`
    : isPawaPay(opts.provider)
      ? `✅ <b>PAWAPAY — RETRAIT CONFIRMÉ</b>\n`
      : `✅ <b>RETRAIT VALIDÉ AUTOMATIQUEMENT</b>\n`;
  const msg =
    header +
    `──────────────────\n` +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    walletLine("💼 Wallet débité", opts.walletCurrency, opts.currency) +
    (opts.provider ? `🔌 Passerelle : ${providerDisplay(opts.provider)}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    (opts.externalReference ? `🔗 Réf. Fournisseur : <code>${opts.externalReference}</code>\n` : "") +
    `🕐 Heure : ${now()}\n` +
    `──── 👤 EXPÉDITEUR ────\n` +
    `👤 Nom : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (opts.userPhone ? `📞 Téléphone : ${opts.userPhone}\n` : "") +
    (senderPays ? `🌍 Pays : <b>${senderPays}</b>\n` : "") +
    `──── 📲 DESTINATAIRE ────\n` +
    (opts.recipientName ? `👤 Nom : <b>${opts.recipientName}</b>\n` : "") +
    (opts.recipientPhone ? `📞 Téléphone : ${opts.recipientPhone}\n` : "") +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (recipientPays ? `🌍 Pays : <b>${recipientPays}</b>\n` : "");
  await sendMessage(msg);
}

export async function notifyWithdrawalManuallyValidated(opts: {
  adminName: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  amount: string | number;
  currency: string;
  reference: string;
  externalReference?: string;
  walletCurrency?: string;
  grossAmount?: string | number;
  recipientName?: string;
  recipientPhone?: string;
  recipientCountry?: string;
  operator?: string;
  senderCountry?: string;
}): Promise<void> {
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const senderPays = countryDisplay(opts.senderCountry || opts.currency);
  const recipientPays = countryDisplay(opts.recipientCountry || opts.currency);
  const msg =
    `✅ <b>RETRAIT VALIDÉ MANUELLEMENT</b>\n` +
    `──────────────────\n` +
    `🛡️ Admin : <b>${opts.adminName}</b>\n` +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    walletLine("💼 Wallet débité", opts.walletCurrency, opts.currency) +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    (opts.externalReference ? `🔗 Réf. Fournisseur : <code>${opts.externalReference}</code>\n` : "") +
    `🕐 Heure : ${now()}\n` +
    `──── 👤 EXPÉDITEUR ────\n` +
    `👤 Nom : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (opts.userPhone ? `📞 Téléphone : ${opts.userPhone}\n` : "") +
    (senderPays ? `🌍 Pays : <b>${senderPays}</b>\n` : "") +
    `──── 📲 DESTINATAIRE ────\n` +
    (opts.recipientName ? `👤 Nom : <b>${opts.recipientName}</b>\n` : "") +
    (opts.recipientPhone ? `📞 Téléphone : ${opts.recipientPhone}\n` : "") +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (recipientPays ? `🌍 Pays : <b>${recipientPays}</b>\n` : "");
  await sendMessage(msg);
}

export async function notifyWithdrawalFailed(opts: {
  userName: string;
  userEmail: string;
  userPhone?: string;
  amount: string | number;
  currency: string;
  reference: string;
  externalReference?: string;
  reason?: string;
  provider?: string;
  walletCurrency?: string;
  grossAmount?: string | number;
  recipientName?: string;
  recipientPhone?: string;
  recipientCountry?: string;
  operator?: string;
  senderCountry?: string;
  txType?: string;  // "transfer_out" → shows TRANSFERT ÉCHOUÉ instead of ÉCHEC DE RETRAIT
}): Promise<void> {
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const senderPays = countryDisplay(opts.senderCountry || opts.currency);
  const recipientPays = countryDisplay(opts.recipientCountry || opts.currency);
  const isTransfer = opts.txType === "transfer_out";
  const header = isPawaPay(opts.provider)
    ? `❌ <b>PAWAPAY — RETRAIT ÉCHOUÉ / REMBOURSÉ</b>\n`
    : isTransfer
      ? `❌ <b>TRANSFERT ÉCHOUÉ</b>\n`
      : `❌ <b>ÉCHEC DE RETRAIT</b>\n`;
  const msg =
    header +
    `──────────────────\n` +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    walletLine("💼 Wallet remboursé", opts.walletCurrency, opts.currency) +
    (opts.provider ? `🔌 Passerelle : ${providerDisplay(opts.provider)}\n` : "") +
    (opts.reason ? `⚠️ Raison : ${opts.reason}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    (opts.externalReference ? `🔗 Réf. Fournisseur : <code>${opts.externalReference}</code>\n` : "") +
    `🕐 Heure : ${now()}\n` +
    `──── 👤 EXPÉDITEUR ────\n` +
    `👤 Nom : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (opts.userPhone ? `📞 Téléphone : ${opts.userPhone}\n` : "") +
    (senderPays ? `🌍 Pays : <b>${senderPays}</b>\n` : "") +
    `──── 📲 DESTINATAIRE ────\n` +
    (opts.recipientName ? `👤 Nom : <b>${opts.recipientName}</b>\n` : "") +
    (opts.recipientPhone ? `📞 Téléphone : ${opts.recipientPhone}\n` : "") +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (recipientPays ? `🌍 Pays : <b>${recipientPays}</b>\n` : "");
  await sendMessage(msg);
}

// ─── SÉCURITÉ ──────────────────

export async function notifyLoginFailed(opts: {
  identifier: string;
  ip: string;
  attemptsLeft: number;
  blocked: boolean;
}): Promise<void> {
  if (opts.blocked) {
    const msg =
      `🔴 <b>COMPTE BLOQUÉ — TROP DE TENTATIVES</b>\n` +
      `──────────────────\n` +
      `🔑 Identifiant : <code>${opts.identifier}</code>\n` +
      `🌐 IP : <code>${opts.ip}</code>\n` +
      `🚫 Accès bloqué pendant 30 minutes\n` +
      `🕐 Heure : ${now()}`;
    await sendMessage(msg);
  } else if (opts.attemptsLeft <= 2) {
    const msg =
      `⚠️ <b>TENTATIVE DE CONNEXION ÉCHOUÉE</b>\n` +
      `──────────────────\n` +
      `🔑 Identifiant : <code>${opts.identifier}</code>\n` +
      `🌐 IP : <code>${opts.ip}</code>\n` +
      `⏱ Tentatives restantes : ${opts.attemptsLeft}\n` +
      `🕐 Heure : ${now()}`;
    await sendMessage(msg);
  }
}

export async function notifyIpBlocked(opts: {
  ip: string;
  identifier: string;
  attempts: number;
  blockedUntil: number;
}): Promise<void> {
  const unblockTime = new Date(opts.blockedUntil).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Douala",
  });
  const msg =
    `🚨 <b>IP BLOQUÉE — ATTAQUE DÉTECTÉE</b>\n` +
    `──────────────────\n` +
    `🌐 IP : <code>${opts.ip}</code>\n` +
    `🔑 Dernier identifiant : <code>${opts.identifier}</code>\n` +
    `🔁 Tentatives : <b>${opts.attempts}</b>\n` +
    `⏳ Bloquée jusqu'à : <b>${unblockTime}</b> (30 min)\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyAdminLogin(opts: {
  adminName: string;
  adminEmail: string;
  ip: string;
}): Promise<void> {
  const msg =
    `🛡️ <b>CONNEXION AU PANEL ADMIN</b>\n` +
    `──────────────────\n` +
    `👤 Admin : <b>${opts.adminName}</b>\n` +
    `📧 Email : ${opts.adminEmail}\n` +
    `🌐 IP : <code>${opts.ip}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyAdminLoginSuccess(opts: {
  adminName: string;
  adminEmail: string;
  ip: string;
}): Promise<void> {
  const msg =
    `✅ <b>ADMIN CONNECTÉ AVEC SUCCÈS</b>\n` +
    `──────────────────\n` +
    `👤 Admin : <b>${opts.adminName}</b>\n` +
    `📧 Email : ${opts.adminEmail}\n` +
    `🌐 IP : <code>${opts.ip}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyAdminLoginFailed(opts: {
  identifier: string;
  ip: string;
}): Promise<void> {
  const msg =
    `🔴 <b>TENTATIVE DE CONNEXION ADMIN ÉCHOUÉE</b>\n` +
    `──────────────────\n` +
    `🔑 Identifiant : <code>${opts.identifier}</code>\n` +
    `🌐 IP : <code>${opts.ip}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── ÉCHANGES / CONVERSIONS ──────────────────

export async function notifyConversion(opts: {
  userName: string;
  userEmail: string;
  fromAmount: string | number;
  fromCurrency: string;
  toAmount: string | number;
  toCurrency: string;
  feeAmount: string | number;
  feePercent: string | number;
  reference: string;
  byAdmin?: boolean;
  adminName?: string;
  userCountry?: string;
}): Promise<void> {
  const who = opts.byAdmin && opts.adminName
    ? `🛡️ Admin : <b>${opts.adminName}</b>\n`
    : "";
  const fromPays = countryDisplay(opts.fromCurrency);
  const toPays = countryDisplay(opts.toCurrency);
  const userPays = opts.userCountry ? countryDisplay(opts.userCountry) : "";
  const sameZone = fromPays === toPays;
  const msg =
    `🔄 <b>ÉCHANGE DE DEVISES${opts.byAdmin ? " (ADMIN)" : ""}</b>\n` +
    `──────────────────\n` +
    who +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (userPays ? `🌍 Pays : <b>${userPays}</b>\n` : "") +
    `──────────────────\n` +
    (sameZone
      ? (fromPays ? `🌐 Zone : <b>${fromPays}</b>\n` : "")
      : `📤 De : <b>${fromPays || opts.fromCurrency}</b>\n` +
        `📥 Vers : <b>${toPays || opts.toCurrency}</b>\n`) +
    `💱 <b>${fmt(opts.fromAmount, opts.fromCurrency)} → ${fmt(opts.toAmount, opts.toCurrency)}</b>\n` +
    `💸 Frais : ${fmt(opts.feeAmount, opts.fromCurrency)} (${opts.feePercent}%)\n` +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyConversionStarted(opts: {
  userName: string;
  userEmail: string;
  fromAmount: string | number;
  fromCurrency: string;
  toAmount: string | number;
  toCurrency: string;
  feeAmount: string | number;
  feePercent: string | number;
  reference: string;
  userCountry?: string;
  estimatedSeconds: number;
  conversionId?: string;
}): Promise<void> {
  const fromPays = countryDisplay(opts.fromCurrency);
  const toPays = countryDisplay(opts.toCurrency);
  const userPays = opts.userCountry ? countryDisplay(opts.userCountry) : "";
  const msg =
    `⏳ <b>CONVERSION EN COURS</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (userPays ? `🌍 Pays : <b>${userPays}</b>\n` : "") +
    `──────────────────\n` +
    `📤 De : <b>${fromPays || opts.fromCurrency}</b>\n` +
    `📥 Vers : <b>${toPays || opts.toCurrency}</b>\n` +
    `💱 <b>${fmt(opts.fromAmount, opts.fromCurrency)} → ${fmt(opts.toAmount, opts.toCurrency)}</b>\n` +
    `💸 Frais : ${fmt(opts.feeAmount, opts.fromCurrency)} (${opts.feePercent}%)\n` +
    `🔖 Réf. : <code>${opts.reference}</code>\n` +
    (opts.conversionId ? `🆔 ID : <code>${opts.conversionId}</code>\n` : "") +
    `⏱️ Durée estimée : ~${opts.estimatedSeconds}s\n` +
    `🕐 Heure : ${now()}`;

  if (opts.conversionId) {
    const id = opts.conversionId;
    await sendMessageWithKeyboard(msg, [
      [
        { text: "⚡ Forcer maintenant", callback_data: `conv_exec:${id}` },
        { text: "❌ Annuler & Rembourser", callback_data: `conv_can:${id}` },
      ],
    ]);
  } else {
    await sendMessage(msg);
  }
}

export async function notifyConversionCompleted(opts: {
  userName: string;
  userEmail: string;
  fromAmount: string | number;
  fromCurrency: string;
  toAmount: string | number;
  toCurrency: string;
  feeAmount: string | number;
  feePercent: string | number;
  reference: string;
  userCountry?: string;
  elapsedSeconds: number;
}): Promise<void> {
  const fromPays = countryDisplay(opts.fromCurrency);
  const toPays = countryDisplay(opts.toCurrency);
  const userPays = opts.userCountry ? countryDisplay(opts.userCountry) : "";
  const msg =
    `✅ <b>CONVERSION TERMINÉE AVEC SUCCÈS</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (userPays ? `🌍 Pays : <b>${userPays}</b>\n` : "") +
    `──────────────────\n` +
    `📤 De : <b>${fromPays || opts.fromCurrency}</b>\n` +
    `📥 Vers : <b>${toPays || opts.toCurrency}</b>\n` +
    `💱 <b>${fmt(opts.fromAmount, opts.fromCurrency)} → ${fmt(opts.toAmount, opts.toCurrency)}</b>\n` +
    `💸 Frais : ${fmt(opts.feeAmount, opts.fromCurrency)} (${opts.feePercent}%)\n` +
    `🔖 Réf. : <code>${opts.reference}</code>\n` +
    `⏱️ Temps d'échange : <b>${opts.elapsedSeconds} secondes</b>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyAutoConversionRuleCreated(opts: {
  userName: string;
  userEmail: string;
  fromCurrency: string;
  toCurrency: string;
  userCountry?: string;
}): Promise<void> {
  const fromPays = countryDisplay(opts.fromCurrency);
  const toPays = countryDisplay(opts.toCurrency);
  const userPays = opts.userCountry ? countryDisplay(opts.userCountry) : "";
  const msg =
    `⚡ <b>RÈGLE DE CONVERSION AUTOMATIQUE ACTIVÉE</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : <code>${opts.userEmail}</code>\n` +
    (userPays ? `🌍 Pays : <b>${userPays}</b>\n` : "") +
    `──────────────────\n` +
    `📤 Source : <b>${opts.fromCurrency}</b>${fromPays ? ` — ${fromPays}` : ""}\n` +
    `📥 Cible  : <b>${opts.toCurrency}</b>${toPays ? ` — ${toPays}` : ""}\n` +
    `💱 Règle  : <b>${opts.fromCurrency} → ${opts.toCurrency}</b>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyAutoConversionRulesBulkCreated(opts: {
  userName: string;
  userEmail: string;
  userCountry?: string;
  rules: { fromCurrency: string; toCurrency: string }[];
}): Promise<void> {
  if (opts.rules.length === 0) return;
  const userPays = opts.userCountry ? countryDisplay(opts.userCountry) : "";
  const toPays = opts.rules[0] ? countryDisplay(opts.rules[0].toCurrency) : "";
  const rulesLines = opts.rules
    .map((r) => {
      const fromPays = countryDisplay(r.fromCurrency);
      return `  💱 <b>${r.fromCurrency}</b>${fromPays ? ` — ${fromPays}` : ""} → <b>${r.toCurrency}</b>`;
    })
    .join("\n");
  const count = opts.rules.length;
  const msg =
    `⚡ <b>${count > 1 ? `${count} RÈGLES` : "RÈGLE"} DE CONVERSION AUTOMATIQUE ACTIVÉE${count > 1 ? "S" : ""}</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : <code>${opts.userEmail}</code>\n` +
    (userPays ? `🌍 Pays : <b>${userPays}</b>\n` : "") +
    `──────────────────\n` +
    `📥 Cible : <b>${opts.rules[0]?.toCurrency}</b>${toPays ? ` — ${toPays}` : ""}\n` +
    `──────────────────\n` +
    rulesLines + "\n" +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── TRANSFERTS ──────────────────

export async function notifyTransferSent(opts: {
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  senderCountry?: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientCountry?: string;
  amount: string | number;
  grossAmount?: string | number;
  feeAmount?: string | number;
  currency: string;
  reference: string;
  externalReference?: string;
  operator?: string;
  provider?: string;
  isInternal?: boolean;
}): Promise<void> {
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const senderPays = countryDisplay(opts.senderCountry || opts.currency);
  const recipientPays = countryDisplay(opts.recipientCountry || opts.currency);
  const typeLabel = opts.isInternal ? "🔄 Transfert interne Ashtech Pay" : "📲 Transfert Mobile Money";
  // For external transfers, mention awaiting provider confirmation
  const statusLine = !opts.isInternal && opts.provider
    ? `⏳ Statut : <b>En attente confirmation ${opts.provider}</b>\n`
    : "";
  const msg =
    `💸 <b>TRANSFERT SOUMIS</b>\n` +
    `──────────────────\n` +
    `📋 Type : ${typeLabel}\n` +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    (opts.feeAmount && parseFloat(String(opts.feeAmount)) > 0 ? `💸 Frais : ${fmt(opts.feeAmount, opts.currency)}\n` : "") +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    statusLine +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    (opts.externalReference ? `🔗 Réf. Fournisseur : <code>${opts.externalReference}</code>\n` : "") +
    `🕐 Heure : ${now()}\n` +
    `──── 👤 EXPÉDITEUR ────\n` +
    `👤 Nom : <b>${opts.senderName}</b>\n` +
    `📧 Email : ${opts.senderEmail}\n` +
    (opts.senderPhone ? `📞 Téléphone : ${opts.senderPhone}\n` : "") +
    (senderPays ? `🌍 Pays : <b>${senderPays}</b>\n` : "") +
    `──── 📲 DESTINATAIRE ────\n` +
    `👤 Nom : <b>${opts.recipientName}</b>\n` +
    (opts.recipientEmail ? `📧 Email : ${opts.recipientEmail}\n` : "") +
    (opts.recipientPhone ? `📞 Téléphone : ${opts.recipientPhone}\n` : "") +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (recipientPays ? `🌍 Pays : <b>${recipientPays}</b>\n` : "");
  await sendMessage(msg);
}

// ─── LIENS DE PAIEMENT ──────────────────

export async function notifyPaymentLinkCreated(opts: {
  userName: string;
  userEmail: string;
  title: string;
  description?: string | null;
  amount: string | number;
  currency: string;
  isFixedAmount: boolean;
  slug: string;
  linkUrl: string;
  expiresAt?: Date | string | null;
  allowedCountries?: string[] | null;
  hasPdfDelivery?: boolean;
  redirectUrl?: string | null;
}): Promise<void> {
  const montant = opts.isFixedAmount
    ? `<b>${fmt(opts.amount, opts.currency)}</b> (fixe)`
    : `Libre (client choisit)`;
  const expiry = opts.expiresAt
    ? new Date(opts.expiresAt).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })
    : "Aucune";
  const pays = opts.allowedCountries && opts.allowedCountries.length > 0
    ? opts.allowedCountries.map(c => countryDisplay(c)).join(", ")
    : "Tous les pays";
  const msg =
    `🔗 <b>NOUVEAU LIEN DE PAIEMENT CRÉÉ</b>\n` +
    `──────────────────\n` +
    `👤 Créateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `──────────────────\n` +
    `📌 Titre : <b>${opts.title}</b>\n` +
    (opts.description ? `📝 Description : ${opts.description}\n` : "") +
    `💰 Montant : ${montant}\n` +
    `🌍 Pays autorisés : ${pays}\n` +
    (opts.hasPdfDelivery ? `📄 Livraison PDF : Oui\n` : "") +
    (opts.redirectUrl ? `↩️ Redirection : ${opts.redirectUrl}\n` : "") +
    `⏳ Expiration : ${expiry}\n` +
    `──────────────────\n` +
    `🔗 Lien : ${opts.linkUrl}\n` +
    `🆔 Slug : <code>${opts.slug}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── SUPPORT TICKETS ─────────────────────────────────────

export async function notifyNewTicket(opts: {
  ticketId: string;
  userName: string;
  userEmail: string;
  subject: string;
  firstMessage?: string;
  priority: string;
}): Promise<void> {
  if (!isConfigured()) return;
  const priorityIcon: Record<string, string> = { low: "🟢", medium: "🟡", high: "🟠", urgent: "🔴" };
  const icon = priorityIcon[opts.priority] ?? "🟡";
  const msg =
    `🎫 <b>NOUVEAU TICKET SUPPORT</b>\n` +
    `──────────────────\n` +
    `👤 <b>${opts.userName}</b>\n` +
    `📧 ${opts.userEmail}\n` +
    `──────────────────\n` +
    `📌 Sujet : <b>${opts.subject}</b>\n` +
    `${icon} Priorité : <b>${opts.priority}</b>\n` +
    (opts.firstMessage ? `💬 Message : <i>${opts.firstMessage.slice(0, 200)}</i>\n` : "") +
    `──────────────────\n` +
    `🆔 <code>${opts.ticketId}</code>\n` +
    `🕐 ${now()}`;
  await callBotApi("sendMessage", {
    chat_id: CHAT_ID,
    text: msg,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💬 Répondre", callback_data: `tc:reply:${opts.ticketId}` },
          { text: "🔒 Clôturer", callback_data: `tc:close:${opts.ticketId}` },
        ],
      ],
    },
  });
}

export async function notifySupportMessage(opts: {
  ticketId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
}): Promise<void> {
  if (!isConfigured()) return;
  const msg =
    `💬 <b>MESSAGE SUPPORT</b>\n` +
    `──────────────────\n` +
    `👤 <b>${opts.userName}</b>\n` +
    `📧 ${opts.userEmail}\n` +
    `──────────────────\n` +
    `📌 Ticket : <b>${opts.subject}</b>\n` +
    `💬 <i>${opts.message.slice(0, 300)}</i>\n` +
    `──────────────────\n` +
    `🆔 <code>${opts.ticketId}</code>\n` +
    `🕐 ${now()}`;
  await callBotApi("sendMessage", {
    chat_id: CHAT_ID,
    text: msg,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💬 Répondre", callback_data: `tc:reply:${opts.ticketId}` },
          { text: "🔒 Clôturer", callback_data: `tc:close:${opts.ticketId}` },
        ],
      ],
    },
  });
}

// ─── KYC COMPLET AVEC PDF + BOUTONS ─────────────────────

export async function notifyKycSubmittedFull(opts: {
  submissionId: string;
  isUpdate?: boolean;
  userName: string;
  userEmail: string;
  userId: number | string;
  documentType: string;
  documentNumber: string;
  country?: string;
  city?: string;
  businessType: string;
  businessCategory: string;
  businessDescription: string;
  summaryPdf?: TelegramKycFile;
}): Promise<void> {
  if (!isConfigured()) return;

  const docTypeLabel: Record<string, string> = {
    passport: "🛂 Passeport",
    national_id: "🪪 Carte Nationale d'Identité",
    cni: "🪪 Carte Nationale d'Identité",
    cni_receipt: "📄 Récépissé de CNI",
    drivers_license: "🚗 Permis de conduire",
    driver_license: "🚗 Permis de conduire",
    residence_permit: "🏠 Titre de séjour",
    residence_card: "🏠 Carte de séjour",
    voter_card: "🗳 Carte électorale",
  };
  const businessTypeLabel: Record<string, string> = {
    individual: "👤 Particulier",
    physical: "🏬 Commerce physique",
    company: "🏢 Entreprise",
    online: "🌐 En ligne",
    freelancer: "💼 Freelance",
    ngo: "🌍 ONG",
  };

  // Send only the private summary PDF. The PDF already contains all KYC
  // photos and is the sole document that may be delivered to Telegram.
  if (opts.summaryPdf) {
    await sendDocumentBuffer(opts.summaryPdf, "📑 <b>Dossier KYC PDF</b>");
  }

  // 2. Info message + inline keyboard
  const infoText =
    `${opts.isUpdate ? "🔄 <b>MISE À JOUR KYC À VÉRIFIER</b>" : "📋 <b>NOUVELLE DEMANDE DE VÉRIFICATION KYC</b>"}\n` +
    `──────────────────\n` +
    `👤 <b>${opts.userName}</b>\n` +
    `📧 ${opts.userEmail}\n` +
    `🆔 ID : <code>#${opts.userId}</code>\n` +
    `──────────────────\n` +
    `📄 Document : ${docTypeLabel[opts.documentType] ?? opts.documentType}\n` +
    `🔢 N° : <code>${opts.documentNumber}</code>\n` +
    (opts.country ? `🌍 Pays : ${opts.country}\n` : "") +
    (opts.city ? `🏙 Ville : ${opts.city}\n` : "") +
    `──────────────────\n` +
    `🏷 Compte : ${businessTypeLabel[opts.businessType] ?? opts.businessType}\n` +
    `📂 Catégorie : ${opts.businessCategory}\n` +
    `📝 ${opts.businessDescription}\n` +
    `──────────────────\n` +
    `🕐 ${now()}`;

  const id = opts.submissionId;
  const inline_keyboard = [
    [{ text: "✅ Approuver", callback_data: `ka:${id}` }],
    [
      { text: "❌ Document illisible", callback_data: `kr:${id}:ill` },
      { text: "❌ Infos incorrectes", callback_data: `kr:${id}:inc` },
    ],
    [
      { text: "❌ Selfie non conforme", callback_data: `kr:${id}:slf` },
      { text: "❌ Document expiré", callback_data: `kr:${id}:exp` },
    ],
    [{ text: "✍️ Rejeter avec raison personnalisée…", callback_data: `krc:${id}` }],
  ];

  await sendMessageWithKeyboard(infoText, inline_keyboard);
}

// ─── GESTIONNAIRE DE WEBHOOK TELEGRAM ──────────────────

// ─── Types stats bot ──────────────────
export type BotStats = {
  period: string;
  totalUsers: number;
  bannedUsers: number;
  depositCount: number;
  depositVol: string;
  withdrawalCount: number;
  withdrawalVol: string;
  transferCount: number;
  paymentLinkCount: number;
  totalRevenue: string;
  depositFees: string;
  withdrawalFees: string;
  transferFees: string;
  paymentLinkFees: string;
  pendingDeposits: number;
  pendingWithdrawals: number;
  pendingTransfers: number;
  kycPending: number;
  kycApproved: number;
  kycRejected: number;
  recentUsers: { username: string; email: string | null; createdAt: Date | null; kycStatus: string }[];
};

// ─── Menu & formatters ──────────────────

// ReplyKeyboard : chaque clic envoie un message visible de ton côté
// et la conversation défile automatiquement vers la réponse du bot.
const REPLY_KEYBOARD = [
  ["📊 Dashboard mois",   "📅 Aujourd'hui"],
  ["📆 Cette semaine",    "⏳ En attente"],
  ["🔑 KYC résumé",       "👥 Inscrits récents"],
  ["💰 Revenus",          "📋 Rapport complet"],
  ["🏆 Top 10 soldes",    "💳 Solde plateforme"],
  ["🔗 Liens actifs",     "🌍 Pays actifs"],
  ["👤 Info utilisateur", "💵 Solde utilisateur"],
  ["🚫 Bannir user",      "✅ Débannir user"],
  ["🔐 Reset password",   "🔍 Vérifier tx"],
  ["💱 Modifier taux FX", "📧 Broadcast email"],
  ["📖 Aide"],
];

// Mapping bouton → commande interne
const REPLY_KEYBOARD_MAP: Record<string, string> = {
  "📊 Dashboard mois":    "/stats",
  "📅 Aujourd'hui":       "/today",
  "📆 Cette semaine":     "/week",
  "⏳ En attente":        "/pending",
  "🔑 KYC résumé":        "/kyc",
  "👥 Inscrits récents":  "/users",
  "💰 Revenus":           "/revenue",
  "📋 Rapport complet":   "/rapport",
  "🏆 Top 10 soldes":     "/top",
  "💳 Solde plateforme":  "/soldeA",
  "🔗 Liens actifs":      "/liens",
  "🌍 Pays actifs":       "/pays",
  "📖 Aide":              "/aide",
  "👤 Info utilisateur":  "prompt:user",
  "💵 Solde utilisateur": "prompt:solde",
  "🚫 Bannir user":       "prompt:ban",
  "✅ Débannir user":     "prompt:unban",
  "🔐 Reset password":    "prompt:resetpw",
  "🔍 Vérifier tx":       "prompt:verif",
  "💱 Modifier taux FX":  "prompt:taux",
  "📧 Broadcast email":   "prompt:broadcast",
};

const INLINE_MENU: { text: string; callback_data: string }[][] = [
  [{ text: "📊 Dashboard mois",    callback_data: "cmd:stats_month"     }, { text: "📅 Aujourd'hui",       callback_data: "cmd:stats_today"    }],
  [{ text: "📆 Cette semaine",     callback_data: "cmd:stats_week"      }, { text: "⏳ En attente",         callback_data: "cmd:pending"        }],
  [{ text: "🔑 KYC résumé",        callback_data: "cmd:kyc"             }, { text: "👥 Inscrits récents",   callback_data: "cmd:users"          }],
  [{ text: "💰 Revenus",           callback_data: "cmd:revenue"         }, { text: "📋 Rapport complet",    callback_data: "cmd:rapport"        }],
  [{ text: "🏆 Top 10 soldes",     callback_data: "cmd:top"             }, { text: "💳 Solde plateforme",   callback_data: "cmd:soldeA"         }],
  [{ text: "🔗 Liens actifs",      callback_data: "cmd:liens"           }, { text: "🌍 Pays actifs",        callback_data: "cmd:pays"           }],
  [{ text: "👤 Info utilisateur",  callback_data: "cmd:prompt_user"     }, { text: "💵 Solde utilisateur",  callback_data: "cmd:prompt_solde"   }],
  [{ text: "🚫 Bannir user",       callback_data: "cmd:prompt_ban"      }, { text: "✅ Débannir user",      callback_data: "cmd:prompt_unban"   }],
  [{ text: "🔐 Reset password",    callback_data: "cmd:prompt_resetpw"  }, { text: "🔍 Vérifier tx",        callback_data: "cmd:prompt_verif"   }],
  [{ text: "💱 Modifier taux FX",  callback_data: "cmd:prompt_taux"     }, { text: "📧 Broadcast email",    callback_data: "cmd:prompt_broadcast"}],
  [{ text: "🛡️ IPs bloquées",      callback_data: "cmd:ipb"             }, { text: "📖 Aide",               callback_data: "cmd:aide"           }],
];

async function sendMenu(chatId: string): Promise<void> {
  // Remove existing reply keyboard then delete the cleanup message
  const cleanupRes = await callBotApi("sendMessage", {
    chat_id: chatId,
    text: ".",
    reply_markup: { remove_keyboard: true },
    disable_notification: true,
  });
  const cleanupMsgId = cleanupRes?.result?.message_id;
  if (cleanupMsgId) {
    await callBotApi("deleteMessage", { chat_id: chatId, message_id: cleanupMsgId });
  }

  await callBotApi("sendMessage", {
    chat_id: chatId,
    text:
      `🏦 <b>AshTech Pay — Panel Admin</b>\n` +
      `──────────────────\n` +
      `Choisissez une action 👇`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: INLINE_MENU },
  });
}

function fmtNum(n: number | string): string {
  return Number(n).toLocaleString("fr-FR");
}

function fmtXAF(n: number | string): string {
  const v = parseFloat(String(n));
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M XAF`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)} k XAF`;
  return `${fmtNum(v)} XAF`;
}

function periodLabel(period: string): string {
  const map: Record<string, string> = {
    today: "Aujourd'hui",
    this_week: "Cette semaine",
    this_month: "Ce mois",
    last_month: "Mois dernier",
    this_year: "Cette année",
    all: "Tout",
  };
  return map[period] ?? period;
}

function formatDashboard(s: BotStats): string {
  const totalTx = s.depositCount + s.withdrawalCount + s.transferCount + s.paymentLinkCount;
  const totalVol = parseFloat(s.depositVol) + parseFloat(s.withdrawalVol);
  return (
    `📊 <b>TABLEAU DE BORD — ${periodLabel(s.period).toUpperCase()}</b>\n` +
    `──────────────────\n` +
    `👥 <b>Utilisateurs</b>\n` +
    `  Total : <b>${fmtNum(s.totalUsers)}</b> | Bannis : ${s.bannedUsers}\n` +
    `  KYC vérifiés : ${fmtNum(s.kycApproved)} | En attente : ${s.kycPending} | Rejetés : ${s.kycRejected}\n\n` +
    `💸 <b>Transactions (${periodLabel(s.period)})</b>\n` +
    `  Total : <b>${fmtNum(totalTx)}</b>\n` +
    `  Dépôts : ${fmtNum(s.depositCount)} — ${fmtXAF(s.depositVol)}\n` +
    `  Retraits : ${fmtNum(s.withdrawalCount)} — ${fmtXAF(s.withdrawalVol)}\n` +
    `  Transferts : ${fmtNum(s.transferCount)}\n` +
    `  Liens paiement : ${fmtNum(s.paymentLinkCount)}\n` +
    `  Volume total : <b>${fmtXAF(totalVol)}</b>\n\n` +
    `💰 <b>Revenus (${periodLabel(s.period)})</b>\n` +
    `  Total : <b>${fmtXAF(s.totalRevenue)}</b>\n\n` +
    `⏳ <b>En attente</b>\n` +
    `  Dépôts : ${s.pendingDeposits} | Retraits : ${s.pendingWithdrawals} | KYC : ${s.kycPending}\n` +
    `──────────────────\n` +
    `🕐 ${now()}`
  );
}

function formatRevenue(s: BotStats): string {
  return (
    `💰 <b>REVENUS — ${periodLabel(s.period).toUpperCase()}</b>\n` +
    `──────────────────\n` +
    `💵 Total commissions : <b>${fmtXAF(s.totalRevenue)}</b>\n\n` +
    `📋 Détail par type :\n` +
    `  • Dépôts (${fmtNum(s.depositCount)}) : ${fmtXAF(s.depositFees)}\n` +
    `  • Retraits (${fmtNum(s.withdrawalCount)}) : ${fmtXAF(s.withdrawalFees)}\n` +
    `  • Transferts (${fmtNum(s.transferCount)}) : ${fmtXAF(s.transferFees)}\n` +
    `  • Liens (${fmtNum(s.paymentLinkCount)}) : ${fmtXAF(s.paymentLinkFees)}\n` +
    `──────────────────\n` +
    `🕐 ${now()}`
  );
}

function formatPending(s: BotStats): string {
  const total = s.pendingDeposits + s.pendingWithdrawals + s.pendingTransfers + s.kycPending;
  return (
    `⏳ <b>ÉLÉMENTS EN ATTENTE</b>\n` +
    `──────────────────\n` +
    `${total === 0 ? "✅ Aucun élément en attente !\n" : ""}` +
    (s.pendingDeposits > 0 ? `🟡 Dépôts : <b>${s.pendingDeposits}</b>\n` : "") +
    (s.pendingWithdrawals > 0 ? `🔵 Retraits : <b>${s.pendingWithdrawals}</b>\n` : "") +
    (s.pendingTransfers > 0 ? `🟣 Transferts : <b>${s.pendingTransfers}</b>\n` : "") +
    (s.kycPending > 0 ? `📋 Demandes KYC : <b>${s.kycPending}</b>\n` : "") +
    `──────────────────\n` +
    `🕐 ${now()}`
  );
}

function formatKyc(s: BotStats): string {
  const total = s.kycApproved + s.kycPending + s.kycRejected;
  const pct = total > 0 ? Math.round((s.kycApproved / total) * 100) : 0;
  return (
    `🔑 <b>VÉRIFICATIONS KYC</b>\n` +
    `──────────────────\n` +
    `📊 Total soumis : <b>${fmtNum(total)}</b>\n` +
    `✅ Approuvés : <b>${fmtNum(s.kycApproved)}</b> (${pct}%)\n` +
    `⏳ En attente : <b>${fmtNum(s.kycPending)}</b>\n` +
    `❌ Rejetés : <b>${fmtNum(s.kycRejected)}</b>\n\n` +
    `👥 Utilisateurs vérifiés / Total : ${fmtNum(s.kycApproved)} / ${fmtNum(s.totalUsers)}\n` +
    `──────────────────\n` +
    `🕐 ${now()}`
  );
}

function formatRecentUsers(s: BotStats): string {
  const lines = s.recentUsers.map((u, i) => {
    const kycIcon = u.kycStatus === "verified" ? "✅" : u.kycStatus === "pending" ? "⏳" : "⬜";
    const date = u.createdAt ? new Date(u.createdAt).toLocaleDateString("fr-FR") : "—";
    return `${i + 1}. <b>${u.username}</b> ${kycIcon}\n   📧 ${u.email ?? "—"}  📅 ${date}`;
  });
  return (
    `👥 <b>DERNIERS INSCRITS</b>\n` +
    `──────────────────\n` +
    `Total : <b>${fmtNum(s.totalUsers)}</b> utilisateurs\n\n` +
    (lines.join("\n\n") || "Aucun utilisateur") +
    `\n──────────────────\n🕐 ${now()}`
  );
}

// ─── GESTIONNAIRE DE WEBHOOK TELEGRAM ──────────────────

export async function handleTelegramUpdate(
  update: any,
  handlers: {
    approveKyc: (submissionId: string) => Promise<{ userName: string; userEmail: string } | null>;
    rejectKyc: (submissionId: string, reason: string) => Promise<{ userName: string; userEmail: string } | null>;
    getStats: (period: string) => Promise<BotStats>;
    banUser: (email: string, reason: string, unban?: boolean) => Promise<{ userName: string; banned: boolean } | null>;
    getUserInfo: (email: string) => Promise<{
      userName: string; email: string; balance: number; currency: string;
      kycStatus: string; country?: string; createdAt: Date | string | null;
      recentTx: { type: string; amount: string; currency: string; status: string; createdAt: Date | string | null }[];
      wallets: { currency: string; balance: number }[];
    } | null>;
    setFxRate: (currency: string, rate: number) => Promise<boolean>;
    getCountries: () => Promise<{ id: string; code: string; name: string; currency: string; isActive: boolean }[]>;
    toggleCountry: (id: string) => Promise<{ name: string; isActive: boolean } | null>;
    getTopUsers: () => Promise<{ userName: string; email: string; balance: number; currency: string }[]>;
    broadcastEmail: (subject: string, body: string) => Promise<{ count: number }>;
    verifyTransaction: (reference: string) => Promise<{
      type: string; amount: string; currency: string; status: string;
      userName: string; createdAt: Date | string | null; description?: string;
    } | null>;
    getActiveLinks: () => Promise<{ title: string; slug: string; amount: string; currency: string; userName: string }[]>;
    getPlatformBalance: () => Promise<{
      totalXAF: number;
      byCurrency: { currency: string; balance: number }[];
      userCount: number;
      revenue: { deposits: number; withdrawals: number; transfers: number; paymentLinks: number; conversions: number; total: number };
    }>;
    resetUserPassword: (email: string) => Promise<{ userName: string; found: boolean } | null>;
    approveWithdrawal: (reference: string, provider?: string) => Promise<{
      userName: string;
      amount: string;
      currency: string;
      provider?: string;
      status?: "processing" | "completed" | "failed" | "pending_manual";
    } | null>;
    rejectWithdrawal: (reference: string, reason: string) => Promise<{ userName: string } | null>;
    searchUsers: (query: string) => Promise<{ userName: string; email: string; balance: number; currency: string; kycStatus: string; country?: string; banned: boolean }[]>;
    approveWithdrawalNumberChange: (changeId: string) => Promise<{ userName: string; userEmail: string; newPhone: string; action: string } | null>;
    rejectWithdrawalNumberChange: (changeId: string, reason: string) => Promise<{ userName: string; userEmail: string } | null>;
    getBlockedIps: () => { ip: string; identifier: string; blockedUntil: number; blockedAt: number }[];
    unblockIpByIdentifier: (identifier: string) => Promise<{ unblocked: number; ips: string[] }>;
    replyToTicket: (ticketId: string, message: string) => Promise<{ userName: string; subject: string } | null>;
    closeTicket: (ticketId: string) => Promise<{ userName: string; subject: string } | null>;
    executeConversion: (conversionId: string) => Promise<{ fromAmount: string; fromCurrency: string; toAmount: string; toCurrency: string; userName: string } | null>;
    cancelConversion: (conversionId: string) => Promise<{ fromAmount: string; fromCurrency: string; userName: string } | null>;
  }
): Promise<void> {
  // ── Filtre admin : ignore tout message qui ne vient pas du CHAT_ID autorisé ──
  if (CHAT_ID) {
    const incomingChatId =
      String(update.message?.chat?.id ?? "") ||
      String(update.callback_query?.message?.chat?.id ?? "") ||
      String(update.edited_message?.chat?.id ?? "") ||
      String(update.channel_post?.chat?.id ?? "");

    if (incomingChatId && incomingChatId !== String(CHAT_ID)) {
      // Répondre une seule fois "bot non disponible" pour ne pas révéler son existence
      if (update.message?.chat?.id) {
        await callBotApi("sendMessage", {
          chat_id: update.message.chat.id,
          text: "🤖 Ce bot est privé et n'est pas disponible.",
        });
      }
      if (update.callback_query?.id) {
        await callBotApi("answerCallbackQuery", {
          callback_query_id: update.callback_query.id,
          text: "Accès refusé.",
          show_alert: true,
        });
      }
      return; // Ignorer complètement
    }
  }

  // ── Callback query (button press) ──
  if (update.callback_query) {
    const cq = update.callback_query;
    const data: string = cq.data ?? "";
    const chatId = String(cq.message?.chat?.id ?? "");
    const messageId: number = cq.message?.message_id;

    await answerCallbackQuery(cq.id);

    // ── Dashboard / stats commands ──
    if (data.startsWith("cmd:")) {
      const cmd = data.slice(4);
      const backBtn = [[{ text: "🏠 Menu principal", callback_data: "cmd:menu" }]];

      if (cmd === "menu") { await sendMenu(chatId); return; }

      // Stats / dashboard
      const periodMap: Record<string, string> = {
        stats_today: "today", stats_week: "this_week", stats_month: "this_month", revenue: "this_month",
      };
      if (cmd in periodMap || cmd === "pending" || cmd === "kyc" || cmd === "users" || cmd === "rapport") {
        const period = periodMap[cmd] ?? "this_month";
        const stats = await handlers.getStats(period);
        let text = "";
        if (cmd === "pending") text = formatPending(stats);
        else if (cmd === "kyc") text = formatKyc(stats);
        else if (cmd === "users") text = formatRecentUsers(stats);
        else if (cmd === "revenue") text = formatRevenue(stats);
        else if (cmd === "rapport") text = formatDashboard(stats) + "\n\n" + formatRevenue(stats) + "\n\n" + formatPending(stats);
        else text = formatDashboard(stats);
        const bannerMap: Record<string, string> = { pending: "pending", kyc: "kyc", users: "users", revenue: "revenue", rapport: "rapport" };
        await sendWithBanner(chatId, bannerMap[cmd] ?? "stats", text, { inline_keyboard: backBtn });
        return;
      }

      // Top 10
      if (cmd === "top") {
        const users = await handlers.getTopUsers();
        const lines = users.map((u: any, i: number) =>
          `${i + 1}. <b>${u.fullName || u.username}</b> — ${fmtXAF(u.balance)}`
        ).join("\n");
        await sendWithBanner(
          chatId, "top",
          `🏆 <b>TOP 10 SOLDES</b>\n──────────────────\n${lines || "Aucun utilisateur"}\n🕐 ${now()}`,
          { inline_keyboard: backBtn }
        );
        return;
      }

      // Solde plateforme
      if (cmd === "soldeA") {
        const bal = await handlers.getPlatformBalance();
        const currLines = bal.byCurrency.map(({ currency, balance }) =>
          `  • ${currency} : <b>${fmtNum(balance)}</b>`
        ).join("\n") || "  Aucun solde";
        const rev = bal.revenue;
        await sendWithBanner(
          chatId, "wallet",
          `💳 <b>SOLDE TOTAL PLATEFORME</b>\n` +
          `──────────────────\n` +
          `${currLines}\n` +
          `💰 <b>Total ≈ ${fmtNum(bal.totalXAF)} XAF</b>\n` +
          `👥 Utilisateurs actifs : <b>${bal.userCount}</b>\n` +
          `──────────────────\n` +
          `📊 <b>REVENUS (marges)</b>\n` +
          `  • Dépôts : <b>${fmtNum(rev.deposits)} XAF</b>\n` +
          `  • Retraits : <b>${fmtNum(rev.withdrawals)} XAF</b>\n` +
          `  • Envois : <b>${fmtNum(rev.transfers)} XAF</b>\n` +
          `  • Liens paiement : <b>${fmtNum(rev.paymentLinks)} XAF</b>\n` +
          `  • Conversions : <b>${fmtNum(rev.conversions)} XAF</b>\n` +
          `💵 <b>Total revenus : ${fmtNum(rev.total)} XAF</b>\n` +
          `──────────────────\n` +
          `🕐 ${now()}`,
          { inline_keyboard: backBtn }
        );
        return;
      }

      // Liens actifs
      if (cmd === "liens") {
        const links = await handlers.getActiveLinks();
        const lines = links.slice(0, 15).map((l: any) =>
          `🔗 <b>${l.title}</b> — ${l.slug}\n   💰 ${fmtNum(l.totalCollected || 0)} XAF`
        ).join("\n");
        await sendWithBanner(
          chatId, "liens",
          `🔗 <b>LIENS ACTIFS (${links.length})</b>\n──────────────────\n${lines || "Aucun lien actif"}\n🕐 ${now()}`,
          { inline_keyboard: backBtn }
        );
        return;
      }

      // Pays actifs
      if (cmd === "pays") {
        const countries = await handlers.getCountries();
        const lines = countries.map((c: any) =>
          `${c.isActive ? "🟢" : "🔴"} ${countryDisplay(c.code) || c.name} (${c.currency})`
        ).join("\n");
        await sendWithBanner(
          chatId, "pays",
          `🌍 <b>PAYS CONFIGURÉS (${countries.length})</b>\n──────────────────\n${lines || "Aucun pays"}\n🕐 ${now()}`,
          { inline_keyboard: backBtn }
        );
        return;
      }

      // IPs bloquées
      if (cmd === "ipb") {
        const backBtn = [[{ text: "🏠 Menu principal", callback_data: "cmd:menu" }]];
        const blocked = handlers.getBlockedIps();
        if (blocked.length === 0) {
          await callBotApi("sendMessage", {
            chat_id: chatId,
            text: `🛡️ <b>IPs BLOQUÉES</b>\n──────────────────\n✅ Aucune IP actuellement bloquée.\n🕐 ${now()}`,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: backBtn },
          });
          return;
        }
        const lines = blocked.map(b => {
          const remaining = Math.max(0, Math.ceil((b.blockedUntil - Date.now()) / 1000));
          const min = Math.floor(remaining / 60);
          const sec = remaining % 60;
          return `🔴 <code>${b.ip}</code>\n👤 <code>${b.identifier}</code>\n⏱️ ${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")} restant`;
        }).join("\n──────────────────\n");
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `🛡️ <b>IPs BLOQUÉES (${blocked.length})</b>\n──────────────────\n${lines}\n──────────────────\n🕐 ${now()}`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: backBtn },
        });
        return;
      }

      // Aide
      if (cmd === "aide") {
        const backBtn = [[{ text: "🏠 Menu principal", callback_data: "cmd:menu" }]];
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text:
            `📖 <b>TOUTES LES COMMANDES</b>\n──────────────────\n` +
            `/stats — Dashboard ce mois\n/today — Stats aujourd'hui\n/week — Stats cette semaine\n` +
            `/pending — En attente\n/kyc — Résumé KYC\n/users — Derniers inscrits\n` +
            `/revenue — Revenus\n/rapport — Rapport complet\n/top — Top 10 soldes\n` +
            `/soldeA — Solde total plateforme\n/liens — Liens actifs\n/pays — Pays\n` +
            `/user email — Infos utilisateur\n/solde email — Solde utilisateur\n` +
            `/ban email [raison] — Bannir\n/unban email — Débannir\n` +
            `/resetpw email — Reset mot de passe\n/verif REF — Vérifier transaction\n` +
            `/taux DEVISE TAUX — Modifier taux FX\n/broadcast Sujet;Corps — Email groupé\n` +
            `/ipb — IPs bloquées\n/dip email(numero) — Débloquer une IP\n` +
            `──────────────────\n🕐 ${now()}`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: backBtn },
        });
        return;
      }

      // Prompts pour commandes interactives
      const prompts: Record<string, { icon: string; title: string; usage: string; example: string }> = {
        prompt_user:      { icon: "👤", title: "Info utilisateur",    usage: "/user email",               example: "/user jean@email.com" },
        prompt_solde:     { icon: "💵", title: "Solde utilisateur",   usage: "/solde email",              example: "/solde jean@email.com" },
        prompt_ban:       { icon: "🚫", title: "Bannir utilisateur",  usage: "/ban email [raison]",       example: "/ban jean@email.com Fraude détectée" },
        prompt_unban:     { icon: "✅", title: "Débannir utilisateur",usage: "/unban email",              example: "/unban jean@email.com" },
        prompt_resetpw:   { icon: "🔑", title: "Reset mot de passe",  usage: "/resetpw email",            example: "/resetpw jean@email.com" },
        prompt_verif:     { icon: "🔍", title: "Vérifier transaction",usage: "/verif REFERENCE",          example: "/verif DEP-ABC123" },
        prompt_taux:      { icon: "💱", title: "Modifier taux FX",    usage: "/taux DEVISE TAUX",         example: "/taux USD 650" },
        prompt_broadcast: { icon: "📧", title: "Broadcast email",     usage: "/broadcast Sujet;Corps",    example: "/broadcast Maintenance;Site en maintenance ce soir" },
      };
      if (cmd in prompts) {
        const p = prompts[cmd];
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text:
            `${p.icon} <b>${p.title}</b>\n` +
            `──────────────────\n` +
            `📝 Usage : <code>${p.usage}</code>\n` +
            `💡 Exemple : <code>${p.example}</code>\n\n` +
            `Envoyez la commande directement dans ce chat.`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: backBtn },
        });
        return;
      }
    }

    // ── Approve KYC ──
    if (data.startsWith("ka:")) {
      const submissionId = data.slice(3);
      const result = await handlers.approveKyc(submissionId);
      if (result) {
        await editMessageText(messageId, `✅ <b>KYC APPROUVÉ</b>\n\n👤 ${result.userName}\n📧 ${result.userEmail}\n🕐 ${now()}`);
      } else {
        await editMessageText(messageId, `⚠️ Impossible d'approuver — soumission introuvable.`);
      }
      return;
    }

    // ── Reject KYC with preset reason ──
    if (data.startsWith("kr:")) {
      const parts = data.split(":");
      const submissionId = parts[1];
      const code = parts[2];
      const reasonMap: Record<string, string> = {
        ill: "Document illisible ou de mauvaise qualité",
        inc: "Les informations fournies sont incorrectes",
        slf: "Le selfie avec le document n'est pas conforme",
        exp: "Le document d'identité est expiré",
      };
      const reason = reasonMap[code] ?? "Demande non conforme";
      const result = await handlers.rejectKyc(submissionId, reason);
      if (result) {
        await editMessageText(messageId,
          `❌ <b>KYC REJETÉ</b>\n\n👤 ${result.userName}\n📧 ${result.userEmail}\n⚠️ ${reason}\n🕐 ${now()}`);
      } else {
        await editMessageText(messageId, `⚠️ Impossible de rejeter — soumission introuvable.`);
      }
      return;
    }

    // ── Custom KYC rejection — ask for reason ──
    if (data.startsWith("krc:")) {
      const submissionId = data.slice(4);
      pendingCustomRejections.set(chatId, { submissionId, messageId, ts: Date.now() });
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: `✍️ Envoyez la raison du rejet pour cette demande KYC.\n\n<i>Tapez votre message ci-dessous :</i>`,
        parse_mode: "HTML",
        reply_markup: { force_reply: true, selective: true },
      });
      return;
    }

    // ── Approve withdrawal with provider choice ──
    if (data.startsWith("wap:")) {
      const parts = data.split(":");
      const reference = parts[1];
      const provider = parts[2];
      if (provider !== "afribapay" && provider !== "pixpay" && provider !== "pawapay") {
        await editMessageText(messageId, `⚠️ Fournisseur de paiement invalide.`);
        return;
      }
      const result = await handlers.approveWithdrawal(reference, provider);
      if (result) {
        const statusLabel: Record<string, string> = {
          processing: "⏳ EN ATTENTE DE CONFIRMATION FOURNISSEUR",
          pending_manual: "⏸ EN ATTENTE DE RAPPROCHEMENT MANUEL",
          completed: "✅ CONFIRMÉ",
          failed: "❌ ÉCHOUÉ / REMBOURSÉ",
        };
        const status = result.status || "processing";
        const header = provider === "pawapay" && status === "processing"
          ? "⏳ <b>PAWAPAY — RETRAIT SOUMIS</b>"
          : `${statusLabel[status] || "✅ RETRAIT TRAITÉ"}`;
        await editMessageText(messageId,
          `${header}\n\n👤 ${result.userName}\n💰 ${fmt(result.amount, result.currency)}\n🔌 Via : <b>${providerDisplay(provider)}</b>\n🔖 <code>${reference}</code>\n🕐 ${now()}`);
      } else {
        await editMessageText(messageId, `⚠️ Impossible d'approuver — transaction introuvable ou déjà traitée.`);
      }
      return;
    }

    // ── Approve withdrawal (legacy wa: handler kept for compatibility) ──
    if (data.startsWith("wa:")) {
      const reference = data.slice(3);
      const result = await handlers.approveWithdrawal(reference, "afribapay");
      if (result) {
        await editMessageText(messageId,
          `⏳ <b>RETRAIT SOUMIS — EN ATTENTE DE CONFIRMATION</b>\n\n👤 ${result.userName}\n💰 ${fmt(result.amount, result.currency)}\n🔌 Via : <b>AfribaPay</b>\n🔖 <code>${reference}</code>\n🕐 ${now()}`);
      } else {
        await editMessageText(messageId, `⚠️ Impossible d'approuver — transaction introuvable ou déjà traitée.`);
      }
      return;
    }

    // ── Reject withdrawal with preset reason ──
    if (data.startsWith("wrd:")) {
      const parts = data.split(":");
      const reference = parts[1];
      const code = parts[2];
      const reasonMap: Record<string, string> = {
        ins: "Solde insuffisant sur le compte source",
        can: "Demande annulée par l'administrateur",
        frau: "Activité suspecte détectée",
        inv: "Informations de retrait invalides ou incorrectes",
      };
      const reason = reasonMap[code] ?? "Demande non conforme";
      const result = await handlers.rejectWithdrawal(reference, reason);
      if (result) {
        await editMessageText(messageId,
          `❌ <b>RETRAIT REJETÉ</b>\n\n👤 ${result.userName}\n🔖 <code>${reference}</code>\n⚠️ ${reason}\n🕐 ${now()}`);
      } else {
        await editMessageText(messageId, `⚠️ Impossible de rejeter — transaction introuvable.`);
      }
      return;
    }

    // ── Custom withdrawal rejection — ask for reason ──
    if (data.startsWith("wrc:")) {
      const reference = data.slice(4);
      pendingWithdrawalRejections.set(chatId, { reference, messageId, ts: Date.now() });
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: `✍️ Envoyez la raison du rejet pour le retrait <code>${reference}</code> :`,
        parse_mode: "HTML",
        reply_markup: { force_reply: true, selective: true },
      });
      return;
    }

    // ── Approve withdrawal number change ──
    if (data.startsWith("wnca:")) {
      const changeId = data.slice(5);
      const result = await handlers.approveWithdrawalNumberChange(changeId);
      if (result) {
        const actionLabel = result.action === "add" ? "ajouté" : result.action === "update" ? "modifié" : "supprimé";
        await editMessageText(messageId,
          `✅ <b>NUMÉRO DE RETRAIT ${actionLabel.toUpperCase()}</b>\n\n` +
          `👤 ${result.userName}\n` +
          `📧 ${result.userEmail}\n` +
          (result.newPhone ? `📱 Numéro : <b><code>${result.newPhone}</code></b>\n` : "") +
          `🕐 ${now()}`
        );
      } else {
        await editMessageText(messageId, `⚠️ Impossible d'approuver — demande introuvable ou déjà traitée.`);
      }
      return;
    }

    // ── Reject withdrawal number change with preset reason ──
    if (data.startsWith("wncr:")) {
      const parts = data.split(":");
      const changeId = parts[1];
      const code = parts[2];
      const reasonMap: Record<string, string> = {
        can: "Demande annulée par l'administrateur",
        inv: "Numéro de téléphone invalide ou non reconnu",
        frau: "Activité suspecte détectée sur ce compte",
      };
      const reason = reasonMap[code] ?? "Demande non conforme";
      const result = await handlers.rejectWithdrawalNumberChange(changeId, reason);
      if (result) {
        await editMessageText(messageId,
          `❌ <b>DEMANDE NUMÉRO RETRAIT REJETÉE</b>\n\n` +
          `👤 ${result.userName}\n` +
          `📧 ${result.userEmail}\n` +
          `⚠️ Raison : ${reason}\n` +
          `🕐 ${now()}`
        );
      } else {
        await editMessageText(messageId, `⚠️ Impossible de rejeter — demande introuvable ou déjà traitée.`);
      }
      return;
    }

    // ── Custom withdrawal number change rejection — ask for reason ──
    if (data.startsWith("wncc:")) {
      const changeId = data.slice(5);
      pendingWncRejections.set(chatId, { changeId, messageId, ts: Date.now() });
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: `✍️ Envoyez la raison du rejet pour la demande de numéro <code>${changeId}</code> :`,
        parse_mode: "HTML",
        reply_markup: { force_reply: true, selective: true },
      });
      return;
    }

    // ── Ticket: reply via button ──
    if (data.startsWith("tc:reply:")) {
      const ticketId = data.slice(9);
      pendingTicketReplies.set(chatId, { ticketId, ts: Date.now() });
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: `✍️ Envoyez votre réponse pour le ticket <code>${ticketId.slice(0, 8)}…</code> :\n\n<i>Tapez votre message ci-dessous :</i>`,
        parse_mode: "HTML",
        reply_markup: { force_reply: true, selective: true },
      });
      return;
    }

    // ── Ticket: close via button ──
    if (data.startsWith("tc:close:")) {
      const ticketId = data.slice(9);
      const result = await handlers.closeTicket(ticketId);
      if (result) {
        await editMessageText(messageId,
          `🔒 <b>TICKET CLÔTURÉ</b>\n\n👤 ${result.userName}\n📌 ${result.subject}\n🆔 <code>${ticketId}</code>\n🕐 ${now()}`);
      } else {
        await callBotApi("sendMessage", { chat_id: chatId, text: `⚠️ Ticket introuvable ou déjà clôturé.`, parse_mode: "HTML" });
      }
      return;
    }

    // ── Force execute conversion ──
    if (data.startsWith("conv_exec:")) {
      const conversionId = data.slice(10);
      const result = await handlers.executeConversion(conversionId);
      if (result) {
        await editMessageText(messageId,
          `⚡ <b>CONVERSION FORCÉE ✅</b>\n` +
          `──────────────────\n` +
          `👤 ${result.userName}\n` +
          `💱 <b>${fmt(result.fromAmount, result.fromCurrency)} → ${fmt(result.toAmount, result.toCurrency)}</b>\n` +
          `🆔 <code>${conversionId}</code>\n` +
          `🕐 ${now()}`);
      } else {
        await editMessageText(messageId, `⚠️ Impossible d'exécuter — conversion introuvable ou déjà traitée.`);
      }
      return;
    }

    // ── Cancel & refund conversion ──
    if (data.startsWith("conv_can:")) {
      const conversionId = data.slice(9);
      const result = await handlers.cancelConversion(conversionId);
      if (result) {
        await editMessageText(messageId,
          `❌ <b>CONVERSION ANNULÉE</b>\n` +
          `──────────────────\n` +
          `👤 ${result.userName}\n` +
          `💰 Remboursé : <b>${fmt(result.fromAmount, result.fromCurrency)}</b>\n` +
          `🆔 <code>${conversionId}</code>\n` +
          `🕐 ${now()}`);
      } else {
        await editMessageText(messageId, `⚠️ Impossible d'annuler — conversion introuvable ou déjà traitée.`);
      }
      return;
    }

    // ── Toggle country ──
    if (data.startsWith("ct:")) {
      const countryId = data.slice(3);
      const result = await handlers.toggleCountry(countryId);
      if (result) {
        await editMessageText(messageId,
          `${result.isActive ? "✅" : "🔴"} Pays <b>${result.name}</b> ${result.isActive ? "activé" : "désactivé"}.\n🕐 ${now()}`);
      } else {
        await editMessageText(messageId, `⚠️ Pays introuvable.`);
      }
      return;
    }
  }

  // ── Text message / commands ──
  if (update.message?.text) {
    const chatId = String(update.message.chat?.id ?? "");
    const text: string = update.message.text.trim();

    // ── Check pending ticket reply ──
    const pendingTicketEntry = pendingTicketReplies.get(chatId);
    const pendingTicketId = pendingTicketEntry?.ticketId;
    if (pendingTicketId && !text.startsWith("/") && !REPLY_KEYBOARD_MAP[text]) {
      pendingTicketReplies.delete(chatId);
      const result = await handlers.replyToTicket(pendingTicketId, text);
      if (result) {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `✅ <b>Réponse envoyée</b>\n\n👤 ${result.userName}\n📌 ${result.subject}\n💬 <i>${text.slice(0, 100)}</i>\n🕐 ${now()}`,
          parse_mode: "HTML",
        });
      } else {
        await callBotApi("sendMessage", { chat_id: chatId, text: `⚠️ Ticket introuvable.`, parse_mode: "HTML" });
      }
      return;
    }

    // ── Check pending custom KYC rejection first ──
    const pending = pendingCustomRejections.get(chatId);
    if (pending && !text.startsWith("/") && !REPLY_KEYBOARD_MAP[text]) {
      pendingCustomRejections.delete(chatId);
      const result = await handlers.rejectKyc(pending.submissionId, text);
      if (result) {
        await editMessageText(pending.messageId,
          `❌ <b>KYC REJETÉ</b>\n\n👤 ${result.userName}\n📧 ${result.userEmail}\n⚠️ ${text}\n🕐 ${now()}`);
        await callBotApi("sendMessage", { chat_id: chatId, text: `✅ Rejet KYC enregistré : <i>${text}</i>`, parse_mode: "HTML" });
      } else {
        await callBotApi("sendMessage", { chat_id: chatId, text: `⚠️ Soumission KYC introuvable ou déjà traitée.`, parse_mode: "HTML" });
      }
      return;
    }

    // ── Check pending withdrawal rejection ──
    const pendingWdr = pendingWithdrawalRejections.get(chatId);
    if (pendingWdr && !text.startsWith("/") && !REPLY_KEYBOARD_MAP[text]) {
      pendingWithdrawalRejections.delete(chatId);
      const result = await handlers.rejectWithdrawal(pendingWdr.reference, text);
      if (result) {
        await editMessageText(pendingWdr.messageId,
          `❌ <b>RETRAIT REJETÉ</b>\n\n👤 ${result.userName}\n🔖 <code>${pendingWdr.reference}</code>\n⚠️ ${text}\n🕐 ${now()}`);
        await callBotApi("sendMessage", { chat_id: chatId, text: `✅ Rejet retrait enregistré : <i>${text}</i>`, parse_mode: "HTML" });
      } else {
        await callBotApi("sendMessage", { chat_id: chatId, text: `⚠️ Transaction introuvable ou déjà traitée.`, parse_mode: "HTML" });
      }
      return;
    }

    // ── Check pending withdrawal number change rejection ──
    const pendingWnc = pendingWncRejections.get(chatId);
    if (pendingWnc && !text.startsWith("/") && !REPLY_KEYBOARD_MAP[text]) {
      pendingWncRejections.delete(chatId);
      const result = await handlers.rejectWithdrawalNumberChange(pendingWnc.changeId, text);
      if (result) {
        await editMessageText(pendingWnc.messageId,
          `❌ <b>DEMANDE NUMÉRO RETRAIT REJETÉE</b>\n\n👤 ${result.userName}\n📧 ${result.userEmail}\n⚠️ Raison : ${text}\n🕐 ${now()}`);
        await callBotApi("sendMessage", { chat_id: chatId, text: `✅ Rejet enregistré : <i>${text}</i>`, parse_mode: "HTML" });
      } else {
        await callBotApi("sendMessage", { chat_id: chatId, text: `⚠️ Demande introuvable ou déjà traitée.`, parse_mode: "HTML" });
      }
      return;
    }

    // ── ReplyKeyboard button → route to the matching command or prompt ──
    const mappedAction = REPLY_KEYBOARD_MAP[text];
    if (mappedAction) {
      if (mappedAction.startsWith("prompt:")) {
        const promptKey = `prompt_${mappedAction.slice(7)}`;
        const prompts: Record<string, { icon: string; title: string; usage: string; example: string }> = {
          prompt_user:      { icon: "👤", title: "Info utilisateur",     usage: "/user email",            example: "/user jean@email.com" },
          prompt_solde:     { icon: "💵", title: "Solde utilisateur",    usage: "/solde email",           example: "/solde jean@email.com" },
          prompt_ban:       { icon: "🚫", title: "Bannir utilisateur",   usage: "/ban email [raison]",    example: "/ban jean@email.com Fraude" },
          prompt_unban:     { icon: "✅", title: "Débannir utilisateur", usage: "/unban email",           example: "/unban jean@email.com" },
          prompt_resetpw:   { icon: "🔐", title: "Reset mot de passe",   usage: "/resetpw email",         example: "/resetpw jean@email.com" },
          prompt_verif:     { icon: "🔍", title: "Vérifier transaction", usage: "/verif REFERENCE",       example: "/verif DEP-ABC123" },
          prompt_taux:      { icon: "💱", title: "Modifier taux FX",     usage: "/taux DEVISE TAUX",      example: "/taux USD 650" },
          prompt_broadcast: { icon: "📧", title: "Broadcast email",      usage: "/broadcast Sujet;Corps", example: "/broadcast Maintenance;Site en maintenance ce soir" },
        };
        const p = prompts[promptKey];
        if (p) {
          await callBotApi("sendMessage", {
            chat_id: chatId,
            text:
              `${p.icon} <b>${p.title}</b>\n` +
              `──────────────────\n` +
              `📝 Usage : <code>${p.usage}</code>\n` +
              `💡 Exemple : <code>${p.example}</code>\n\n` +
              `Envoyez la commande directement dans ce chat.`,
            parse_mode: "HTML",
          });
        }
        return;
      }
      // Redirect to the equivalent slash command by reusing the text handler below
      // We replace text with the mapped command so the existing logic picks it up
      // (We reassign and fall through — use a goto-like approach via a helper flag)
      const remappedText = mappedAction;
      // Handle the remapped command inline:
      if (remappedText === "/start" || remappedText === "/menu") { await sendMenu(chatId); return; }
      if (remappedText === "/aide" || remappedText === "/help") {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text:
            `📖 <b>TOUTES LES COMMANDES</b>\n` +
            `──────────────────\n` +
            `/stats — Dashboard ce mois\n` +
            `/today — Stats aujourd'hui\n` +
            `/week — Stats cette semaine\n` +
            `/pending — Éléments en attente\n` +
            `/kyc — Résumé vérifications KYC\n` +
            `/users — Derniers inscrits\n` +
            `/revenue — Revenus & commissions\n` +
            `/rapport — Rapport complet\n` +
            `/top — Top 10 soldes\n` +
            `/soldeA — Solde total plateforme\n` +
            `/liens — Liens actifs aujourd'hui\n` +
            `/pays — Gestion des pays\n` +
            `/user email — Infos utilisateur\n` +
            `/solde email — Solde utilisateur\n` +
            `/ban email [raison] — Bannir\n` +
            `/unban email — Débannir\n` +
            `/resetpw email — Reset mot de passe\n` +
            `/verif REF — Vérifier transaction\n` +
            `/taux DEVISE TAUX — Modifier taux FX\n` +
            `/broadcast Sujet;Corps — Email groupé\n` +
            `/ipb — IPs actuellement bloquées\n` +
            `/dip email(numero) — Débloquer une IP\n` +
            `──────────────────\n🕐 ${now()}`,
          parse_mode: "HTML",
        });
        return;
      }
      if (remappedText === "/top") {
        const topUsers = await handlers.getTopUsers();
        const medals = ["🥇", "🥈", "🥉"];
        const lines = topUsers.map((u, i) =>
          `${medals[i] ?? `${i + 1}.`} <b>${u.userName}</b> — <b>${fmt(u.balance, u.currency)}</b>\n   📧 ${u.email}`
        ).join("\n\n");
        await sendWithBanner(chatId, "top",
          `🏆 <b>TOP 10 UTILISATEURS (solde)</b>\n──────────────────\n${lines || "Aucun utilisateur"}\n──────────────────\n🕐 ${now()}`);
        return;
      }
      if (remappedText === "/soldeA") {
        const info = await handlers.getPlatformBalance();
        const currLines = info.byCurrency.map(({ currency, balance }) =>
          `  • ${currency} : <b>${fmtNum(balance)}</b>`
        ).join("\n") || "  Aucun solde";
        const rev = info.revenue;
        await sendWithBanner(chatId, "wallet",
          `🏦 <b>SOLDE TOTAL ASHTECH PAY</b>\n──────────────────\n${currLines}\n` +
          `💰 <b>Total ≈ ${fmtNum(info.totalXAF)} XAF</b>\n👥 Utilisateurs : <b>${info.userCount}</b>\n` +
          `──────────────────\n📊 <b>REVENUS</b>\n` +
          `  • Dépôts : <b>${fmtNum(rev.deposits)} XAF</b>\n` +
          `  • Retraits : <b>${fmtNum(rev.withdrawals)} XAF</b>\n` +
          `  • Envois : <b>${fmtNum(rev.transfers)} XAF</b>\n` +
          `  • Liens : <b>${fmtNum(rev.paymentLinks)} XAF</b>\n` +
          `  • Conversions : <b>${fmtNum(rev.conversions)} XAF</b>\n` +
          `💵 <b>Total : ${fmtNum(rev.total)} XAF</b>\n──────────────────\n🕐 ${now()}`);
        return;
      }
      if (remappedText === "/liens") {
        const links = await handlers.getActiveLinks();
        if (links.length === 0) {
          await callBotApi("sendMessage", { chat_id: chatId, text: `📎 Aucun lien de paiement créé aujourd'hui.`, parse_mode: "HTML" });
          return;
        }
        const lines = links.slice(0, 15).map((l, i) =>
          `${i + 1}. <b>${l.title}</b> — ${fmt(l.amount, l.currency)}\n   👤 ${l.userName} | 🔗 /pay/${l.slug}`
        ).join("\n\n");
        await sendWithBanner(chatId, "liens",
          `📎 <b>LIENS ACTIFS AUJOURD'HUI (${links.length})</b>\n──────────────────\n${lines}\n──────────────────\n🕐 ${now()}`);
        return;
      }
      if (remappedText === "/pays") {
        const countries = await handlers.getCountries();
          const inline_keyboard = countries.map(c => ([{
          text: `${c.isActive ? "✅" : "🔴"} ${c.name} (${c.code})`,
          callback_data: `ct:${c.id}`,
        }]));
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `🌍 <b>GESTION DES PAYS (${countries.length})</b>\nCliquez pour activer/désactiver un marché :`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard },
        });
        return;
      }
      if (remappedText === "/rapport") {
        const s = await handlers.getStats("this_month");
        const totalTx = s.depositCount + s.withdrawalCount + s.transferCount + s.paymentLinkCount;
        const msg =
          `📊 <b>RAPPORT — CE MOIS</b>\n──────────────────\n` +
          `👥 Utilisateurs : <b>${s.totalUsers.toLocaleString("fr-FR")}</b> (bannis : ${s.bannedUsers})\n──────────────────\n` +
          `💸 <b>TRANSACTIONS</b>\n  Total : <b>${totalTx.toLocaleString("fr-FR")}</b>\n` +
          `  📥 Dépôts : ${s.depositCount} — <b>${fmt(s.depositVol, "XAF")}</b>\n` +
          `  📤 Retraits : ${s.withdrawalCount} — <b>${fmt(s.withdrawalVol, "XAF")}</b>\n` +
          `  🔄 Transferts : ${s.transferCount}\n  🔗 Liens : ${s.paymentLinkCount}\n──────────────────\n` +
          `💰 <b>REVENUS</b>\n  Total : <b>${fmt(s.totalRevenue, "XAF")}</b>\n──────────────────\n` +
          `⏳ <b>EN ATTENTE</b>\n  Dépôts : ${s.pendingDeposits} | Retraits : ${s.pendingWithdrawals} | KYC : ${s.kycPending}\n` +
          `──────────────────\n🕐 ${now()}`;
        await sendWithBanner(chatId, "rapport", msg);
        return;
      }
      // For /stats, /today, /week, /pending, /kyc, /users, /revenue → fall through to cmdMap below
      // by overriding text variable — we do this by re-entering with a fake cmdMap lookup
      const cmdMapDirect: Record<string, { period?: string; type: string }> = {
        "/stats":   { type: "dash", period: "this_month" },
        "/today":   { type: "dash", period: "today" },
        "/week":    { type: "dash", period: "this_week" },
        "/pending": { type: "pending", period: "this_month" },
        "/kyc":     { type: "kyc", period: "this_month" },
        "/users":   { type: "users", period: "this_month" },
        "/revenue": { type: "revenue", period: "this_month" },
      };
      const directEntry = cmdMapDirect[remappedText];
      if (directEntry) {
        const { type, period = "this_month" } = directEntry;
        const stats = await handlers.getStats(period);
        let msgText = "";
        if (type === "pending") msgText = formatPending(stats);
        else if (type === "kyc") msgText = formatKyc(stats);
        else if (type === "users") msgText = formatRecentUsers(stats);
        else if (type === "revenue") msgText = formatRevenue(stats);
        else msgText = formatDashboard(stats);
        const txtBannerMap: Record<string, string> = { pending: "pending", kyc: "kyc", users: "users", revenue: "revenue" };
        await sendWithBanner(chatId, txtBannerMap[type] ?? "stats", msgText);
        return;
      }
      return;
    }

    // ── /reply <ticketId> <message> ──
    if (text.startsWith("/reply ")) {
      const rest = text.slice(7).trim();
      const spaceIdx = rest.indexOf(" ");
      if (spaceIdx === -1) {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ Usage : <code>/reply TICKET_ID votre message</code>`,
          parse_mode: "HTML",
        });
        return;
      }
      const ticketId = rest.slice(0, spaceIdx).trim();
      const replyMsg = rest.slice(spaceIdx + 1).trim();
      const result = await handlers.replyToTicket(ticketId, replyMsg);
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: result
          ? `✅ <b>Réponse envoyée</b>\n\n👤 ${result.userName}\n📌 ${result.subject}\n💬 <i>${replyMsg.slice(0, 100)}</i>\n🕐 ${now()}`
          : `⚠️ Ticket introuvable : <code>${ticketId}</code>`,
        parse_mode: "HTML",
      });
      return;
    }

    // ── /close <ticketId> ──
    if (text.startsWith("/close ")) {
      const ticketId = text.slice(7).trim();
      const result = await handlers.closeTicket(ticketId);
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: result
          ? `🔒 <b>Ticket clôturé</b>\n\n👤 ${result.userName}\n📌 ${result.subject}\n🆔 <code>${ticketId}</code>\n🕐 ${now()}`
          : `⚠️ Ticket introuvable : <code>${ticketId}</code>`,
        parse_mode: "HTML",
      });
      return;
    }

    // ── /ban email [reason] ──
    if (text.startsWith("/ban ")) {
      const parts = text.slice(5).trim().split(/\s+/);
      const email = parts[0];
      const reason = parts.slice(1).join(" ") || "Banni via Telegram bot";
      const result = await handlers.banUser(email, reason, false);
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: result
          ? `🚫 <b>${result.userName}</b> banni.\n📧 ${email}\n⚠️ Raison : ${reason}`
          : `⚠️ Utilisateur introuvable : <code>${email}</code>`,
        parse_mode: "HTML",
      });
      return;
    }

    // ── /unban email ──
    if (text.startsWith("/unban ")) {
      const email = text.slice(7).trim();
      const result = await handlers.banUser(email, "", true);
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: result
          ? `✅ <b>${result.userName}</b> débanni.\n📧 ${email}`
          : `⚠️ Utilisateur introuvable : <code>${email}</code>`,
        parse_mode: "HTML",
      });
      return;
    }

    // ── /user email ──
    if (text.startsWith("/user ")) {
      const email = text.slice(6).trim();
      const info = await handlers.getUserInfo(email);
      if (!info) {
        await callBotApi("sendMessage", { chat_id: chatId, text: `⚠️ Utilisateur introuvable : <code>${email}</code>`, parse_mode: "HTML" });
        return;
      }
      const kycIcon = info.kycStatus === "verified" ? "✅" : info.kycStatus === "pending" ? "⏳" : "❌";
      const typeLabel: Record<string, string> = { deposit: "Dépôt", withdrawal: "Retrait", transfer: "Transfert", transfer_out: "Transfert", payment_link: "Lien" };
      const txLines = info.recentTx.slice(0, 3).map(t =>
        `  • ${typeLabel[t.type] ?? t.type} ${fmt(t.amount, t.currency)} — ${t.status}`
      ).join("\n") || "  Aucune transaction";
      const walletLines = info.wallets.map(w => `  ${w.currency}: ${fmt(w.balance, w.currency)}`).join("\n");
      const date = info.createdAt ? new Date(info.createdAt).toLocaleDateString("fr-FR") : "—";
      const msg =
        `👤 <b>${info.userName}</b>\n` +
        `📧 ${info.email}\n` +
        `🌍 ${info.country ?? "—"} | 📅 Inscrit le ${date}\n` +
        `──────────────────\n` +
        `💰 Solde : <b>${fmt(info.balance, info.currency)}</b>\n` +
        (walletLines ? `🗂 Autres wallets :\n${walletLines}\n` : "") +
        `🔑 KYC : ${kycIcon} <b>${info.kycStatus}</b>\n` +
        `──────────────────\n` +
        `📋 Dernières transactions :\n${txLines}\n` +
        `──────────────────\n` +
        `🕐 ${now()}`;
      await callBotApi("sendMessage", { chat_id: chatId, text: msg, parse_mode: "HTML" });
      return;
    }

    // ── /solde email ──
    if (text.startsWith("/solde ")) {
      const email = text.slice(7).trim();
      const info = await handlers.getUserInfo(email);
      if (!info) {
        await callBotApi("sendMessage", { chat_id: chatId, text: `⚠️ Utilisateur introuvable : <code>${email}</code>`, parse_mode: "HTML" });
        return;
      }
      const walletLines = info.wallets.map(w => `  ${w.currency}: ${fmt(w.balance, w.currency)}`).join("\n");
      const msg =
        `💰 <b>Solde de ${info.userName}</b>\n` +
        `──────────────────\n` +
        `📧 ${info.email}\n` +
        `💵 Principal : <b>${fmt(info.balance, info.currency)}</b>\n` +
        (walletLines ? `🗂 Autres wallets :\n${walletLines}\n` : "") +
        `──────────────────\n` +
        `🕐 ${now()}`;
      await callBotApi("sendMessage", { chat_id: chatId, text: msg, parse_mode: "HTML" });
      return;
    }

    // ── /taux CURRENCY RATE ──
    if (text.startsWith("/taux ")) {
      const parts = text.slice(6).trim().split(/\s+/);
      if (parts.length < 2) {
        await callBotApi("sendMessage", { chat_id: chatId, text: `⚠️ Usage : <code>/taux XAF 655</code>`, parse_mode: "HTML" });
        return;
      }
      const currency = parts[0].toUpperCase();
      const rate = parseFloat(parts[1]);
      if (isNaN(rate) || rate <= 0) {
        await callBotApi("sendMessage", { chat_id: chatId, text: `⚠️ Taux invalide. Exemple : <code>/taux XAF 655</code>`, parse_mode: "HTML" });
        return;
      }
      const ok = await handlers.setFxRate(currency, rate);
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: ok
          ? `✅ Taux <b>1 ${currency} = ${rate} XAF</b> mis à jour.\n🕐 ${now()}`
          : `❌ Impossible de mettre à jour le taux pour <b>${currency}</b>.`,
        parse_mode: "HTML",
      });
      return;
    }

    // ── /pays — list countries with toggle buttons ──
    if (text === "/pays") {
      const countries = await handlers.getCountries();
      const inline_keyboard = countries.map(c => ([{
        text: `${c.isActive ? "✅" : "🔴"} ${c.name} (${c.code})`,
        callback_data: `ct:${c.id}`,
      }]));
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: `🌍 <b>GESTION DES PAYS (${countries.length})</b>\nCliquez pour activer/désactiver un marché :`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [...inline_keyboard, [{ text: "🏠 Menu", callback_data: "cmd:menu" }]] },
      });
      return;
    }

    // ── /rapport [period] ──
    if (text.startsWith("/rapport") || text === "/rapport") {
      const arg = text.split(/\s+/)[1];
      const periodMap: Record<string, string> = { mois: "this_month", semaine: "this_week", today: "today", all: "all" };
      const period = (arg && periodMap[arg]) ? periodMap[arg] : "this_month";
      const s = await handlers.getStats(period);
      const totalTx = s.depositCount + s.withdrawalCount + s.transferCount + s.paymentLinkCount;
      const labelMap: Record<string, string> = { today: "AUJOURD'HUI", this_week: "CETTE SEMAINE", this_month: "CE MOIS", all: "TOTAL" };
      const periodTitle = labelMap[period] ?? period.toUpperCase();
      const msg =
        `📊 <b>RAPPORT — ${periodTitle}</b>\n` +
        `──────────────────\n` +
        `👥 Utilisateurs : <b>${s.totalUsers.toLocaleString("fr-FR")}</b> (bannis : ${s.bannedUsers})\n` +
        `──────────────────\n` +
        `💸 <b>TRANSACTIONS</b>\n` +
        `  Total : <b>${totalTx.toLocaleString("fr-FR")}</b>\n` +
        `  📥 Dépôts : ${s.depositCount} — <b>${fmt(s.depositVol, "XAF")}</b>\n` +
        `  📤 Retraits : ${s.withdrawalCount} — <b>${fmt(s.withdrawalVol, "XAF")}</b>\n` +
        `  🔄 Transferts : ${s.transferCount}\n` +
        `  🔗 Liens paiement : ${s.paymentLinkCount}\n` +
        `──────────────────\n` +
        `💰 <b>REVENUS</b>\n` +
        `  Total commissions : <b>${fmt(s.totalRevenue, "XAF")}</b>\n` +
        `  Dépôts : ${fmt(s.depositFees, "XAF")} | Retraits : ${fmt(s.withdrawalFees, "XAF")}\n` +
        `  Transferts : ${fmt(s.transferFees, "XAF")} | Liens : ${fmt(s.paymentLinkFees, "XAF")}\n` +
        `──────────────────\n` +
        `⏳ <b>EN ATTENTE</b>\n` +
        `  Dépôts : ${s.pendingDeposits} | Retraits : ${s.pendingWithdrawals}\n` +
        `  KYC : ⏳${s.kycPending} ✅${s.kycApproved} ❌${s.kycRejected}\n` +
        `──────────────────\n` +
        `🕐 ${now()}`;
      await sendWithBanner(chatId, "rapport", msg, { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "cmd:menu" }]] });
      return;
    }

    // ── /top — top 10 users by balance ──
    if (text === "/top") {
      const topUsers = await handlers.getTopUsers();
      const medals = ["🥇", "🥈", "🥉"];
      const lines = topUsers.map((u, i) =>
        `${medals[i] ?? `${i + 1}.`} <b>${u.userName}</b> — <b>${fmt(u.balance, u.currency)}</b>\n   📧 ${u.email}`
      ).join("\n\n");
      await sendWithBanner(
        chatId, "top",
        `🏆 <b>TOP 10 UTILISATEURS (solde)</b>\n──────────────────\n${lines || "Aucun utilisateur"}\n──────────────────\n🕐 ${now()}`,
        { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "cmd:menu" }]] }
      );
      return;
    }

    // ── /broadcast Sujet;Corps ──
    if (text.startsWith("/broadcast ")) {
      const content = text.slice(11).trim();
      const sep = content.indexOf(";");
      if (sep === -1) {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `📢 <b>Broadcast Email</b>\n\nUsage : <code>/broadcast Sujet;Corps du message</code>\n\nExemple :\n<code>/broadcast Offre spéciale;Bonjour {prenom}, nous avons une offre pour vous !</code>`,
          parse_mode: "HTML",
        });
        return;
      }
      const subject = content.slice(0, sep).trim();
      const body = content.slice(sep + 1).trim();
      await callBotApi("sendMessage", { chat_id: chatId, text: `⏳ Envoi du broadcast en cours...`, parse_mode: "HTML" });
      const result = await handlers.broadcastEmail(subject, body);
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: `✅ <b>Broadcast envoyé !</b>\n📧 Destinataires : <b>${result.count}</b>\n📋 Sujet : <i>${subject}</i>\n🕐 ${now()}`,
        parse_mode: "HTML",
      });
      return;
    }

    // ── /verif REFERENCE ──
    if (text.startsWith("/verif ")) {
      const reference = text.slice(7).trim();
      const tx = await handlers.verifyTransaction(reference);
      if (!tx) {
        await callBotApi("sendMessage", { chat_id: chatId, text: `⚠️ Transaction introuvable : <code>${reference}</code>`, parse_mode: "HTML" });
        return;
      }
      const statusIcon: Record<string, string> = { completed: "✅", pending: "⏳", failed: "❌", processing: "🔄", pending_manual: "⏸" };
      const typeLabel: Record<string, string> = { deposit: "💰 Dépôt", withdrawal: "📤 Retrait", transfer: "🔄 Transfert", transfer_out: "📤 Transfert sortant", payment_link: "🔗 Lien de paiement" };
      const msg =
        `🔍 <b>TRANSACTION</b>\n` +
        `──────────────────\n` +
        `👤 ${tx.userName}\n` +
        `${typeLabel[tx.type] ?? tx.type} : <b>${fmt(tx.amount, tx.currency)}</b>\n` +
        `${statusIcon[tx.status] ?? "🔸"} Statut : <b>${tx.status}</b>\n` +
        `🔖 Réf : <code>${reference}</code>\n` +
        (tx.description ? `📝 ${tx.description}\n` : "") +
        `📅 ${tx.createdAt ? new Date(tx.createdAt).toLocaleString("fr-FR") : "—"}\n` +
        `──────────────────\n` +
        `🕐 ${now()}`;
      await sendWithBanner(chatId, "verif", msg);
      return;
    }

    // ── /liens — active payment links today ──
    if (text === "/liens") {
      const links = await handlers.getActiveLinks();
      if (links.length === 0) {
        await callBotApi("sendMessage", { chat_id: chatId, text: `📎 Aucun lien de paiement créé aujourd'hui.`, parse_mode: "HTML" });
        return;
      }
      const lines = links.slice(0, 15).map((l, i) =>
        `${i + 1}. <b>${l.title}</b> — ${fmt(l.amount, l.currency)}\n   👤 ${l.userName} | 🔗 /pay/${l.slug}`
      ).join("\n\n");
      await sendWithBanner(
        chatId, "liens",
        `📎 <b>LIENS ACTIFS AUJOURD'HUI (${links.length})</b>\n──────────────────\n${lines}\n──────────────────\n🕐 ${now()}`
      );
      return;
    }

    // ── /soldeA — platform total balance ──
    if (text === "/soldeA" || text === "/soldea" || text === "/SOLDEA") {
      const info = await handlers.getPlatformBalance();
      const currLines = info.byCurrency.map(({ currency, balance }) =>
        `  • ${currency} : <b>${fmtNum(balance)}</b>`
      ).join("\n") || "  Aucun solde";
      const rev = info.revenue;
      await sendWithBanner(
        chatId, "wallet",
        `🏦 <b>SOLDE TOTAL ASHTECH PAY</b>\n` +
        `──────────────────\n` +
        `${currLines}\n` +
        `💰 <b>Total ≈ ${fmtNum(info.totalXAF)} XAF</b>\n` +
        `👥 Utilisateurs actifs : <b>${info.userCount}</b>\n` +
        `──────────────────\n` +
        `📊 <b>REVENUS (marges)</b>\n` +
        `  • Dépôts : <b>${fmtNum(rev.deposits)} XAF</b>\n` +
        `  • Retraits : <b>${fmtNum(rev.withdrawals)} XAF</b>\n` +
        `  • Envois : <b>${fmtNum(rev.transfers)} XAF</b>\n` +
        `  • Liens paiement : <b>${fmtNum(rev.paymentLinks)} XAF</b>\n` +
        `  • Conversions : <b>${fmtNum(rev.conversions)} XAF</b>\n` +
        `💵 <b>Total revenus : ${fmtNum(rev.total)} XAF</b>\n` +
        `──────────────────\n` +
        `🕐 ${now()}`
      );
      return;
    }

    // ── /search query ──
    if (text.startsWith("/search ")) {
      const query = text.slice(8).trim();
      if (!query || query.length < 2) {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ Saisissez au moins 2 caractères.\nUsage : <code>/search jean</code>`,
          parse_mode: "HTML",
        });
        return;
      }
      const results = await handlers.searchUsers(query);
      if (results.length === 0) {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `🔍 Aucun utilisateur trouvé pour <code>${query}</code>`,
          parse_mode: "HTML",
        });
        return;
      }
      const kycIcon = (s: string) => s === "verified" ? "✅" : s === "pending" ? "⏳" : "❌";
      const lines = results.map((u, i) =>
        `${i + 1}. ${u.banned ? "🚫 " : ""}` +
        `<b>${u.userName}</b>\n` +
        `   📧 <code>${u.email}</code>\n` +
        `   💰 ${fmt(u.balance, u.currency)} | KYC ${kycIcon(u.kycStatus)}` +
        (u.country ? ` | 🌍 ${u.country}` : "")
      ).join("\n\n");
      await sendWithBanner(
        chatId, "search",
        `🔍 <b>${results.length} résultat(s) pour « ${query} »</b>\n` +
        `──────────────────\n${lines}\n──────────────────\n` +
        `<i>Utilisez /user email pour plus de détails</i>`,
        { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "cmd:menu" }]] }
      );
      return;
    }

    // ── /resetpw email ──
    if (text.startsWith("/resetpw ")) {
      const email = text.slice(9).trim();
      const result = await handlers.resetUserPassword(email);
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: result
          ? `✅ Lien de réinitialisation envoyé à <b>${result.userName}</b> (<code>${email}</code>).\n🕐 ${now()}`
          : `⚠️ Utilisateur introuvable : <code>${email}</code>`,
        parse_mode: "HTML",
      });
      return;
    }

    // ── /dip email|numero — Débloquer une IP par identifiant ──
    if (text.startsWith("/dip ")) {
      const identifier = text.slice(5).trim();
      if (!identifier) {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ Usage : <code>/dip email</code> ou <code>/dip numero</code>\nExemple : <code>/dip jean@email.com</code>`,
          parse_mode: "HTML",
        });
        return;
      }
      const result = await handlers.unblockIpByIdentifier(identifier);
      if (result.unblocked === 0) {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `ℹ️ <b>Aucune IP bloquée</b> trouvée pour <code>${identifier}</code>.\nL'IP est peut-être déjà débloquée ou l'identifiant ne correspond à aucun blocage actif.`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "🛡️ Voir IPs bloquées", callback_data: "cmd:ipb" }, { text: "🏠 Menu", callback_data: "cmd:menu" }]] },
        });
        return;
      }
      const ipLines = result.ips.map(ip => `  ✅ <code>${ip}</code>`).join("\n");
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text:
          `🔓 <b>IP DÉBLOQUÉE</b>\n──────────────────\n` +
          `👤 Identifiant : <code>${identifier}</code>\n` +
          `📍 IP(s) libérée(s) : ${result.unblocked}\n${ipLines}\n` +
          `──────────────────\n🕐 ${now()}`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🛡️ Voir IPs bloquées", callback_data: "cmd:ipb" }, { text: "🏠 Menu", callback_data: "cmd:menu" }]] },
      });
      return;
    }

    // ── /ipb — IPs bloquées ──
    if (text === "/ipb") {
      const blocked = handlers.getBlockedIps();
      if (blocked.length === 0) {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `🛡️ <b>IPs BLOQUÉES</b>\n──────────────────\n✅ Aucune IP actuellement bloquée.\n🕐 ${now()}`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "cmd:menu" }]] },
        });
        return;
      }
      const lines = blocked.map(b => {
        const remaining = Math.max(0, Math.ceil((b.blockedUntil - Date.now()) / 1000));
        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;
        const time = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
        return `🔴 <code>${b.ip}</code>\n👤 <code>${b.identifier}</code>\n⏱️ ${time} restant`;
      }).join("\n──────────────────\n");
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: `🛡️ <b>IPs BLOQUÉES (${blocked.length})</b>\n──────────────────\n${lines}\n──────────────────\n🕐 ${now()}`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "cmd:menu" }]] },
      });
      return;
    }

    // ── Standard command map ──
    const cmdMap: Record<string, { period?: string; type: string }> = {
      "/start":   { type: "menu" },
      "/menu":    { type: "menu" },
      "/stats":   { type: "dash", period: "this_month" },
      "/today":   { type: "dash", period: "today" },
      "/week":    { type: "dash", period: "this_week" },
      "/mois":    { type: "dash", period: "this_month" },
      "/pending": { type: "pending", period: "this_month" },
      "/kyc":     { type: "kyc", period: "this_month" },
      "/users":   { type: "users", period: "this_month" },
      "/revenue": { type: "revenue", period: "this_month" },
      "/aide":    { type: "help" },
      "/help":    { type: "help" },
      "/ping":    { type: "ping" },
      "/pong":    { type: "pong" },
    };

    const matched = Object.keys(cmdMap).find(k => text === k || text.startsWith(k + " ") || text.startsWith(k + "@"));
    if (matched) {
      const { type, period = "this_month" } = cmdMap[matched];

      if (type === "menu") { await sendMenu(chatId); return; }

      if (type === "ping" || type === "pong") {
        const sentAtMs = typeof update.message?.date === "number" ? update.message.date * 1000 : null;
        const latencyMs = sentAtMs ? Date.now() - sentAtMs : null;
        const reply = type === "ping" ? "pong" : "ping";
        const speedTxt = latencyMs !== null ? ` (${latencyMs} ms)` : "";
        await callBotApi("sendMessage", { chat_id: chatId, text: `${reply}${speedTxt}` });
        return;
      }

      if (type === "help") {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text:
            `📖 <b>TOUTES LES COMMANDES</b>\n` +
            `──────────────────\n` +
            `<b>📊 Statistiques</b>\n` +
            `/menu — Menu principal interactif\n` +
            `/stats — Dashboard ce mois\n` +
            `/mois — Dashboard ce mois (alias)\n` +
            `/today — Stats aujourd'hui\n` +
            `/week — Stats cette semaine\n` +
            `/pending — Dépôts/retraits en attente\n` +
            `/kyc — Résumé vérifications KYC\n` +
            `/users — Derniers inscrits\n` +
            `/revenue — Revenus & commissions\n` +
            `/rapport [mois|semaine|today|all] — Rapport complet\n` +
            `──────────────────\n` +
            `<b>👤 Utilisateurs</b>\n` +
            `/search query — Rechercher par email partiel\n` +
            `/user email — Infos complètes utilisateur\n` +
            `/solde email — Solde en temps réel\n` +
            `/top — Top 10 utilisateurs par solde\n` +
            `/ban email [raison] — Bannir un utilisateur\n` +
            `/unban email — Débannir un utilisateur\n` +
            `/resetpw email — Envoyer reset mot de passe\n` +
            `──────────────────\n` +
            `<b>💸 Transactions & Paiements</b>\n` +
            `/verif REFERENCE — Vérifier statut d'une transaction\n` +
            `/liens — Liens de paiement actifs aujourd'hui\n` +
            `/soldeA — Solde total plateforme + revenus\n` +
            `──────────────────\n` +
            `<b>⚙️ Administration</b>\n` +
            `/taux DEVISE TAUX — Modifier un taux de change FX\n` +
            `/pays — Activer/désactiver des pays\n` +
            `/broadcast Sujet;Corps — Email groupé à tous les utilisateurs\n` +
            `/ipb — IPs actuellement bloquées\n` +
            `/dip email(numero) — Débloquer une IP\n` +
            `──────────────────\n` +
            `<b>❓ Aide</b>\n` +
            `/aide — Afficher cette liste\n` +
            `/help — Afficher cette liste (alias)\n` +
            `/ping — Test de connectivité (répond "pong" + latence)\n` +
            `/pong — Test de connectivité (répond "ping" + latence)\n` +
            `──────────────────\n` +
            `🕐 ${now()}`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "cmd:menu" }]] },
        });
        return;
      }

      const stats = await handlers.getStats(period);
      let msgText = "";
      if (type === "pending") msgText = formatPending(stats);
      else if (type === "kyc") msgText = formatKyc(stats);
      else if (type === "users") msgText = formatRecentUsers(stats);
      else if (type === "revenue") msgText = formatRevenue(stats);
      else msgText = formatDashboard(stats);

      const txtBannerMap: Record<string, string> = { pending: "pending", kyc: "kyc", users: "users", revenue: "revenue" };
      await sendWithBanner(chatId, txtBannerMap[type] ?? "stats", msgText, { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "cmd:menu" }]] });
      return;
    }

    // ── Commande inconnue ──
    if (text.startsWith("/")) {
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text:
          `❓ <b>Commande inexistante</b> : <code>${text.split(" ")[0]}</code>\n\n` +
          `Tapez /aide pour voir toutes les commandes disponibles.`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "📖 Voir l'aide", callback_data: "cmd:menu" }]] },
      });
    }
  }
}

// ─── ENREGISTREMENT DU WEBHOOK ──────────────────

/**
 * VULN-A3: Derives a stable webhook secret from SESSION_SECRET so Telegram
 * can include X-Telegram-Bot-Api-Secret-Token on every update it posts.
 * We verify that header before processing any webhook payload.
 *
 * Fallback: process-local random (never a predictable constant) so dev
 * environments without SESSION_SECRET still get meaningful protection.
 * In production, SESSION_SECRET is required (index.ts exits if absent).
 */
const _DEV_WEBHOOK_SECRET = crypto.randomBytes(32).toString("hex");
export function getTelegramWebhookSecret(): string {
  const base = process.env.SESSION_SECRET;
  if (!base) return _DEV_WEBHOOK_SECRET; // random per process — not guessable
  // 64 hex chars — valid for Telegram's secret_token field (alphanumeric + _ -)
  return crypto.createHmac("sha256", base).update("tg-webhook-secret-v1").digest("hex").slice(0, 64);
}

export async function getWebhookInfo(): Promise<any> {
  if (!BOT_API) return { error: "TELEGRAM_BOT_TOKEN not configured on this instance" };
  const result = await callBotApi("getWebhookInfo", {});
  return result;
}

export async function registerTelegramWebhook(webhookUrl: string): Promise<void> {
  if (!BOT_API) return;
  try {
    const res = await fetch(`${BOT_API}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: false,
        secret_token: getTelegramWebhookSecret(), // VULN-A3: enforce signature
      }),
    });
    const data = await res.json() as any;
    if (data.ok) {
      console.log("[Telegram] Webhook enregistré :", webhookUrl);
    } else {
      console.warn("[Telegram] Webhook non enregistré :", data.description);
    }
  } catch (err: any) {
    console.warn("[Telegram] Erreur setWebhook :", err?.message);
  }
}

// ─── KYC (version texte seul — fallback) ──────────────────

export async function notifyKycSubmitted(opts: {
  userName: string;
  userEmail: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  country?: string;
  city?: string;
  businessType: string;
  businessCategory: string;
  businessDescription: string;
}): Promise<void> {
  const docTypeLabel: Record<string, string> = {
    passport: "🛂 Passeport",
    national_id: "🪪 Carte Nationale d'Identité",
    drivers_license: "🚗 Permis de conduire",
    residence_permit: "🏠 Titre de séjour",
  };
  const businessTypeLabel: Record<string, string> = {
    individual: "👤 Particulier",
    company: "🏢 Entreprise",
    freelancer: "💼 Freelance",
    ngo: "🌍 ONG",
  };

  const msg =
    `📋 <b>NOUVELLE DEMANDE DE VÉRIFICATION KYC</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `🆔 ID compte : <code>#${opts.userId}</code>\n` +
    `──────────────────\n` +
    `📄 Document : ${docTypeLabel[opts.documentType] ?? opts.documentType}\n` +
    `🔢 N° Document : <code>${opts.documentNumber}</code>\n` +
    (opts.country ? `🌍 Pays : ${opts.country}\n` : "") +
    (opts.city ? `🏙 Ville : ${opts.city}\n` : "") +
    `──────────────────\n` +
    `🏷 Type de compte : ${businessTypeLabel[opts.businessType] ?? opts.businessType}\n` +
    `📂 Catégorie : ${opts.businessCategory}\n` +
    `📝 Description : ${opts.businessDescription}\n` +
    `──────────────────\n` +
    `⚡ <b>Action requise → Panel Admin › KYC</b>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyKycApproved(opts: {
  adminName: string;
  userName: string;
  userEmail: string;
  userId: string;
}): Promise<void> {
  const msg =
    `✅ <b>KYC APPROUVÉ</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `🆔 ID compte : <code>#${opts.userId}</code>\n` +
    `🛡️ Approuvé par : <b>${opts.adminName}</b>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyKycRejected(opts: {
  adminName: string;
  userName: string;
  userEmail: string;
  userId: string;
  reason: string;
}): Promise<void> {
  const msg =
    `❌ <b>KYC REJETÉ</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `🆔 ID compte : <code>#${opts.userId}</code>\n` +
    `🛡️ Rejeté par : <b>${opts.adminName}</b>\n` +
    `⚠️ Raison : ${opts.reason}\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── INSCRIPTION ──────────────────

export async function notifyNewUser(opts: {
  userName: string;
  email: string;
  country?: string;
}): Promise<void> {
  const msg =
    `🎉 <b>NOUVEL UTILISATEUR INSCRIT</b>\n` +
    `──────────────────\n` +
    `👤 Nom : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.email}\n` +
    (opts.country ? `🌍 Pays : ${opts.country}\n` : "") +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── AUDIT / ÉVÉNEMENTS DE SÉCURITÉ ──────────────────────────────────────────

const AUDIT_EMOJIS: Record<string, string> = {
  login_success:      "✅",
  login_failed:       "⚠️",
  logout:             "🚪",
  register:           "🎉",
  password_changed:   "🔑",
  password_reset:     "🔄",
  withdrawal_created: "💸",
  withdrawal_failed:  "❌",
  transfer_sent:      "➡️",
  transfer_failed:    "❌",
  deposit_initiated:  "📥",
  payment_link_paid:  "💰",
  role_changed:       "🛡️",
  user_banned:        "🚫",
  user_unbanned:      "✅",
  kyc_approved:       "🟢",
  kyc_rejected:       "🔴",
  session_revoked:    "🔒",
  settings_updated:   "⚙️",
};

const AUDIT_LABELS: Record<string, string> = {
  login_success:      "CONNEXION RÉUSSIE",
  login_failed:       "CONNEXION ÉCHOUÉE",
  logout:             "DÉCONNEXION",
  register:           "INSCRIPTION",
  password_changed:   "MOT DE PASSE MODIFIÉ",
  password_reset:     "RÉINIT. MOT DE PASSE",
  withdrawal_created: "RETRAIT CRÉÉ",
  withdrawal_failed:  "RETRAIT ÉCHOUÉ",
  transfer_sent:      "VIREMENT ENVOYÉ",
  transfer_failed:    "VIREMENT ÉCHOUÉ",
  deposit_initiated:  "DÉPÔT INITIÉ",
  payment_link_paid:  "LIEN DE PAIEMENT PAYÉ",
  role_changed:       "RÔLE MODIFIÉ",
  user_banned:        "UTILISATEUR BANNI",
  user_unbanned:      "UTILISATEUR DÉBANNI",
  kyc_approved:       "KYC APPROUVÉ",
  kyc_rejected:       "KYC REJETÉ",
  session_revoked:    "SESSION RÉVOQUÉE",
  settings_updated:   "PARAMÈTRES MODIFIÉS",
};

export async function notifyAuditEvent(opts: {
  action: string;
  actorType: "user" | "admin" | "system";
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  details?: Record<string, unknown> | null;
}): Promise<void> {
  const emoji = AUDIT_EMOJIS[opts.action] ?? "📋";
  const label = AUDIT_LABELS[opts.action] ?? opts.action.toUpperCase().replace(/_/g, " ");
  const statusEmoji = opts.success ? "✅" : "❌";
  const actorLabel = opts.actorType === "admin" ? "Admin" : opts.actorType === "system" ? "Système" : "Utilisateur";

  // Lignes optionnelles détails
  const detailLines: string[] = [];
  if (opts.details) {
    const skip = new Set(["role", "reason", "newRole"]); // certains apparaissent déjà dans le label
    for (const [k, v] of Object.entries(opts.details)) {
      if (v === null || v === undefined || v === "") continue;
      if (k === "amount" && opts.details.currency)
        detailLines.push(`💰 Montant : <b>${Number(v).toLocaleString("fr-FR")} ${opts.details.currency}</b>`);
      else if (k === "currency" || k === "reference")
        continue; // déjà inclus dans amount ou pas utile ici
      else if (k === "newRole")
        detailLines.push(`🔖 Nouveau rôle : <b>${v}</b>`);
      else if (k === "reason")
        detailLines.push(`📝 Raison : ${v}`);
      else if (k === "affectedUserId")
        detailLines.push(`🎯 Utilisateur cible : <code>${v}</code>`);
    }
  }

  const msg =
    `${emoji} <b>${label}</b>\n` +
    `──────────────────\n` +
    `${statusEmoji} Statut : ${opts.success ? "Succès" : "Échec"}\n` +
    `👤 Acteur : ${actorLabel}\n` +
    (opts.userName  ? `🙍 Nom : <b>${opts.userName}</b>\n`      : "") +
    (opts.userEmail ? `📧 Email : ${opts.userEmail}\n`           : "") +
    (opts.userId    ? `🆔 ID : <code>${opts.userId}</code>\n`    : "") +
    (opts.ipAddress ? `🌐 IP : <code>${opts.ipAddress}</code>\n` : "") +
    (detailLines.length ? detailLines.join("\n") + "\n" : "") +
    `🕐 Heure : ${now()}`;

  await sendMessage(msg);
}

// ── Notifications accès panneau admin ────────────────────────────────────────

export async function notifyAdminPanelAccess(opts: {
  type:
    | "otp_success"      // OTP TOTP validé → session admin ouverte
    | "admin_login"      // Connexion admin réussie
    | "panel_access"     // Accès à une route admin (succès, 1x/session)
    | "blocked_no_role"  // Rôle insuffisant
    | "blocked_otp"      // OTP admin invalide / expiré
    | "blocked_ip"       // IP bloquée manuellement
    | "blocked_no_auth"; // Non authentifié (no userId)
  ip: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  path?: string;
}): Promise<void> {
  const t = new Date();
  const heure = t.toLocaleString("fr-FR", { timeZone: "Africa/Douala", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date  = t.toLocaleString("fr-FR", { timeZone: "Africa/Douala", day: "2-digit", month: "2-digit", year: "numeric" });

  type TypeDef = { emoji: string; label: string; success: boolean };
  const types: Record<typeof opts.type, TypeDef> = {
    otp_success:      { emoji: "🔓", label: "CONNEXION ADMIN — OTP validé",           success: true  },
    admin_login:      { emoji: "🔓", label: "CONNEXION ADMIN — accès autorisé",       success: true  },
    panel_access:     { emoji: "👁️",  label: "ACCÈS PANNEAU ADMIN",                    success: true  },
    blocked_no_role:  { emoji: "🚫", label: "TENTATIVE BLOQUÉE — rôle insuffisant",   success: false },
    blocked_otp:      { emoji: "❌", label: "TENTATIVE BLOQUÉE — OTP invalide",       success: false },
    blocked_ip:       { emoji: "🛡️", label: "TENTATIVE BLOQUÉE — IP liste noire",     success: false },
    blocked_no_auth:  { emoji: "⚠️", label: "TENTATIVE BLOQUÉE — non authentifié",    success: false },
  };
  const { emoji, label, success } = types[opts.type];
  const statusLine = success ? "✅ <b>Autorisé</b>" : "🔴 <b>Refusé</b>";

  const msg =
    `${emoji} <b>ADMIN PANEL — ${label}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `${statusLine}\n` +
    (opts.userName  ? `👤 Nom   : <b>${opts.userName}</b>\n`         : "") +
    (opts.userEmail ? `📧 Email : ${opts.userEmail}\n`               : "") +
    (opts.userRole  ? `🎭 Rôle  : <code>${opts.userRole}</code>\n`   : "") +
    (opts.userId    ? `🆔 ID    : <code>${opts.userId}</code>\n`     : "") +
    `🌐 IP    : <code>${opts.ip}</code>\n` +
    (opts.path      ? `🔗 Route : <code>${opts.path}</code>\n`       : "") +
    `📅 Date  : ${date} à ${heure}`;

  await sendMessage(msg);
}
