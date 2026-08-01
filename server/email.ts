import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn("[Email] RESEND_API_KEY is not set. Email sending will be disabled.");
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL    = "Ashtech Pay <noreply@ashtechpay.top>";
const APP_URL       = "https://ashtechpay.top";
const LOGO_URL      = "https://ashtechpay.top/logo.png";
const WA_LOGO_URL   = "https://ashtechpay.top/wa-logo.svg";
const FB_LOGO_URL   = "https://ashtechpay.top/fb-logo.svg";
const FACEBOOK_URL  = "https://www.facebook.com/share/1Eczpeowdp/?mibextid=wwXIfr";
const WHATSAPP_URL  = "https://whatsapp.com/channel/0029VbC5tPPCxoAveJ44Vs2w";
const SUPPORT_PHONE = "+237 6 83 67 78 72";

// ─── HTML ESCAPE — protège contre les injections XSS dans les templates ───────
function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const NAVY   = "#1E3A8A";
const TEXT   = "#111827";
const MUTED  = "#6B7280";
const BORDER = "#E5E7EB";
const BOX_BG = "#F3F4F6";

// ─── BASE LAYOUT ──────────────────────────────────────────────────────────────

function emailBase(title: string, bodyRows: string): string {
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${title} — Ashtech Pay</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F7FA;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F7FA;">
    <tr>
      <td align="center" style="padding:32px 16px 40px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:8px;border:1px solid ${BORDER};overflow:hidden;">

          <!-- TOP LOGO BAR -->
          <tr>
            <td style="padding:28px 40px 24px;border-bottom:1px solid ${BORDER};">
              <img src="${LOGO_URL}" alt="Ashtech Pay" height="40"
                   style="display:block;max-height:40px;width:auto;" />
            </td>
          </tr>

          ${bodyRows}

          <!-- FOOTER -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid ${BORDER};">
              <p style="margin:0 0 4px;font-size:13px;color:${TEXT};line-height:1.6;">Cordialement,</p>
              <p style="margin:0;font-size:13px;font-weight:700;color:${TEXT};">L'équipe Ashtech Pay</p>
            </td>
          </tr>

          <!-- NAVY BOTTOM BAR -->
          <tr>
            <td style="background:${NAVY};padding:16px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right:10px;">
                          <a href="${APP_URL}" style="font-size:11px;color:#93C5FD;text-decoration:none;">ashtechpay.top</a>
                        </td>
                        <td style="padding-right:10px;">
                          <a href="${WHATSAPP_URL}"
                             style="display:inline-block;background:#25D366;color:#FFFFFF;font-size:11px;font-weight:700;padding:6px 14px;border-radius:4px;text-decoration:none;vertical-align:middle;">
                            <img src="${WA_LOGO_URL}" width="14" height="14"
                                 style="display:inline;vertical-align:middle;margin-right:5px;border-radius:2px;" alt="WhatsApp"/>WhatsApp
                          </a>
                        </td>
                        <td>
                          <a href="${FACEBOOK_URL}"
                             style="display:inline-block;background:#1877F2;color:#FFFFFF;font-size:11px;font-weight:700;padding:6px 14px;border-radius:4px;text-decoration:none;vertical-align:middle;">
                            <img src="${FB_LOGO_URL}" width="14" height="14"
                                 style="display:inline;vertical-align:middle;margin-right:5px;border-radius:2px;" alt="Facebook"/>Facebook
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="font-size:11px;color:#93C5FD;">&copy; 2026 Ashtech Pay</td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function infoBox(rows: { label: string; value: string }[]): string {
  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:10px 20px;border-bottom:1px solid ${BORDER};font-size:14px;color:${TEXT};">
        <strong style="color:${TEXT};">${r.label}</strong>
      </td>
      <td style="padding:10px 20px;border-bottom:1px solid ${BORDER};font-size:14px;color:${TEXT};">${r.value}</td>
    </tr>`).join("");
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${BOX_BG};border-radius:6px;margin:24px 0;overflow:hidden;">
    ${rowsHtml}
  </table>`;
}

function ctaButton(text: string, href: string, color = NAVY): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr>
      <td>
        <a href="${href}"
           style="display:inline-block;background:${color};color:#FFFFFF;font-size:15px;font-weight:700;padding:14px 32px;border-radius:6px;text-decoration:none;letter-spacing:0.2px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

function supportNote(): string {
  return `
  <p style="margin:24px 0 0;font-size:13px;color:${MUTED};line-height:1.6;">
    Des questions ? Contactez notre support au
    <a href="tel:${SUPPORT_PHONE.replace(/\s/g, "")}" style="color:${NAVY};text-decoration:none;">${SUPPORT_PHONE}</a>
    ou via <a href="${WHATSAPP_URL}" style="color:${NAVY};text-decoration:none;">WhatsApp</a>.
  </p>`;
}

async function sendEmail(to: string, subject: string, html: string, label: string) {
  if (!resend) {
    console.warn(`[Email] Skipping ${label} — RESEND_API_KEY not configured.`);
    return;
  }
  try {
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to: [to], subject, html });
    if (error) console.error(`[Email] ${label} error:`, JSON.stringify(error));
    else console.log(`[Email] ${label} sent:`, data?.id, "→", to);
  } catch (err: any) {
    console.error(`[Email] Failed to send ${label}:`, err.message);
  }
}

