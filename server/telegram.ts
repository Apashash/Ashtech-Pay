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

async function sendMessage(text: string): Promise<void> {
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

function fmt(amount: string | number, currency: string): string {
  return `${parseFloat(String(amount)).toLocaleString("fr-FR")} ${currency}`;
}

function now(): string {
  return new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" });
}

// ─── DÉPÔTS ───────────────────────────────────────────────────────────────────

export async function notifyNewDeposit(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  method: string;
  phone?: string;
  reference: string;
  provider?: string;
}): Promise<void> {
  const msg =
    `🟡 <b>NOUVEAU DÉPÔT EN ATTENTE</b>\n` +
    `─────────────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `💰 Montant : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    `📱 Méthode : ${opts.method}\n` +
    (opts.phone ? `📞 Téléphone : ${opts.phone}\n` : "") +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    `🔖 Référence : <code>${opts.reference}</code>\n` +
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
}): Promise<void> {
  const msg =
    `✅ <b>PAIEMENT REÇU / DÉPÔT CONFIRMÉ</b>\n` +
    `─────────────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `💰 Montant crédité : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    `🔖 Référence : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
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
}): Promise<void> {
  const msg =
    `❌ <b>ÉCHEC DE PAIEMENT (DÉPÔT)</b>\n` +
    `─────────────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `💰 Montant : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    (opts.reason ? `⚠️ Raison : ${opts.reason}\n` : "") +
    `🔖 Référence : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── RETRAITS ─────────────────────────────────────────────────────────────────

export async function notifyWithdrawalRequest(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  phone: string;
  operator?: string;
  reference: string;
  provider?: string;
}): Promise<void> {
  const msg =
    `🔵 <b>DEMANDE DE RETRAIT</b>\n` +
    `─────────────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `💰 Montant net : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    `📱 Numéro : ${opts.phone}\n` +
    (opts.operator ? `📡 Opérateur : ${opts.operator}\n` : "") +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    `🔖 Référence : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyWithdrawalPendingManual(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  phone: string;
  reference: string;
}): Promise<void> {
  const msg =
    `⏳ <b>RETRAIT EN ATTENTE (MANUEL)</b>\n` +
    `─────────────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `💰 Montant : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    `📱 Numéro : ${opts.phone}\n` +
    `🔖 Référence : <code>${opts.reference}</code>\n` +
    `⚠️ <b>Action requise dans le panel admin !</b>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

export async function notifyWithdrawalAutoValidated(opts: {
  userName: string;
  userEmail: string;
  amount: string | number;
  currency: string;
  reference: string;
  provider?: string;
}): Promise<void> {
  const msg =
    `✅ <b>RETRAIT VALIDÉ AUTOMATIQUEMENT</b>\n` +
    `─────────────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `💰 Montant : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    `🔖 Référence : <code>${opts.reference}</code>\n` +
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
}): Promise<void> {
  const msg =
    `✅ <b>RETRAIT VALIDÉ MANUELLEMENT</b>\n` +
    `─────────────────────────\n` +
    `🛡️ Admin : <b>${opts.adminName}</b>\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `💰 Montant : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    `🔖 Référence : <code>${opts.reference}</code>\n` +
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
}): Promise<void> {
  const msg =
    `❌ <b>ÉCHEC DE RETRAIT</b>\n` +
    `─────────────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `💰 Montant : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    (opts.provider ? `🔌 Passerelle : ${opts.provider}\n` : "") +
    (opts.reason ? `⚠️ Raison : ${opts.reason}\n` : "") +
    `🔖 Référence : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── SÉCURITÉ ─────────────────────────────────────────────────────────────────

export async function notifyLoginFailed(opts: {
  identifier: string;
  ip: string;
  attemptsLeft: number;
  blocked: boolean;
}): Promise<void> {
  if (opts.blocked) {
    const msg =
      `🔴 <b>COMPTE BLOQUÉ — TROP DE TENTATIVES</b>\n` +
      `─────────────────────────\n` +
      `🔑 Identifiant : <code>${opts.identifier}</code>\n` +
      `🌐 IP : <code>${opts.ip}</code>\n` +
      `🚫 Accès bloqué pendant 7 minutes\n` +
      `🕐 Heure : ${now()}`;
    await sendMessage(msg);
  } else if (opts.attemptsLeft <= 2) {
    const msg =
      `⚠️ <b>TENTATIVE DE CONNEXION ÉCHOUÉE</b>\n` +
      `─────────────────────────\n` +
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
    `─────────────────────────\n` +
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
    `─────────────────────────\n` +
    `🔑 Identifiant : <code>${opts.identifier}</code>\n` +
    `🌐 IP : <code>${opts.ip}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── TRANSFERTS ───────────────────────────────────────────────────────────────

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
    `─────────────────────────\n` +
    `👤 Expéditeur : <b>${opts.senderName}</b> (${opts.senderEmail})\n` +
    `👥 Destinataire : <b>${opts.recipientName}</b>\n` +
    `💰 Montant : <b>${fmt(opts.amount, opts.currency)}</b>\n` +
    `🔖 Référence : <code>${opts.reference}</code>\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── KYC COMPLET AVEC PHOTOS + BOUTONS ────────────────────────────────────────

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
    `─────────────────────────────\n` +
    `👤 <b>${opts.userName}</b>\n` +
    `📧 ${opts.userEmail}\n` +
    `🆔 ID : <code>#${opts.userId}</code>\n` +
    `─────────────────────────────\n` +
    `📄 Document : ${docTypeLabel[opts.documentType] ?? opts.documentType}\n` +
    `🔢 N° : <code>${opts.documentNumber}</code>\n` +
    (opts.country ? `🌍 Pays : ${opts.country}\n` : "") +
    (opts.city ? `🏙 Ville : ${opts.city}\n` : "") +
    `─────────────────────────────\n` +
    `🏷 Compte : ${businessTypeLabel[opts.businessType] ?? opts.businessType}\n` +
    `📂 Catégorie : ${opts.businessCategory}\n` +
    `📝 ${opts.businessDescription}\n` +
    `─────────────────────────────\n` +
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

// ─── GESTIONNAIRE DE WEBHOOK TELEGRAM ─────────────────────────────────────────

// ─── Types stats bot ──────────────────────────────────────────────────────────
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

// ─── Menu & formatters ────────────────────────────────────────────────────────

const MAIN_MENU_KEYBOARD = [
  [{ text: "📊 Dashboard ce mois", callback_data: "cmd:stats_month" }],
  [
    { text: "📅 Aujourd'hui", callback_data: "cmd:stats_today" },
    { text: "📆 Cette semaine", callback_data: "cmd:stats_week" },
  ],
  [
    { text: "⏳ En attente", callback_data: "cmd:pending" },
    { text: "🔑 KYC", callback_data: "cmd:kyc" },
  ],
  [
    { text: "👥 Derniers inscrits", callback_data: "cmd:users" },
    { text: "💰 Revenus", callback_data: "cmd:revenue" },
  ],
];

async function sendMenu(chatId: string): Promise<void> {
  await callBotApi("sendMessage", {
    chat_id: chatId,
    text:
      `🏦 <b>AshTech Pay — Panel Bot</b>\n` +
      `─────────────────────────────\n` +
      `Choisissez une action :`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: MAIN_MENU_KEYBOARD },
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
    `─────────────────────────────\n` +
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
    `─────────────────────────────\n` +
    `🕐 ${now()}`
  );
}

function formatRevenue(s: BotStats): string {
  return (
    `💰 <b>REVENUS — ${periodLabel(s.period).toUpperCase()}</b>\n` +
    `─────────────────────────────\n` +
    `💵 Total commissions : <b>${fmtXAF(s.totalRevenue)}</b>\n\n` +
    `📋 Détail par type :\n` +
    `  • Dépôts (${fmtNum(s.depositCount)}) : ${fmtXAF(s.depositFees)}\n` +
    `  • Retraits (${fmtNum(s.withdrawalCount)}) : ${fmtXAF(s.withdrawalFees)}\n` +
    `  • Transferts (${fmtNum(s.transferCount)}) : ${fmtXAF(s.transferFees)}\n` +
    `  • Liens (${fmtNum(s.paymentLinkCount)}) : ${fmtXAF(s.paymentLinkFees)}\n` +
    `─────────────────────────────\n` +
    `🕐 ${now()}`
  );
}

function formatPending(s: BotStats): string {
  const total = s.pendingDeposits + s.pendingWithdrawals + s.pendingTransfers + s.kycPending;
  return (
    `⏳ <b>ÉLÉMENTS EN ATTENTE</b>\n` +
    `─────────────────────────────\n` +
    `${total === 0 ? "✅ Aucun élément en attente !\n" : ""}` +
    (s.pendingDeposits > 0 ? `🟡 Dépôts : <b>${s.pendingDeposits}</b>\n` : "") +
    (s.pendingWithdrawals > 0 ? `🔵 Retraits : <b>${s.pendingWithdrawals}</b>\n` : "") +
    (s.pendingTransfers > 0 ? `🟣 Transferts : <b>${s.pendingTransfers}</b>\n` : "") +
    (s.kycPending > 0 ? `📋 Demandes KYC : <b>${s.kycPending}</b>\n` : "") +
    `─────────────────────────────\n` +
    `🕐 ${now()}`
  );
}

function formatKyc(s: BotStats): string {
  const total = s.kycApproved + s.kycPending + s.kycRejected;
  const pct = total > 0 ? Math.round((s.kycApproved / total) * 100) : 0;
  return (
    `🔑 <b>VÉRIFICATIONS KYC</b>\n` +
    `─────────────────────────────\n` +
    `📊 Total soumis : <b>${fmtNum(total)}</b>\n` +
    `✅ Approuvés : <b>${fmtNum(s.kycApproved)}</b> (${pct}%)\n` +
    `⏳ En attente : <b>${fmtNum(s.kycPending)}</b>\n` +
    `❌ Rejetés : <b>${fmtNum(s.kycRejected)}</b>\n\n` +
    `👥 Utilisateurs vérifiés / Total : ${fmtNum(s.kycApproved)} / ${fmtNum(s.totalUsers)}\n` +
    `─────────────────────────────\n` +
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
    `─────────────────────────────\n` +
    `Total : <b>${fmtNum(s.totalUsers)}</b> utilisateurs\n\n` +
    (lines.join("\n\n") || "Aucun utilisateur") +
    `\n─────────────────────────────\n🕐 ${now()}`
  );
}

// ─── GESTIONNAIRE DE WEBHOOK TELEGRAM ─────────────────────────────────────────

export async function handleTelegramUpdate(
  update: any,
  handlers: {
    approveKyc: (submissionId: string) => Promise<{ userName: string; userEmail: string } | null>;
    rejectKyc: (submissionId: string, reason: string) => Promise<{ userName: string; userEmail: string } | null>;
    getStats: (period: string) => Promise<BotStats>;
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

      if (cmd === "menu") {
        await sendMenu(chatId);
        return;
      }

      const periodMap: Record<string, string> = {
        stats_today: "today",
        stats_week: "this_week",
        stats_month: "this_month",
        revenue: "this_month",
      };

      if (cmd in periodMap || cmd === "pending" || cmd === "kyc" || cmd === "users") {
        const period = periodMap[cmd] ?? "this_month";
        const stats = await handlers.getStats(period);

        let text = "";
        if (cmd === "pending") text = formatPending(stats);
        else if (cmd === "kyc") text = formatKyc(stats);
        else if (cmd === "users") text = formatRecentUsers(stats);
        else if (cmd === "revenue") text = formatRevenue(stats);
        else text = formatDashboard(stats);

        await callBotApi("sendMessage", {
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Menu", callback_data: "cmd:menu" }]],
          },
        });
        return;
      }
    }

    // ── Approve KYC ──
    if (data.startsWith("ka:")) {
      const submissionId = data.slice(3);
      const result = await handlers.approveKyc(submissionId);
      if (result) {
        await editMessageText(messageId,
          `✅ <b>KYC APPROUVÉ</b>\n\n👤 ${result.userName}\n📧 ${result.userEmail}\n🕐 ${now()}`
        );
      } else {
        await editMessageText(messageId, `⚠️ Impossible d'approuver — soumission introuvable.`);
      }
      return;
    }

    // ── Reject with preset reason ──
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
          `❌ <b>KYC REJETÉ</b>\n\n👤 ${result.userName}\n📧 ${result.userEmail}\n⚠️ ${reason}\n🕐 ${now()}`
        );
      } else {
        await editMessageText(messageId, `⚠️ Impossible de rejeter — soumission introuvable.`);
      }
      return;
    }

    // ── Custom rejection — ask for reason ──
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
  }

  // ── Text message / commands ──
  if (update.message?.text) {
    const chatId = String(update.message.chat?.id ?? "");
    const text: string = update.message.text.trim();

    // ── Check pending custom rejection first ──
    const pending = pendingCustomRejections.get(chatId);
    if (pending && !text.startsWith("/")) {
      pendingCustomRejections.delete(chatId);
      const result = await handlers.rejectKyc(pending.submissionId, text);
      if (result) {
        await editMessageText(pending.messageId,
          `❌ <b>KYC REJETÉ</b>\n\n👤 ${result.userName}\n📧 ${result.userEmail}\n⚠️ ${text}\n🕐 ${now()}`
        );
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `✅ Rejet enregistré : <i>${text}</i>`,
          parse_mode: "HTML",
        });
      } else {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text: `⚠️ Soumission KYC introuvable ou déjà traitée.`,
          parse_mode: "HTML",
        });
      }
      return;
    }

    // ── Bot commands ──
    const cmdMap: Record<string, { period?: string; type: string }> = {
      "/start":  { type: "menu" },
      "/menu":   { type: "menu" },
      "/stats":  { type: "dash", period: "this_month" },
      "/today":  { type: "dash", period: "today" },
      "/week":   { type: "dash", period: "this_week" },
      "/mois":   { type: "dash", period: "this_month" },
      "/pending":{ type: "pending", period: "this_month" },
      "/kyc":    { type: "kyc", period: "this_month" },
      "/users":  { type: "users", period: "this_month" },
      "/revenue":{ type: "revenue", period: "this_month" },
      "/aide":   { type: "help" },
      "/help":   { type: "help" },
    };

    const matched = Object.keys(cmdMap).find(k => text === k || text.startsWith(k + " ") || text.startsWith(k + "@"));
    if (matched) {
      const { type, period = "this_month" } = cmdMap[matched];

      if (type === "menu") {
        await sendMenu(chatId);
        return;
      }

      if (type === "help") {
        await callBotApi("sendMessage", {
          chat_id: chatId,
          text:
            `📖 <b>Commandes disponibles</b>\n` +
            `─────────────────────────────\n` +
            `/menu — Afficher le menu\n` +
            `/stats — Dashboard ce mois\n` +
            `/today — Stats d'aujourd'hui\n` +
            `/week — Stats cette semaine\n` +
            `/pending — Éléments en attente\n` +
            `/kyc — Résumé des KYC\n` +
            `/users — Derniers inscrits\n` +
            `/revenue — Revenus & commissions\n` +
            `/aide — Afficher ce message`,
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

      await callBotApi("sendMessage", {
        chat_id: chatId,
        text: msgText,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "cmd:menu" }]] },
      });
    }
  }
}

