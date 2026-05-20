/**
 * Service de notifications Telegram — AshTech Pay
 * Envoie des alertes en temps réel pour toutes les transactions et événements de sécurité.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TELEGRAM_API = BOT_TOKEN
  ? `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
  : null;

function isConfigured(): boolean {
  return !!(BOT_TOKEN && CHAT_ID);
}

async function sendMessage(text: string): Promise<void> {
  if (!isConfigured() || !TELEGRAM_API) {
    return;
  }
  try {
    await fetch(TELEGRAM_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err: any) {
    console.warn("[Telegram] Erreur d'envoi:", err?.message);
  }
}

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

// ─── KYC ──────────────────────────────────────────────────────────────────────

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
