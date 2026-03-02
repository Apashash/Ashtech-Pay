import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL   = "Ashtech Pay <noreply@ashtechpay.top>";
const APP_URL      = "https://ashtechpay.top";
const LOGO_URL     = "https://ashtechpay.top/logo.png";
const FACEBOOK_URL = "https://www.facebook.com/share/1Eczpeowdp/?mibextid=wwXIfr";
const WHATSAPP_URL = "https://whatsapp.com/channel/0029VbC5tPPCxoAveJ44Vs2w";
const SUPPORT_PHONE = "+237 6 83 67 78 72";

export async function sendPasswordResetEmail(to: string, fullName: string, resetToken: string): Promise<void> {
  const firstName = (fullName?.trim().split(" ")[0]) || "cher(e) client(e)";
  const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;

  const html = `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Réinitialisation de mot de passe — Ashtech Pay</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0E11;font-family:Arial,Helvetica,sans-serif;color:#FFFFFF;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B0E11;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#13161D;border-radius:20px;border:1px solid rgba(240,185,11,0.2);overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0D1017 0%,#1A1F2C 100%);padding:36px 40px 28px;text-align:center;border-bottom:1px solid rgba(240,185,11,0.15);">
              <div style="margin-bottom:22px;">
                <table cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td style="background:#000000;border-radius:14px;padding:10px 20px;">
                      <img src="${LOGO_URL}" alt="Ashtech Pay" width="140" height="auto"
                           style="display:block;max-height:45px;width:auto;" />
                    </td>
                  </tr>
                </table>
              </div>
              <div style="display:inline-block;background:rgba(255,80,80,0.12);border:1px solid rgba(255,80,80,0.3);color:#FF6B6B;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:5px 16px;border-radius:100px;margin-bottom:18px;">
                🔐 &nbsp;Sécurité du compte
              </div>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.3;">
                Réinitialisation de<br/>mot de passe
              </h1>
              <p style="margin:12px 0 0;font-size:14px;color:#9BA3AF;line-height:1.6;">
                Bonjour <strong style="color:#F0B90B;">${firstName}</strong>, une demande a été faite pour ce compte.
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 40px;">

              <!-- Alert box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,193,7,0.05);border:1px solid rgba(255,193,7,0.2);border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:22px;padding-right:14px;vertical-align:top;">⚠️</td>
                        <td style="font-size:13px;color:#D1D5DB;line-height:1.7;vertical-align:top;">
                          Si <strong style="color:#FFFFFF;">tu n'as pas</strong> demandé à réinitialiser ton mot de passe,
                          ignore cet email. Ton compte reste sécurisé.<br/>
                          <span style="font-size:12px;color:#6B7280;">Ce lien expire dans <strong style="color:#F0B90B;">1 heure</strong>.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;color:#CBD5E1;line-height:1.75;">
                Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe sécurisé pour ton compte Ashtech Pay.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}"
                       style="display:inline-block;background:linear-gradient(135deg,#F0B90B 0%,#D4940A 100%);color:#000000;font-size:15px;font-weight:700;padding:15px 40px;border-radius:12px;text-decoration:none;letter-spacing:0.3px;">
                      🔑 &nbsp;Réinitialiser mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:12px;color:#6B7280;">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :</p>
                    <p style="margin:0;font-size:11px;color:#F0B90B;word-break:break-all;line-height:1.5;">${resetLink}</p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr><td style="border-top:1px solid rgba(255,255,255,0.07);font-size:0;">&nbsp;</td></tr>
              </table>

              <!-- Security tips -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(240,185,11,0.04);border:1px solid rgba(240,185,11,0.12);border-radius:14px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#F0B90B;letter-spacing:2px;text-transform:uppercase;">
                      🛡️ &nbsp;Conseils de sécurité
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding:5px 0;font-size:12px;color:#9BA3AF;line-height:1.6;">
                          ✅ &nbsp;Utilise un mot de passe unique d'au moins <strong style="color:#FFFFFF;">8 caractères</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:12px;color:#9BA3AF;line-height:1.6;">
                          ✅ &nbsp;Mélange <strong style="color:#FFFFFF;">majuscules, chiffres et symboles</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:12px;color:#9BA3AF;line-height:1.6;">
                          ✅ &nbsp;Ne réutilise pas un ancien mot de passe
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:12px;color:#9BA3AF;line-height:1.6;">
                          🚫 &nbsp;Ashtech Pay ne te demandera <strong style="color:#FF6B6B;">jamais</strong> ton mot de passe par téléphone ou email
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Support -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 12px;font-size:12px;color:#6B7280;">Un problème ? Notre équipe est là :</p>
                    <table cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td style="padding:0 6px;">
                          <a href="https://wa.me/${SUPPORT_PHONE.replace(/[\s+]/g, "")}"
                             style="display:inline-block;background:#25D366;color:#FFFFFF;font-size:12px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none;">
                            💬 WhatsApp
                          </a>
                        </td>
                        <td style="padding:0 6px;">
                          <a href="${FACEBOOK_URL}"
                             style="display:inline-block;background:#1877F2;color:#FFFFFF;font-size:12px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none;">
                            📘 Facebook
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 40px 26px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:#4B5563;line-height:1.7;">
                Tu reçois cet email car une réinitialisation a été demandée sur
                <a href="${APP_URL}" style="color:#F0B90B;text-decoration:none;">ashtechpay.top</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#374151;">&copy; 2026 Ashtech Pay &mdash; Tous droits réservés</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: "🔐 Réinitialisation de votre mot de passe Ashtech Pay",
      html,
    });
    if (error) {
      console.error("[Email] Resend reset error:", JSON.stringify(error));
    } else {
      console.log("[Email] Reset email sent:", data?.id, "→", to);
    }
  } catch (err: any) {
    console.error("[Email] Failed to send reset email:", err.message);
  }
}

export async function sendWelcomeEmail(to: string, fullName: string): Promise<void> {
  const firstName = (fullName?.trim().split(" ")[0]) || "cher(e) client(e)";

  const html = `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Bienvenue chez Ashtech Pay</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0E11;font-family:Arial,Helvetica,sans-serif;color:#FFFFFF;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B0E11;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- MAIN CARD -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#13161D;border-radius:20px;border:1px solid rgba(240,185,11,0.2);overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0D1017 0%,#1A1F2C 100%);padding:36px 40px 28px;text-align:center;border-bottom:1px solid rgba(240,185,11,0.15);">
              <!-- Logo -->
              <div style="margin-bottom:24px;">
                <table cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td style="background:#000000;border-radius:14px;padding:10px 20px;display:inline-block;">
                      <img src="${LOGO_URL}" alt="Ashtech Pay" width="140" height="auto"
                           style="display:block;max-height:45px;width:auto;"
                           onerror="this.style.display='none'" />
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Badge -->
              <div style="display:inline-block;background:rgba(240,185,11,0.12);border:1px solid rgba(240,185,11,0.35);color:#F0B90B;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;padding:5px 16px;border-radius:100px;margin-bottom:18px;">
                ✦ &nbsp;Compte activé
              </div>

              <!-- Headline -->
              <h1 style="margin:0;font-size:30px;font-weight:700;color:#FFFFFF;line-height:1.3;">
                Bienvenue, <span style="color:#F0B90B;">${firstName}</span>&nbsp;! 🎉
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:#9BA3AF;line-height:1.6;">
                Ton compte est créé ! Complète ta vérification KYC pour commencer à encaisser.
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 40px;">

              <!-- Intro -->
              <p style="margin:0 0 22px;font-size:14px;color:#CBD5E1;line-height:1.75;">
                Tu rejoins des milliers de marchands africains qui font confiance à <strong style="color:#F0B90B;">Ashtech Pay</strong>
                pour encaisser leurs paiements Mobile Money — dans <strong style="color:#FFFFFF;">22+ pays africains</strong>.
              </p>

              <!-- KYC reminder -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:linear-gradient(135deg,rgba(240,185,11,0.1) 0%,rgba(240,185,11,0.04) 100%);border:1px solid rgba(240,185,11,0.35);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:28px;padding-right:16px;vertical-align:top;">🪪</td>
                        <td style="vertical-align:top;">
                          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#F0B90B;">Étape importante : Vérification KYC</p>
                          <p style="margin:0 0 12px;font-size:12px;color:#D1D5DB;line-height:1.65;">
                            Pour <strong style="color:#FFFFFF;">commencer à collecter des paiements</strong>, tu dois d'abord valider ton identité (KYC).
                            C'est rapide — prépare une pièce d'identité valide.
                          </p>
                          <a href="${APP_URL}/dashboard/kyc"
                             style="display:inline-block;background:#F0B90B;color:#000000;font-size:12px;font-weight:700;padding:9px 22px;border-radius:8px;text-decoration:none;">
                            Faire ma vérification KYC &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Features box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(240,185,11,0.04);border:1px solid rgba(240,185,11,0.14);border-radius:14px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 18px;font-size:11px;font-weight:700;color:#F0B90B;letter-spacing:2px;text-transform:uppercase;">
                      Ce que tu peux faire maintenant
                    </p>

                    <!-- Feature 1 -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                      <tr>
                        <td width="42" valign="top">
                          <div style="width:38px;height:38px;background:rgba(240,185,11,0.1);border-radius:10px;text-align:center;line-height:38px;font-size:18px;">🔗</div>
                        </td>
                        <td valign="top" style="padding-left:14px;">
                          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#FFFFFF;">Liens de paiement instantanés</p>
                          <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.5;">Crée un lien en 30 secondes, partage sur WhatsApp ou réseaux sociaux.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 2 -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                      <tr>
                        <td width="42" valign="top">
                          <div style="width:38px;height:38px;background:rgba(240,185,11,0.1);border-radius:10px;text-align:center;line-height:38px;font-size:18px;">📲</div>
                        </td>
                        <td valign="top" style="padding-left:14px;">
                          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#FFFFFF;">Mobile Money dans 22+ pays</p>
                          <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.5;">MTN, Orange, Wave, Airtel, M-Pesa et plus encore — tout en un.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 3 -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                      <tr>
                        <td width="42" valign="top">
                          <div style="width:38px;height:38px;background:rgba(240,185,11,0.1);border-radius:10px;text-align:center;line-height:38px;font-size:18px;">💼</div>
                        </td>
                        <td valign="top" style="padding-left:14px;">
                          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#FFFFFF;">Dashboard temps réel</p>
                          <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.5;">Suis tes transactions, télécharge tes reçus et pilote ton activité.</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 4 -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="42" valign="top">
                          <div style="width:38px;height:38px;background:rgba(240,185,11,0.1);border-radius:10px;text-align:center;line-height:38px;font-size:18px;">🏦</div>
                        </td>
                        <td valign="top" style="padding-left:14px;">
                          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#FFFFFF;">Retraits rapides</p>
                          <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.5;">Retire directement vers ton mobile money ou compte bancaire.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/dashboard"
                       style="display:inline-block;background:linear-gradient(135deg,#F0B90B 0%,#D4940A 100%);color:#000000;font-size:15px;font-weight:700;padding:15px 40px;border-radius:12px;text-decoration:none;letter-spacing:0.3px;">
                      Accéder à mon dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr><td style="border-top:1px solid rgba(255,255,255,0.07);font-size:0;">&nbsp;</td></tr>
              </table>

              <!-- Security note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:20px;padding-right:12px;vertical-align:top;">🔒</td>
                        <td style="font-size:12px;color:#6B7280;line-height:1.6;vertical-align:top;">
                          Pour ta sécurité, ne partage <strong style="color:#9CA3AF;">jamais ton mot de passe</strong>.
                          Ashtech Pay ne te demandera jamais tes identifiants par email ou par téléphone.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Support & Social -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(240,185,11,0.04);border:1px solid rgba(240,185,11,0.12);border-radius:14px;">
                <tr>
                  <td style="padding:22px 28px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#F0B90B;letter-spacing:1.5px;text-transform:uppercase;">
                      Besoin d'aide ?
                    </p>
                    <p style="margin:0 0 18px;font-size:13px;color:#9BA3AF;">
                      Notre équipe est disponible 7j/7 pour t'accompagner.
                    </p>

                    <!-- Phone -->
                    <p style="margin:0 0 20px;">
                      <a href="tel:${SUPPORT_PHONE.replace(/\s/g, "")}"
                         style="display:inline-block;background:rgba(255,255,255,0.06);color:#FFFFFF;font-size:14px;font-weight:600;padding:10px 22px;border-radius:10px;text-decoration:none;">
                        📞 &nbsp;${SUPPORT_PHONE}
                      </a>
                    </p>

                    <!-- Social buttons -->
                    <table cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <!-- WhatsApp -->
                        <td style="padding:0 6px;">
                          <a href="${WHATSAPP_URL}"
                             style="display:inline-block;background:#25D366;color:#FFFFFF;font-size:13px;font-weight:700;padding:11px 22px;border-radius:10px;text-decoration:none;">
                            <span style="font-size:16px;vertical-align:middle;">💬</span>
                            &nbsp;WhatsApp
                          </a>
                        </td>
                        <!-- Facebook -->
                        <td style="padding:0 6px;">
                          <a href="${FACEBOOK_URL}"
                             style="display:inline-block;background:#1877F2;color:#FFFFFF;font-size:13px;font-weight:700;padding:11px 22px;border-radius:10px;text-decoration:none;">
                            <span style="font-size:16px;vertical-align:middle;">📘</span>
                            &nbsp;Facebook
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:22px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:#4B5563;line-height:1.7;">
                Tu reçois cet email car tu viens de créer un compte sur
                <a href="${APP_URL}" style="color:#F0B90B;text-decoration:none;">ashtechpay.top</a>.
              </p>
              <p style="margin:0 0 6px;font-size:11px;color:#374151;line-height:1.7;">
                Cameroun · Kenya · Sénégal · Côte d'Ivoire · Ghana · Nigeria · Rwanda · Togo · Mali · et 13 autres pays
              </p>
              <p style="margin:0;font-size:11px;color:#374151;">&copy; 2026 Ashtech Pay &mdash; Tous droits réservés</p>
            </td>
          </tr>

        </table>
        <!-- END MAIN CARD -->

      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: "🎉 Bienvenue chez Ashtech Pay — Votre compte est activé !",
      html,
    });

    if (error) {
      console.error("[Email] Resend error:", JSON.stringify(error));
    } else {
      console.log("[Email] Welcome email sent:", data?.id, "→", to);
    }
  } catch (err: any) {
    console.error("[Email] Failed to send welcome email:", err.message);
  }
}

