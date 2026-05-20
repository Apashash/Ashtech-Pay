/**
 * Service de notifications Telegram — AshTech Pay
 * Envoie des alertes en temps réel pour toutes les transactions et événements de sécurité.
 */

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
  if (!BOT_API) return null;
  try {
    const res = await fetch(`${BOT_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err: any) {
    console.warn(`[Telegram] ${method} error:`, err?.message);
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

async function sendPhoto(photoUrl: string, caption?: string): Promise<void> {
  if (!isConfigured()) return;
  await callBotApi("sendPhoto", {
    chat_id: CHAT_ID,
    photo: photoUrl,
    caption: caption ?? "",
    parse_mode: "HTML",
  });
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
const pendingCustomRejections = new Map<string, { submissionId: string; messageId: number }>();
// State: waiting for withdrawal rejection reason (chatId → reference + messageId)
const pendingWithdrawalRejections = new Map<string, { reference: string; messageId: number }>();

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
  GN: { flag: "🇬🇳", name: "Guinée" },
  GA: { flag: "🇬🇦", name: "Gabon" },
  CG: { flag: "🇨🇬", name: "Congo" },
  CF: { flag: "🇨🇫", name: "Centrafrique" },
  TD: { flag: "🇹🇩", name: "Tchad" },
  CD: { flag: "🇨🇩", name: "RD Congo" },
  NG: { flag: "🇳🇬", name: "Nigeria" },
  GH: { flag: "🇬🇭", name: "Ghana" },
  KE: { flag: "🇰🇪", name: "Kenya" },
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
};

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  XAF: "CM", XAFC: "CM", XAFG: "GA",
  XOF: "SN", XOFB: "BJ", XOFC: "CI", XOFF: "BF", XOFT: "TG", XOFS: "SN",
  NGN: "NG", GHS: "GH", KES: "KE", TZS: "TZ", UGX: "UG", RWF: "RW",
  USD: "US", EUR: "EU", GBP: "GB", CNY: "CN", CDF: "CD",
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  cameroun: "CM", "côte d'ivoire": "CI", "cote d'ivoire": "CI",
  sénégal: "SN", senegal: "SN", bénin: "BJ", benin: "BJ",
  togo: "TG", mali: "ML", niger: "NE", "burkina faso": "BF",
  guinée: "GN", guinee: "GN", gabon: "GA", congo: "CG",
  "rd congo": "CD", "rdc": "CD", nigeria: "NG", ghana: "GH",
  kenya: "KE", tanzanie: "TZ", tanzania: "TZ", ouganda: "UG", uganda: "UG",
  rwanda: "RW", madagascar: "MG", "états-unis": "US", france: "FR",
  "royaume-uni": "GB", europe: "EU", tchad: "TD", centrafrique: "CF",
  "guinée équatoriale": "GQ",
};

/** Retourne "🇨🇲 Cameroun" à partir d'un code pays, d'un nom ou d'un code devise */
function countryDisplay(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (COUNTRY_INFO[upper]) return `${COUNTRY_INFO[upper].flag} ${COUNTRY_INFO[upper].name}`;
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

// ─── DÉPÔTS ──────────────────

export async function notifyNewDeposit(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  method: string;
  phone?: string;
  reference: string;
  provider?: string;
  country?: string;
  grossAmount?: string | number;
}): Promise<void> {
  const pays = opts.country ? countryDisplay(opts.country) : countryDisplay(opts.currency);
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const msg =
    `🟡 <b>NOUVEAU DÉPÔT EN ATTENTE</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (pays ? `🌍 Pays : <b>${pays}</b>\n` : "") +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant crédité : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    `📱 Méthode : ${opts.method}\n` +
    (opts.phone ? `📞 Téléphone : ${opts.phone}\n` : "") +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyDepositConfirmed(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  reference: string;
  provider?: string;
  country?: string;
  grossAmount?: string | number;
  depositType?: string;
  paymentMethod?: string;
  phone?: string;
  operator?: string;
  // Payment link specific — payer info
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;
  // Payment link specific — beneficiary info
  beneficiaryUsername?: string;
  beneficiaryPhone?: string;
  creditedCurrency?: string;
  linkTitle?: string;
}): Promise<void> {
  const pays = opts.country ? countryDisplay(opts.country) : countryDisplay(opts.currency);
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const isLink = opts.depositType === "payment_link";
  const typeLabel = isLink ? "Lien de paiement" : "Dépôt normal";
  const methodLabel = opts.paymentMethod === "mobile_money" ? "Mobile Money" : opts.paymentMethod || "";

  let msg =
    `✅ <b>PAIEMENT REÇU / DÉPÔT CONFIRMÉ</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (pays ? `🌍 Pays : <b>${pays}</b>\n` : "") +
    `📋 Type : <b>${typeLabel}</b>\n` +
    (isLink && opts.linkTitle ? `🔗 Lien : <b>${opts.linkTitle}</b>\n` : "") +
    (methodLabel ? `📱 Méthode : ${methodLabel}\n` : "") +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (opts.phone ? `📞 Numéro : ${opts.phone}\n` : "") +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant crédité : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    (opts.creditedCurrency ? `💱 Compte crédité : <b>${opts.creditedCurrency}</b>\n` : "") +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;

  if (isLink) {
    msg +=
      `\n──── 💳 PAYEUR ────\n` +
      (opts.payerName ? `👤 Nom : <b>${opts.payerName}</b>\n` : "") +
      (opts.payerEmail ? `📧 Email : ${opts.payerEmail}\n` : "") +
      (opts.payerPhone ? `📞 Téléphone : ${opts.payerPhone}\n` : "") +
      `──── 🏦 BÉNÉFICIAIRE ────\n` +
      `👤 Nom : <b>${opts.userName}</b>\n` +
      `📧 Email : ${opts.userEmail}\n` +
      (opts.beneficiaryUsername ? `🔑 Username : ${opts.beneficiaryUsername}\n` : "") +
      (opts.beneficiaryPhone ? `📞 Téléphone : ${opts.beneficiaryPhone}\n` : "") +
      (opts.creditedCurrency ? `💱 Compte crédité : <b>${opts.creditedCurrency}</b>\n` : "");
  }

  await sendMessage(msg);
}

export async function notifyDepositFailed(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  reference: string;
  reason?: string;
  provider?: string;
  country?: string;
  depositType?: string;
  paymentMethod?: string;
  phone?: string;
  operator?: string;
}): Promise<void> {
  const pays = opts.country ? countryDisplay(opts.country) : countryDisplay(opts.currency);
  const typeLabel = opts.depositType === "payment_link" ? "Lien de paiement" : "Dépôt normal";
  const methodLabel = opts.paymentMethod === "mobile_money" ? "Mobile Money" : opts.paymentMethod || "";
  const msg =
    `❌ <b>ÉCHEC DE PAIEMENT (DÉPÔT)</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (pays ? `🌍 Pays : <b>${pays}</b>\n` : "") +
    `📋 Type : <b>${typeLabel}</b>\n` +
    (methodLabel ? `📱 Méthode : ${methodLabel}\n` : "") +
    (opts.operator ? `📡 Opérateur : <b>${opts.operator}</b>\n` : "") +
    (opts.phone ? `📞 Numéro : ${opts.phone}\n` : "") +
    `💰 Montant : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    (opts.reason ? `⚠️ Raison : ${opts.reason}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── RETRAITS ──────────────────

export async function notifyWithdrawalRequest(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  phone: string;
  operator?: string;
  reference: string;
  provider?: string;
  senderCountry?: string;
  recipientCountry?: string;
  grossAmount?: string | number;
}): Promise<void> {
  const senderPays = countryDisplay(opts.senderCountry || opts.currency);
  const recipientPays = countryDisplay(opts.recipientCountry || opts.currency);
  const sameCountry = senderPays === recipientPays;
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const msg =
    `🔵 <b>DEMANDE DE RETRAIT</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (sameCountry
      ? (senderPays ? `🌍 Pays : <b>${senderPays}</b>\n` : "")
      : `🌍 Expéditeur : <b>${senderPays || "—"}</b>\n` +
        `📍 Destinataire : <b>${recipientPays || "—"}</b>\n`) +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    `📱 Numéro : ${opts.phone}\n` +
    (opts.operator ? `📡 Opérateur : ${opts.operator}\n` : "") +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
  const ref = opts.reference;
  await sendMessageWithKeyboard(msg, [
    [
      { text: "✅ Approuver", callback_data: `wa:${ref}` },
      { text: "❌ Rejeter", callback_data: `wrd:${ref}:can` },
    ],
    [
      { text: "💸 Solde insuffisant", callback_data: `wrd:${ref}:ins` },
      { text: "⚠️ Activité suspecte", callback_data: `wrd:${ref}:frau` },
    ],
    [
      { text: "✍️ Raison personnalisée", callback_data: `wrc:${ref}` },
    ],
  ]);
}

export async function notifyWithdrawalPendingManual(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  phone: string;
  reference: string;
  senderCountry?: string;
  recipientCountry?: string;
  grossAmount?: string | number;
}): Promise<void> {
  const senderPays = countryDisplay(opts.senderCountry || opts.currency);
  const recipientPays = countryDisplay(opts.recipientCountry || opts.currency);
  const sameCountry = senderPays === recipientPays;
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const msg =
    `⏸ <b>RETRAIT EN ATTENTE MANUELLE</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (sameCountry
      ? (senderPays ? `🌍 Pays : <b>${senderPays}</b>\n` : "")
      : `🌍 Expéditeur : <b>${senderPays || "—"}</b>\n` +
        `📍 Destinataire : <b>${recipientPays || "—"}</b>\n`) +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    `📱 Numéro : ${opts.phone}\n` +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    `⚠️ <b>Validation manuelle requise !</b>\n` +
    `🕐 Heure : ${now()}`;
  const ref = opts.reference;
  await sendMessageWithKeyboard(msg, [
    [
      { text: "✅ Approuver & Envoyer", callback_data: `wa:${ref}` },
      { text: "❌ Annuler & Rembourser", callback_data: `wrd:${ref}:can` },
    ],
    [
      { text: "✍️ Raison personnalisée", callback_data: `wrc:${ref}` },
    ],
  ]);
}

export async function notifyWithdrawalAutoValidated(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  reference: string;
  provider?: string;
  grossAmount?: string | number;
}): Promise<void> {
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const msg =
    `✅ <b>RETRAIT VALIDÉ AUTOMATIQUEMENT</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyWithdrawalManuallyValidated(opts: {
  adminName: string;
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  reference: string;
  grossAmount?: string | number;
}): Promise<void> {
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const msg =
    `✅ <b>RETRAIT VALIDÉ MANUELLEMENT</b>\n` +
    `──────────────────\n` +
    `🛡️ Admin : <b>${opts.adminName}</b>\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyWithdrawalFailed(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  reference: string;
  reason?: string;
  provider?: string;
  grossAmount?: string | number;
}): Promise<void> {
  const hasGross = opts.grossAmount != null && String(opts.grossAmount) !== String(opts.amount);
  const msg =
    `❌ <b>ÉCHEC DE RETRAIT</b>\n` +
    `──────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    (hasGross ? `💰 Montant brut : <b>${fmt(opts.grossAmount!, opts.currency)}</b>\n` : "") +
    `💳 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    (opts.reason ? `⚠️ Raison : ${opts.reason}\n` : "") +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
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
      `🚫 Accès bloqué pendant 7 minutes\n` +
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
    `⏱️ Durée estimée : ~${opts.estimatedSeconds}s\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
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

// ─── TRANSFERTS ──────────────────

export async function notifyTransferSent(opts: {
  senderName: string;
  senderEmail: string;
  recipientName: string;
  amount: string | number;
  currency: string;
  reference: string;
}): Promise<void> {
  const msg =
    `💸 <b>TRANSFERT ENVOYÉ</b>\n` +
    `──────────────────\n` +
    `👤 Expéditeur : <b>${opts.senderName}</b> (${opts.senderEmail})\n` +
    `👥 Destinataire : <b>${opts.recipientName}</b>\n` +
    `💰 Montant : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    `🔖 Réf. AshtechPay : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
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

// ─── KYC COMPLET AVEC PHOTOS + BOUTONS ──────────────────

export async function notifyKycSubmittedFull(opts: {
  submissionId: string;
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
  photoUrls: {
    front: string | null;
    back: string | null;
    selfie: string | null;
  };
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

  // 1. Send photos
  if (opts.photoUrls.front) {
    await sendPhoto(opts.photoUrls.front, "📄 <b>Document — Recto</b>");
  }
  if (opts.photoUrls.back) {
    await sendPhoto(opts.photoUrls.back, "📄 <b>Document — Verso</b>");
  }
  if (opts.photoUrls.selfie) {
    await sendPhoto(opts.photoUrls.selfie, "🤳 <b>Selfie avec document</b>");
  }

  // 2. Info message + inline keyboard
  const infoText =
    `📋 <b>NOUVELLE DEMANDE DE VÉRIFICATION KYC</b>\n` +
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

async function sendMenu(chatId: string): Promise<void> {
  await callBotApi("sendMessage", {
    chat_id: chatId,
    text:
      `🏦 <b>AshTech Pay — Panel Admin</b>\n` +
      `──────────────────\n` +
      `Bienvenue ! Choisissez une action ci-dessous 👇`,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: REPLY_KEYBOARD,
      resize_keyboard: true,
      is_persistent: true,
    },
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
    getCountries: () => Promise<{ id: string; code: string; name: string; isActive: boolean }[]>;
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
    approveWithdrawal: (reference: string) => Promise<{ userName: string; amount: string; currency: string } | null>;
    rejectWithdrawal: (reference: string, reason: string) => Promise<{ userName: string } | null>;
    searchUsers: (query: string) => Promise<{ userName: string; email: string; balance: number; currency: string; kycStatus: string; country?: string; banned: boolean }[]>;
  }
): Promise<void> {
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
      pendingCustomRejections.set(chatId, { submissionId, messageId });
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: `✍️ Envoyez la raison du rejet pour cette demande KYC.\n\n<i>Tapez votre message ci-dessous :</i>`,
        parse_mode: "HTML",
        reply_markup: { force_reply: true, selective: true },
      });
      return;
    }

    // ── Approve withdrawal ──
    if (data.startsWith("wa:")) {
      const reference = data.slice(3);
      const result = await handlers.approveWithdrawal(reference);
      if (result) {
        await editMessageText(messageId,
          `✅ <b>RETRAIT APPROUVÉ</b>\n\n👤 ${result.userName}\n💰 ${fmt(result.amount, result.currency)}\n🔖 <code>${reference}</code>\n🕐 ${now()}`);
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
      pendingWithdrawalRejections.set(chatId, { reference, messageId });
      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: `✍️ Envoyez la raison du rejet pour le retrait <code>${reference}</code> :`,
        parse_mode: "HTML",
        reply_markup: { force_reply: true, selective: true },
      });
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
        const inline_keyboard = countries.slice(0, 20).map(c => ([{
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
      const inline_keyboard = countries.slice(0, 20).map(c => ([{
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
    };

    const matched = Object.keys(cmdMap).find(k => text === k || text.startsWith(k + " ") || text.startsWith(k + "@"));
    if (matched) {
      const { type, period = "this_month" } = cmdMap[matched];

      if (type === "menu") { await sendMenu(chatId); return; }

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
            `──────────────────\n` +
            `<b>❓ Aide</b>\n` +
            `/aide — Afficher cette liste\n` +
            `/help — Afficher cette liste (alias)\n` +
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

export async function registerTelegramWebhook(webhookUrl: string): Promise<void> {
  if (!BOT_API) return;
  try {
    const res = await fetch(`${BOT_API}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, drop_pending_updates: false }),
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
  userId: number;
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
  userId: number;
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
  userId: number;
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