// ─── PASSWORD RESET ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, fullName: string, resetToken: string): Promise<void> {
  const firstName = escapeHtml(fullName?.trim().split(" ")[0] || "cher(e) client(e)");
  const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;

  const body = `
  <!-- MAIN BODY -->
  <tr>
    <td style="padding:36px 40px 8px;">
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:700;color:${TEXT};line-height:1.3;">
        Réinitialisation de<br/>votre mot de passe.
      </h1>
      <p style="margin:0 0 6px;font-size:15px;color:${TEXT};line-height:1.7;">Bonjour ${firstName},</p>
      <p style="margin:0 0 20px;font-size:15px;color:${TEXT};line-height:1.7;">
        Vous avez demandé à réinitialiser le mot de passe de votre compte Ashtech Pay.
        Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe sécurisé.
      </p>

      ${ctaButton("Réinitialiser mon mot de passe", resetLink)}

      <p style="margin:0 0 8px;font-size:13px;color:${MUTED};line-height:1.6;">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
      </p>
      <p style="margin:0 0 20px;font-size:12px;color:${NAVY};word-break:break-all;line-height:1.5;">${resetLink}</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${BOX_BG};border-radius:6px;margin:8px 0 24px;">
        <tr>
          <td style="padding:16px 20px;font-size:13px;color:${MUTED};line-height:1.6;">
            Ce lien expire dans <strong style="color:${TEXT};">1 heure</strong>.
            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre compte reste sécurisé.
          </td>
        </tr>
      </table>

      ${supportNote()}
    </td>
  </tr>`;

  const html = emailBase("Réinitialisation de mot de passe", body);
  await sendEmail(to, "Réinitialisation de votre mot de passe — Ashtech Pay", html, "password reset");
}