// ─── SHARED LAYOUT HELPERS ────────────────────────────────────────────────────

function emailHeader(firstName: string, badgeText: string, badgeColor: string, headline: string, subtitle: string) {
  return `
          <tr>
            <td style="background:linear-gradient(135deg,#0D1017 0%,#1A1F2C 100%);padding:36px 40px 28px;text-align:center;border-bottom:1px solid rgba(240,185,11,0.15);">
              <div style="margin-bottom:22px;">
                <table cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td style="background:#000000;border-radius:14px;padding:10px 20px;">
                      <img src="${LOGO_URL}" alt="Ashtech Pay" width="140" height="auto"
                           style="display:block;max-height:45px;width:auto;" />
                    </td>
                  </tr>
                </table>
              </div>
              <div style="display:inline-block;background:${badgeColor};border-radius:100px;padding:5px 16px;margin-bottom:18px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                ${badgeText}
              </div>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.3;">${headline}</h1>
              <p style="margin:12px 0 0;font-size:14px;color:#9BA3AF;line-height:1.6;">
                Bonjour <strong style="color:#F0B90B;">${firstName}</strong>, ${subtitle}
              </p>
            </td>
          </tr>`;
}

function emailFooter(reason: string) {
  return `
          <tr>
            <td style="padding:20px 40px 26px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:#4B5563;line-height:1.7;">${reason}</p>
              <p style="margin:0;font-size:11px;color:#374151;">&copy; 2026 Ashtech Pay &mdash; Tous droits réservés</p>
            </td>
          </tr>`;
}

