import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL   = "Ashtech Pay <noreply@ashtechpay.top>";
const APP_URL      = "https://ashtechpay.top";
const LOGO_URL     = "https://ashtechpay.top/logo.png";
const FACEBOOK_URL = "https://www.facebook.com/share/1Eczpeowdp/?mibextid=wwXIfr";
const WHATSAPP_URL = "https://whatsapp.com/channel/0029VbC5tPPCxoAveJ44Vs2w";
const SUPPORT_PHONE = "+237 6 83 67 78 72";

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
                Ton compte Ashtech Pay est prêt — commence à collecter dès aujourd'hui.
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 40px;">

              <!-- Intro -->
              <p style="margin:0 0 28px;font-size:14px;color:#CBD5E1;line-height:1.75;">
                Tu rejoins des milliers de marchands africains qui font confiance à <strong style="color:#F0B90B;">Ashtech Pay</strong>
                pour encaisser leurs paiements Mobile Money, créer des liens de paiement et gérer leur activité — dans
                <strong style="color:#FFFFFF;">22+ pays africains</strong>.
              </p>

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