// ─── ENREGISTREMENT DU WEBHOOK ────────────────────────────────────────────────

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

// ─── KYC (version texte seul — fallback) ──────────────────────────────────────

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
    `─────────────────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `🆔 ID compte : <code>#${opts.userId}</code>\n` +
    `─────────────────────────────\n` +
    `📄 Document : ${docTypeLabel[opts.documentType] ?? opts.documentType}\n` +
    `🔢 N° Document : <code>${opts.documentNumber}</code>\n` +
    (opts.country ? `🌍 Pays : ${opts.country}\n` : "") +
    (opts.city ? `🏙 Ville : ${opts.city}\n` : "") +
    `─────────────────────────────\n` +
    `🏷 Type de compte : ${businessTypeLabel[opts.businessType] ?? opts.businessType}\n` +
    `📂 Catégorie : ${opts.businessCategory}\n` +
    `📝 Description : ${opts.businessDescription}\n` +
    `─────────────────────────────\n` +
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
    `─────────────────────────────\n` +
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
    `─────────────────────────────\n` +
    `👤 Utilisateur : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.userEmail}\n` +
    `🆔 ID compte : <code>#${opts.userId}</code>\n` +
    `🛡️ Rejeté par : <b>${opts.adminName}</b>\n` +
    `⚠️ Raison : ${opts.reason}\n` +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}

// ─── INSCRIPTION ──────────────────────────────────────────────────────────────

export async function notifyNewUser(opts: {
  userName: string;
  email: string;
  country?: string;
}): Promise<void> {
  const msg =
    `🎉 <b>NOUVEL UTILISATEUR INSCRIT</b>\n` +
    `─────────────────────────\n` +
    `👤 Nom : <b>${opts.userName}</b>\n` +
    `📧 Email : ${opts.email}\n` +
    (opts.country ? `🌍 Pays : ${opts.country}\n` : "") +
    `🕐 Heure : ${now()}`;
  await sendMessage(msg);
}
