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

export async function handleTelegramUpdate(
  update: any,
  handlers: {
    approveKyc: (submissionId: string) => Promise<{ userName: string; userEmail: string } | null>;
    rejectKyc: (submissionId: string, reason: string) => Promise<{ userName: string; userEmail: string } | null>;
  }
): Promise<void> {
  // ── Callback query (button press) ──
  if (update.callback_query) {
    const cq = update.callback_query;
    const data: string = cq.data ?? "";
    const chatId = String(cq.message?.chat?.id ?? "");
    const messageId: number = cq.message?.message_id;

    await answerCallbackQuery(cq.id);

    // Approve
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

    // Reject with preset reason
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

    // Custom rejection — ask for reason
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

  // ── Text message (custom rejection reason reply) ──
  if (update.message?.text) {
    const chatId = String(update.message.chat?.id ?? "");
    const text: string = update.message.text;

    const pending = pendingCustomRejections.get(chatId);
    if (pending) {
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