// ─── WELCOME ──────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, fullName: string): Promise<void> {
  const firstName = escapeHtml(fullName?.trim().split(" ")[0] || "cher(e) client(e)");

  const body = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:700;color:${TEXT};line-height:1.3;">
        Bienvenue sur votre nouveau compte.
      </h1>
      <p style="margin:0 0 6px;font-size:15px;color:${TEXT};line-height:1.7;">Bonjour ${firstName},</p>
      <p style="margin:0 0 8px;font-size:15px;color:${TEXT};line-height:1.7;">
        Votre compte Ashtech Pay a été créé avec succès. Veuillez vérifier vos informations ci-dessous :
      </p>

      ${infoBox([
        { label: "Nom d'utilisateur", value: firstName },
        { label: "Date", value: new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" }) },
      ])}

      <p style="margin:0 0 8px;font-size:15px;color:${TEXT};line-height:1.7;">
        Vous pouvez maintenant accéder à votre tableau de bord.
      </p>

      ${ctaButton("Accéder à mon compte", `${APP_URL}/dashboard`)}

      <p style="margin:0 0 20px;font-size:13px;color:${MUTED};line-height:1.6;">
        Pour commencer à encaisser des paiements Mobile Money dans 22+ pays africains,
        complétez votre vérification d'identité (KYC) depuis votre tableau de bord.
      </p>

      ${supportNote()}
    </td>
  </tr>`;

  const html = emailBase("Bienvenue", body);
  await sendEmail(to, "Bienvenue sur Ashtech Pay — Votre compte est activé", html, "welcome");
}

// ─── KYC APPROVED ─────────────────────────────────────────────────────────────

export async function sendKycApprovedEmail(to: string, fullName: string): Promise<void> {
  const firstName = escapeHtml(fullName?.trim().split(" ")[0] || "cher(e) client(e)");

  const body = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:700;color:${TEXT};line-height:1.3;">
        Identité vérifiée avec succès.
      </h1>
      <p style="margin:0 0 6px;font-size:15px;color:${TEXT};line-height:1.7;">Bonjour ${firstName},</p>
      <p style="margin:0 0 8px;font-size:15px;color:${TEXT};line-height:1.7;">
        Votre vérification KYC a été approuvée. Votre compte est maintenant entièrement actif
        et vous pouvez commencer à encaisser des paiements Mobile Money.
      </p>

      ${infoBox([
        { label: "Statut KYC", value: "Approuvé" },
        { label: "Date d'approbation", value: new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" }) },
        { label: "Accès", value: "Paiements, retraits et liens activés" },
      ])}

      ${ctaButton("Commencer à collecter", `${APP_URL}/dashboard`)}

      ${supportNote()}
    </td>
  </tr>`;

  const html = emailBase("KYC approuvé", body);
  await sendEmail(to, "KYC approuvé — Vous pouvez maintenant encaisser sur Ashtech Pay", html, "KYC approved");
}

// ─── WITHDRAWAL APPROVED ──────────────────────────────────────────────────────