function emailSupportBlock() {
  return `
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(240,185,11,0.04);border:1px solid rgba(240,185,11,0.12);border-radius:12px;margin-top:24px;">
                <tr>
                  <td style="padding:18px 22px;text-align:center;">
                    <p style="margin:0 0 14px;font-size:12px;color:#9BA3AF;">Des questions ? Notre équipe est là pour toi.</p>
                    <table cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td style="padding:0 5px;">
                          <a href="https://wa.me/${SUPPORT_PHONE.replace(/[\s+]/g, "")}"
                             style="display:inline-block;background:#25D366;color:#FFFFFF;font-size:12px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none;">
                            💬 WhatsApp
                          </a>
                        </td>
                        <td style="padding:0 5px;">
                          <a href="${FACEBOOK_URL}"
                             style="display:inline-block;background:#1877F2;color:#FFFFFF;font-size:12px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none;">
                            📘 Facebook
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
}

function emailWrap(rows: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Ashtech Pay</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0E11;font-family:Arial,Helvetica,sans-serif;color:#FFFFFF;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B0E11;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background-color:#13161D;border-radius:20px;border:1px solid rgba(240,185,11,0.2);overflow:hidden;">
          ${rows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string, label: string) {
  try {
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to: [to], subject, html });
    if (error) console.error(`[Email] ${label} error:`, JSON.stringify(error));
    else console.log(`[Email] ${label} sent:`, data?.id, "→", to);
  } catch (err: any) {
    console.error(`[Email] Failed to send ${label}:`, err.message);
  }
}

// ─── KYC APPROVED ─────────────────────────────────────────────────────────────

export async function sendKycApprovedEmail(to: string, fullName: string): Promise<void> {
  const firstName = fullName?.trim().split(" ")[0] || "cher(e) client(e)";

  const body = `
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 24px;font-size:14px;color:#CBD5E1;line-height:1.75;">
                Bonne nouvelle — ton identité a été vérifiée avec succès. Ton compte est maintenant
                <strong style="color:#F0B90B;">entièrement actif</strong> et tu peux commencer à encaisser
                des paiements Mobile Money dans tous nos pays partenaires.
              </p>

              <!-- What's unlocked -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.2);border-radius:14px;margin-bottom:28px;">
                <tr>
                  <td style="padding:22px 26px;">
                    <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#4ADE80;letter-spacing:2px;text-transform:uppercase;">
                      ✅ &nbsp;Ce qui est maintenant débloqué
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr><td style="padding:5px 0;font-size:13px;color:#D1D5DB;line-height:1.6;">💳 &nbsp;Création de <strong style="color:#FFF;">liens de paiement</strong> instantanés</td></tr>
                      <tr><td style="padding:5px 0;font-size:13px;color:#D1D5DB;line-height:1.6;">📲 &nbsp;Collecte Mobile Money dans <strong style="color:#FFF;">22+ pays</strong></td></tr>
                      <tr><td style="padding:5px 0;font-size:13px;color:#D1D5DB;line-height:1.6;">🏦 &nbsp;<strong style="color:#FFF;">Retraits</strong> vers ton compte mobile money</td></tr>
                      <tr><td style="padding:5px 0;font-size:13px;color:#D1D5DB;line-height:1.6;">📊 &nbsp;Accès complet au <strong style="color:#FFF;">dashboard</strong> et aux rapports</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/dashboard"
                       style="display:inline-block;background:linear-gradient(135deg,#F0B90B 0%,#D4940A 100%);color:#000000;font-size:15px;font-weight:700;padding:15px 40px;border-radius:12px;text-decoration:none;">
                      🚀 &nbsp;Commencer à collecter
                    </a>
                  </td>
                </tr>
              </table>

              ${emailSupportBlock()}

            </td>
          </tr>`;

  const html = emailWrap(
    emailHeader(firstName,
      "✦ &nbsp;KYC Approuvé", "rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.4);color:#4ADE80",
      "Ton identité est vérifiée !",
      "voici une excellente nouvelle pour ton compte."
    ) + body + emailFooter(`Tu reçois cet email car ton KYC a été validé sur <a href="${APP_URL}" style="color:#F0B90B;text-decoration:none;">ashtechpay.top</a>.`)
  );

  await sendEmail(to, "✅ KYC validé — Tu peux commencer à encaisser sur Ashtech Pay", html, "KYC approved");
}

// ─── WITHDRAWAL APPROVED ──────────────────────────────────────────────────────

export async function sendWithdrawalApprovedEmail(
  to: string,
  fullName: string,
  amount: string,
  currency: string,
  reference?: string
): Promise<void> {
  const firstName = fullName?.trim().split(" ")[0] || "cher(e) client(e)";

  const body = `
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 24px;font-size:14px;color:#CBD5E1;line-height:1.75;">
                Ton retrait a été approuvé et le paiement est en cours de traitement vers ton compte Mobile Money.
                Le virement sera effectué dans les <strong style="color:#F0B90B;">prochaines minutes</strong>.
              </p>

              <!-- Amount card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(240,185,11,0.06);border:1px solid rgba(240,185,11,0.25);border-radius:14px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:12px;color:#9BA3AF;text-transform:uppercase;letter-spacing:1.5px;">Montant du retrait</p>
                    <p style="margin:0;font-size:32px;font-weight:700;color:#F0B90B;">${amount} ${currency}</p>
                    ${reference ? `<p style="margin:8px 0 0;font-size:11px;color:#6B7280;">Réf : <span style="color:#9BA3AF;">${reference}</span></p>` : ""}
                  </td>
                </tr>
              </table>

              <!-- Status steps -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,255,255,0.03);border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 22px;">
                    <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#9BA3AF;letter-spacing:1.5px;text-transform:uppercase;">Suivi du retrait</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding:5px 0;font-size:12px;color:#4ADE80;">✅ &nbsp;Demande reçue</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:12px;color:#4ADE80;">✅ &nbsp;Retrait approuvé par l'équipe Ashtech Pay</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:12px;color:#F0B90B;">⏳ &nbsp;Virement vers ton mobile money en cours…</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/dashboard/transactions"
                       style="display:inline-block;background:linear-gradient(135deg,#F0B90B 0%,#D4940A 100%);color:#000000;font-size:14px;font-weight:700;padding:13px 36px;border-radius:12px;text-decoration:none;">
                      Voir mes transactions
                    </a>
                  </td>
                </tr>
              </table>

              ${emailSupportBlock()}

            </td>
          </tr>`;

  const html = emailWrap(
    emailHeader(firstName,
      "💸 &nbsp;Retrait approuvé", "rgba(240,185,11,0.12);border:1px solid rgba(240,185,11,0.35);color:#F0B90B",
      "Ton retrait est en cours !",
      "voici les détails de ton retrait approuvé."
    ) + body + emailFooter(`Tu reçois cet email car un retrait a été approuvé sur ton compte <a href="${APP_URL}" style="color:#F0B90B;text-decoration:none;">ashtechpay.top</a>.`)
  );

  await sendEmail(to, "💸 Retrait approuvé — Virement en cours sur Ashtech Pay", html, "withdrawal approved");
}

// ─── WITHDRAWAL NUMBER APPROVED ───────────────────────────────────────────────

export async function sendWithdrawalNumberApprovedEmail(
  to: string,
  fullName: string,
  phoneNumber: string,
  operator?: string
): Promise<void> {
  const firstName = fullName?.trim().split(" ")[0] || "cher(e) client(e)";

  const body = `
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 24px;font-size:14px;color:#CBD5E1;line-height:1.75;">
                Ton numéro de retrait a été vérifié et approuvé par notre équipe. Tu peux maintenant
                <strong style="color:#F0B90B;">effectuer des retraits</strong> directement vers ce numéro.
              </p>

              <!-- Number card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(240,185,11,0.06);border:1px solid rgba(240,185,11,0.25);border-radius:14px;margin-bottom:28px;">
                <tr>
                  <td style="padding:22px 28px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:12px;color:#9BA3AF;text-transform:uppercase;letter-spacing:1.5px;">Numéro approuvé</p>
                    <p style="margin:0;font-size:26px;font-weight:700;color:#F0B90B;">${phoneNumber}</p>
                    ${operator ? `<p style="margin:8px 0 0;font-size:13px;color:#CBD5E1;">Opérateur : <strong style="color:#FFFFFF;">${operator}</strong></p>` : ""}
                    <div style="margin-top:14px;display:inline-block;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#4ADE80;font-size:11px;font-weight:700;padding:4px 14px;border-radius:100px;">
                      ✅ &nbsp;Approuvé
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security tip -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,255,255,0.03);border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:18px;padding-right:12px;vertical-align:top;">🛡️</td>
                        <td style="font-size:12px;color:#9BA3AF;line-height:1.65;vertical-align:top;">
                          Si tu n'es pas à l'origine de cette modification, contacte immédiatement notre équipe sur WhatsApp au
                          <strong style="color:#FFFFFF;">${SUPPORT_PHONE}</strong>.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/dashboard/withdraw"
                       style="display:inline-block;background:linear-gradient(135deg,#F0B90B 0%,#D4940A 100%);color:#000000;font-size:14px;font-weight:700;padding:13px 36px;border-radius:12px;text-decoration:none;">
                      Effectuer un retrait
                    </a>
                  </td>
                </tr>
              </table>

              ${emailSupportBlock()}

            </td>
          </tr>`;

  const html = emailWrap(
    emailHeader(firstName,
      "📱 &nbsp;Numéro validé", "rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.35);color:#4ADE80",
      "Numéro de retrait approuvé",
      "voici une confirmation pour ton numéro de retrait."
    ) + body + emailFooter(`Confirmation de ton numéro de retrait sur <a href="${APP_URL}" style="color:#F0B90B;text-decoration:none;">ashtechpay.top</a>.`)
  );

  await sendEmail(to, "📱 Numéro de retrait approuvé — Ashtech Pay", html, "withdrawal number approved");
}

// ─── ACCOUNT DELETED ──────────────────────────────────────────────────────────

export async function sendAccountDeletedEmail(to: string, fullName: string): Promise<void> {
  const firstName = fullName?.trim().split(" ")[0] || "cher(e) client(e)";

  const body = `
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 24px;font-size:14px;color:#CBD5E1;line-height:1.75;">
                Nous confirmons que ton compte Ashtech Pay a été <strong style="color:#FF6B6B;">définitivement supprimé</strong>
                conformément à ta demande. Toutes tes données personnelles ont été effacées de nos serveurs.
              </p>

              <!-- Confirmation box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,80,80,0.05);border:1px solid rgba(255,80,80,0.2);border-radius:14px;margin-bottom:28px;">
                <tr>
                  <td style="padding:22px 26px;">
                    <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#FF6B6B;letter-spacing:2px;text-transform:uppercase;">
                      🗑️ &nbsp;Ce qui a été supprimé
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr><td style="padding:4px 0;font-size:12px;color:#D1D5DB;line-height:1.6;">• Toutes tes informations personnelles</td></tr>
                      <tr><td style="padding:4px 0;font-size:12px;color:#D1D5DB;line-height:1.6;">• Ton historique de transactions</td></tr>
                      <tr><td style="padding:4px 0;font-size:12px;color:#D1D5DB;line-height:1.6;">• Tes liens de paiement et paramètres</td></tr>
                      <tr><td style="padding:4px 0;font-size:12px;color:#D1D5DB;line-height:1.6;">• Tes numéros de retrait enregistrés</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Farewell + re-register -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,255,255,0.03);border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 22px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:13px;color:#9BA3AF;">
                      Nous sommes tristes de te voir partir, <strong style="color:#F0B90B;">${firstName}</strong>. 💛
                    </p>
                    <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.65;">
                      Tu es toujours le(la) bienvenu(e) si tu souhaites revenir.
                      Un nouveau compte peut être créé à tout moment sur&nbsp;
                      <a href="${APP_URL}" style="color:#F0B90B;text-decoration:none;">ashtechpay.top</a>.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Alert if not requested -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:rgba(255,193,7,0.05);border:1px solid rgba(255,193,7,0.2);border-radius:12px;margin-bottom:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:18px;padding-right:12px;vertical-align:top;">⚠️</td>
                        <td style="font-size:12px;color:#9BA3AF;line-height:1.65;vertical-align:top;">
                          Si tu n'as <strong style="color:#FFFFFF;">pas</strong> demandé cette suppression, contacte-nous
                          immédiatement au <strong style="color:#FFFFFF;">${SUPPORT_PHONE}</strong>.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${emailSupportBlock()}

            </td>
          </tr>`;

  const html = emailWrap(
    emailHeader(firstName,
      "🗑️ &nbsp;Compte supprimé", "rgba(255,80,80,0.12);border:1px solid rgba(255,80,80,0.3);color:#FF6B6B",
      "Ton compte a été supprimé",
      "voici la confirmation de suppression de ton compte."
    ) + body + emailFooter(`Tu reçois cet email car ton compte <a href="${APP_URL}" style="color:#F0B90B;text-decoration:none;">ashtechpay.top</a> a été supprimé.`)
  );

  await sendEmail(to, "🗑️ Compte Ashtech Pay supprimé — Confirmation", html, "account deleted");
}