export async function sendWithdrawalApprovedEmail(
  to: string,
  fullName: string,
  amount: string,
  currency: string,
  reference?: string,
  operator?: string
): Promise<void> {
  const firstName = escapeHtml(fullName?.trim().split(" ")[0] || "cher(e) client(e)");

  const refRow = reference ? [{ label: "Référence", value: escapeHtml(reference) }] : [];
  const operatorRow = operator ? [{ label: "Opérateur Mobile Money", value: escapeHtml(operator) }] : [];

  const body = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:700;color:${TEXT};line-height:1.3;">
        Votre retrait a été effectué.
      </h1>
      <p style="margin:0 0 6px;font-size:15px;color:${TEXT};line-height:1.7;">Bonjour ${firstName},</p>
      <p style="margin:0 0 8px;font-size:15px;color:${TEXT};line-height:1.7;">
        Votre retrait a été traité avec succès. Le virement a été envoyé
        directement sur votre compte${operator ? ` <strong style="color:${TEXT};">${escapeHtml(operator)}</strong>` : " Mobile Money"}.
      </p>

      ${infoBox([
        { label: "Montant envoyé", value: `${amount} ${currency}` },
        ...operatorRow,
        { label: "Statut", value: "Virement effectué" },
        { label: "Date", value: new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" }) },
        ...refRow,
      ])}

      ${ctaButton("Voir mes transactions", `${APP_URL}/dashboard/transactions`)}

      ${supportNote()}
    </td>
  </tr>`;

  const html = emailBase("Retrait effectué", body);
  await sendEmail(to, "Retrait effectué — Virement envoyé sur Ashtech Pay", html, "withdrawal approved");
}

// ─── WITHDRAWAL NUMBER APPROVED ───────────────────────────────────────────────

export async function sendWithdrawalNumberApprovedEmail(
  to: string,
  fullName: string,
  phoneNumber: string,
  operator?: string
): Promise<void> {
  const firstName = escapeHtml(fullName?.trim().split(" ")[0] || "cher(e) client(e)");

  const operatorRow = operator ? [{ label: "Opérateur", value: escapeHtml(operator) }] : [];

  const body = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:700;color:${TEXT};line-height:1.3;">
        Numéro de retrait approuvé.
      </h1>
      <p style="margin:0 0 6px;font-size:15px;color:${TEXT};line-height:1.7;">Bonjour ${firstName},</p>
      <p style="margin:0 0 8px;font-size:15px;color:${TEXT};line-height:1.7;">
        Votre numéro de retrait a été vérifié et approuvé par notre équipe.
        Vous pouvez maintenant effectuer des retraits vers ce numéro.
      </p>

      ${infoBox([
        { label: "Numéro approuvé", value: escapeHtml(phoneNumber) },
        ...operatorRow,
        { label: "Statut", value: "Approuvé" },
        { label: "Date", value: new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" }) },
      ])}

      ${ctaButton("Effectuer un retrait", `${APP_URL}/dashboard/withdraw`)}

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${BOX_BG};border-radius:6px;margin:8px 0 24px;">
        <tr>
          <td style="padding:16px 20px;font-size:13px;color:${MUTED};line-height:1.6;">
            Si vous n'avez pas demandé cette modification, contactez immédiatement notre support
            au <strong style="color:${TEXT};">${SUPPORT_PHONE}</strong>.
          </td>
        </tr>
      </table>

      ${supportNote()}
    </td>
  </tr>`;

  const html = emailBase("Numéro de retrait approuvé", body);
  await sendEmail(to, "Numéro de retrait approuvé — Ashtech Pay", html, "withdrawal number approved");
}

// ─── ACCOUNT DELETED ──────────────────────────────────────────────────────────

export async function sendAccountDeletedEmail(to: string, fullName: string): Promise<void> {
  const firstName = escapeHtml(fullName?.trim().split(" ")[0] || "cher(e) client(e)");

  const body = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:700;color:${TEXT};line-height:1.3;">
        Votre compte a été supprimé.
      </h1>
      <p style="margin:0 0 6px;font-size:15px;color:${TEXT};line-height:1.7;">Bonjour ${firstName},</p>
      <p style="margin:0 0 8px;font-size:15px;color:${TEXT};line-height:1.7;">
        Nous confirmons que votre compte Ashtech Pay a été définitivement supprimé
        conformément à votre demande. Toutes vos données personnelles ont été effacées de nos serveurs.
      </p>

      ${infoBox([
        { label: "Compte", value: "Supprimé définitivement" },
        { label: "Données effacées", value: "Profil, transactions, liens de paiement" },
        { label: "Date", value: new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" }) },
      ])}

      <p style="margin:0 0 20px;font-size:15px;color:${TEXT};line-height:1.7;">
        Vous pouvez créer un nouveau compte à tout moment sur
        <a href="${APP_URL}" style="color:${NAVY};text-decoration:none;">ashtechpay.top</a>.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${BOX_BG};border-radius:6px;margin:8px 0 24px;">
        <tr>
          <td style="padding:16px 20px;font-size:13px;color:${MUTED};line-height:1.6;">
            Si vous n'avez pas demandé cette suppression, contactez immédiatement notre support
            au <strong style="color:${TEXT};">${SUPPORT_PHONE}</strong>.
          </td>
        </tr>
      </table>

      ${supportNote()}
    </td>
  </tr>`;

  const html = emailBase("Compte supprimé", body);
  await sendEmail(to, "Confirmation de suppression de compte — Ashtech Pay", html, "account deleted");
}

// ─── PAYER PAYMENT CONFIRMATION ──────────────────────────────────────────────

export async function sendPayerConfirmationEmail(
  to: string,
  payerName: string,
  linkTitle: string,
  amount: string,
  currency: string,
  reference: string,
  pdfUrl?: string | null,
): Promise<void> {
  const firstName = escapeHtml(payerName?.trim().split(" ")[0] || "cher(e) client(e)");

  const pdfBlock = pdfUrl ? `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${BOX_BG};border-radius:6px;margin:16px 0 24px;">
    <tr>
      <td style="padding:20px 24px;">
        <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${TEXT};">Document disponible</p>
        <p style="margin:0 0 14px;font-size:13px;color:${MUTED};">Cliquez ci-dessous pour accéder à votre fichier.</p>
        <a href="${pdfUrl}" target="_blank"
           style="display:inline-block;background:${NAVY};color:#FFFFFF;font-size:13px;font-weight:700;padding:10px 24px;border-radius:6px;text-decoration:none;">
          Accéder au document
        </a>
        <p style="margin:12px 0 0;font-size:11px;color:${MUTED};word-break:break-all;">${pdfUrl}</p>
      </td>
    </tr>
  </table>` : "";

  const body = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:700;color:${TEXT};line-height:1.3;">
        Paiement confirmé.
      </h1>
      <p style="margin:0 0 6px;font-size:15px;color:${TEXT};line-height:1.7;">Bonjour ${firstName},</p>
      <p style="margin:0 0 8px;font-size:15px;color:${TEXT};line-height:1.7;">
        Votre paiement pour <strong style="color:${TEXT};">${escapeHtml(linkTitle)}</strong> a été reçu et confirmé avec succès.
        Voici votre reçu de paiement :
      </p>

      ${infoBox([
        { label: "Service", value: escapeHtml(linkTitle) },
        { label: "Montant payé", value: `${escapeHtml(amount)} ${escapeHtml(currency)}` },
        { label: "Référence", value: escapeHtml(reference) },
        { label: "Date", value: new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" }) },
        { label: "Statut", value: "Confirmé" },
      ])}

      ${pdfBlock}

      ${supportNote()}
    </td>
  </tr>`;

  const html = emailBase("Paiement confirmé", body);
  await sendEmail(to, `Paiement confirmé — ${linkTitle}`, html, "payer confirmation");
}

// ─── CAMPAIGN EMAIL (Admin broadcast) ─────────────────────────────────────────

export interface CampaignEmailOptions {
  to: string;
  firstName: string;
  subject: string;
  body: string;
  hasButton?: boolean;
  buttonText?: string;
  buttonUrl?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  preheader?: string;
  headline?: string;
  bodyHtml?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export async function sendCampaignEmail(opts: CampaignEmailOptions): Promise<void> {
  const {
    to, firstName, subject, body,
    hasButton, buttonText, buttonUrl,
    buttonColor = NAVY,
  } = opts;

  const safeFirstName = escapeHtml(firstName);
  const bodyHtml = body
    .replace(/\{prenom\}/gi, safeFirstName)
    .split("\n\n")
    .map(p => `<p style="margin:0 0 16px;font-size:15px;color:${TEXT};line-height:1.75;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const buttonHtml = hasButton && buttonText && buttonUrl
    ? ctaButton(buttonText, buttonUrl, buttonColor)
    : "";

  const bodyRows = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <p style="margin:0 0 6px;font-size:15px;color:${TEXT};line-height:1.7;">Bonjour ${safeFirstName},</p>
      ${bodyHtml}
      ${buttonHtml}
      ${supportNote()}
    </td>
  </tr>`;

  const html = emailBase(subject, bodyRows);
  await sendEmail(to, subject, html, "campaign");
}

// ─── PASSWORD CHANGE OTP ──────────────────────────────────────────────────────
export async function sendPasswordChangeOtpEmail(to: string, fullName: string, code: string): Promise<void> {
  const firstName = escapeHtml(fullName?.trim().split(" ")[0] || "cher(e) client(e)");

  const bodyRows = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <h1 style="margin:0 0 20px;font-size:28px;font-weight:700;color:${TEXT};line-height:1.3;">
        Confirmation de changement<br/>de mot de passe.
      </h1>
      <p style="margin:0 0 6px;font-size:15px;color:${TEXT};line-height:1.7;">Bonjour ${firstName},</p>
      <p style="margin:0 0 24px;font-size:15px;color:${TEXT};line-height:1.7;">
        Vous avez demandé à changer votre mot de passe. Entrez le code ci-dessous pour confirmer cette action.
        Ce code est valable <strong style="color:${TEXT};">10 minutes</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
          <td align="center">
            <div style="display:inline-block;background:#1E3A8A;color:#FFFFFF;font-size:48px;font-weight:900;letter-spacing:20px;padding:20px 40px;border-radius:10px;font-family:monospace;">
              ${code}
            </div>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${BOX_BG};border-radius:6px;margin:8px 0 24px;">
        <tr>
          <td style="padding:16px 20px;font-size:13px;color:${MUTED};line-height:1.6;">
            Si vous n'avez pas demandé ce changement, ignorez cet email. Votre mot de passe ne sera pas modifié.
          </td>
        </tr>
      </table>
      ${supportNote()}
    </td>
  </tr>`;

  const html = emailBase("Confirmation de changement de mot de passe", bodyRows);
  await sendEmail(to, "Code de confirmation — Changement de mot de passe Ashtech Pay", html, "password-change-otp");
}

// ─── Withdrawal OTP ───────────────────────────────────────────────────────────
export async function sendWithdrawalOtpEmail(
  to: string,
  userName: string,
  code: string,
  details: {
    method?: string;
    country?: string;
    operator?: string;
    phone?: string;
    amount: string;
    fee: string;
    net: string;
    currency: string;
  }
): Promise<void> {
  const safeName = escapeHtml(userName);
  const fields: [string, string][] = [
    ...(details.method ? [["Méthode", escapeHtml(details.method)] as [string, string]] : []),
    ...(details.country ? [["Pays", escapeHtml(details.country)] as [string, string]] : []),
    ...(details.operator ? [["Opérateur", escapeHtml(details.operator)] as [string, string]] : []),
    ...(details.phone ? [["Numéro", escapeHtml(details.phone)] as [string, string]] : []),
    ["Montant demandé", `${escapeHtml(details.amount)} ${escapeHtml(details.currency)}`],
    ["Frais", `<span style="color:#DC2626;">${escapeHtml(details.fee)} ${escapeHtml(details.currency)}</span>`],
    ["Net à recevoir", `<strong style="color:#16A34A;">${escapeHtml(details.net)} ${escapeHtml(details.currency)}</strong>`],
  ];
  const rows = fields.map(([label, value]) => `
    <tr>
      <td style="padding:10px 20px;font-size:13px;color:${MUTED};border-bottom:1px solid ${BORDER};">${label}</td>
      <td style="padding:10px 20px;font-size:13px;color:${TEXT};font-weight:600;text-align:right;border-bottom:1px solid ${BORDER};">${value}</td>
    </tr>`).join("");

  const bodyRows = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <p style="margin:0 0 16px;font-size:15px;color:${TEXT};line-height:1.7;">
        Bonjour <strong>${safeName}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:${TEXT};line-height:1.7;">
        Vous avez initié une <strong>demande de retrait</strong>. Voici les détails :
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${BOX_BG};border-radius:6px;border:1px solid ${BORDER};margin:0 0 24px;overflow:hidden;">
        ${rows}
      </table>
      <p style="margin:0 0 12px;font-size:15px;color:${TEXT};line-height:1.7;">
        Entrez ce code pour confirmer votre retrait :
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
          <td align="center">
            <div style="display:inline-block;background:#1E3A8A;color:#FFFFFF;font-size:40px;font-weight:900;letter-spacing:16px;padding:20px 36px;border-radius:10px;font-family:monospace;">
              ${escapeHtml(code)}
            </div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;color:${MUTED};line-height:1.6;">⏱ Ce code expire dans <strong>10 minutes</strong>.</p>
      <p style="margin:0 0 24px;font-size:13px;color:${MUTED};line-height:1.6;">
        Si vous n'êtes pas à l'origine de cette demande, contactez notre support immédiatement.
      </p>
      ${supportNote()}
    </td>
  </tr>`;
  const html = emailBase("Code de confirmation de retrait", bodyRows);
  await sendEmail(to, "🔐 Confirmez votre retrait — Ashtech Pay", html, "withdrawal-otp");
}

// ─── Transfer OTP ─────────────────────────────────────────────────────────────
export async function sendTransferOtpEmail(
  to: string,
  userName: string,
  code: string,
  details: {
    type: "external" | "internal";
    recipient?: string;
    phone?: string;
    countryOperator?: string;
    feeBearer?: string;
    amount: string;
    fee: string;
    net: string;
    currency: string;
  }
): Promise<void> {
  const safeName = escapeHtml(userName);
  const isInternal = details.type === "internal";
  const label = isInternal ? "transfert interne" : "envoi d'argent";
  const fields: [string, string][] = [
    ...(details.recipient ? [["Destinataire", escapeHtml(details.recipient)] as [string, string]] : []),
    ...(details.phone ? [["Numéro", escapeHtml(details.phone)] as [string, string]] : []),
    ...(details.countryOperator ? [["Pays / Opérateur", escapeHtml(details.countryOperator)] as [string, string]] : []),
    ...(details.feeBearer ? [["Frais payés par", escapeHtml(details.feeBearer)] as [string, string]] : []),
    ["Montant envoyé", `${escapeHtml(details.amount)} ${escapeHtml(details.currency)}`],
    ["Frais", `<span style="color:#DC2626;">${escapeHtml(details.fee)} ${escapeHtml(details.currency)}</span>`],
    ["Net reçu", `<strong style="color:#16A34A;">${escapeHtml(details.net)} ${escapeHtml(details.currency)}</strong>`],
  ];
  const rows = fields.map(([lbl, val]) => `
    <tr>
      <td style="padding:10px 20px;font-size:13px;color:${MUTED};border-bottom:1px solid ${BORDER};">${lbl}</td>
      <td style="padding:10px 20px;font-size:13px;color:${TEXT};font-weight:600;text-align:right;border-bottom:1px solid ${BORDER};">${val}</td>
    </tr>`).join("");

  const bodyRows = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <p style="margin:0 0 16px;font-size:15px;color:${TEXT};line-height:1.7;">
        Bonjour <strong>${safeName}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:${TEXT};line-height:1.7;">
        Vous avez initié un <strong>${label}</strong>. Voici les détails :
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${BOX_BG};border-radius:6px;border:1px solid ${BORDER};margin:0 0 24px;overflow:hidden;">
        ${rows}
      </table>
      <p style="margin:0 0 12px;font-size:15px;color:${TEXT};line-height:1.7;">
        Entrez ce code pour confirmer votre ${label} :
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
          <td align="center">
            <div style="display:inline-block;background:#1E3A8A;color:#FFFFFF;font-size:40px;font-weight:900;letter-spacing:16px;padding:20px 36px;border-radius:10px;font-family:monospace;">
              ${escapeHtml(code)}
            </div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;color:${MUTED};line-height:1.6;">⏱ Ce code expire dans <strong>10 minutes</strong>.</p>
      <p style="margin:0 0 24px;font-size:13px;color:${MUTED};line-height:1.6;">
        Si vous n'êtes pas à l'origine de cette demande, contactez notre support immédiatement.
      </p>
      ${supportNote()}
    </td>
  </tr>`;
  const html = emailBase(`Code de confirmation de ${isInternal ? "transfert" : "envoi"}`, bodyRows);
  await sendEmail(to, `🔐 Confirmez votre ${isInternal ? "transfert" : "envoi"} — Ashtech Pay`, html, "transfer-otp");
}

// ─── Admin OTP ────────────────────────────────────────────────────────────────
export async function sendAdminOtpEmail(to: string, adminName: string, code: string): Promise<void> {
  const safeAdminName = escapeHtml(adminName);
  const bodyRows = `
  <tr>
    <td style="padding:36px 40px 8px;">
      <p style="margin:0 0 16px;font-size:15px;color:${TEXT};line-height:1.7;">
        Bonjour <strong>${safeAdminName}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:${TEXT};line-height:1.7;">
        Une tentative de connexion au <strong>panel administrateur</strong> a été détectée.
        Utilisez le code ci-dessous pour confirmer votre accès :
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
          <td align="center">
            <div style="display:inline-block;background:#1E3A8A;color:#FFFFFF;font-size:40px;font-weight:900;letter-spacing:16px;padding:20px 36px;border-radius:10px;font-family:monospace;">
              ${code}
            </div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;color:${MUTED};line-height:1.6;">
        ⏱ Ce code expire dans <strong>5 minutes</strong>.
      </p>
      <p style="margin:0 0 24px;font-size:13px;color:${MUTED};line-height:1.6;">
        Si vous n'êtes pas à l'origine de cette tentative, veuillez sécuriser votre compte immédiatement.
      </p>
      ${supportNote()}
    </td>
  </tr>`;
  const html = emailBase("Code d'accès Admin", bodyRows);
  await sendEmail(to, "🔐 Code d'accès Panel Admin — Ashtech Pay", html, "admin-otp");
}
