import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "Ashtech Pay <noreply@ashtechpay.top>";
const APP_URL = "https://ashtechpay.top";

export async function sendWelcomeEmail(to: string, fullName: string): Promise<void> {
  const firstName = fullName?.split(" ")[0] || fullName || "cher(e) client(e)";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bienvenue chez Ashtech Pay</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background-color: #0B0E11; font-family: 'Poppins', Arial, sans-serif; color: #FFFFFF; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: linear-gradient(145deg, #1a1d24, #13161d); border: 1px solid rgba(240,185,11,0.2); border-radius: 20px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0B0E11 0%, #1a1d24 100%); padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid rgba(240,185,11,0.15); }
    .logo-wrap { display: inline-flex; align-items: center; justify-content: center; background: #000; border-radius: 14px; padding: 10px 18px; margin-bottom: 24px; }
    .logo-wrap img { height: 40px; width: auto; }
    .badge { display: inline-block; background: rgba(240,185,11,0.12); border: 1px solid rgba(240,185,11,0.3); color: #F0B90B; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 5px 14px; border-radius: 100px; margin-bottom: 20px; }
    .headline { font-size: 28px; font-weight: 700; color: #FFFFFF; line-height: 1.3; }
    .headline span { color: #F0B90B; }
    .body-content { padding: 36px 40px; }
    .greeting { font-size: 16px; color: #E8E8E8; margin-bottom: 16px; }
    .intro { font-size: 14px; color: #9BA3AF; line-height: 1.7; margin-bottom: 32px; }
    .features { background: rgba(240,185,11,0.05); border: 1px solid rgba(240,185,11,0.12); border-radius: 14px; padding: 24px; margin-bottom: 32px; }
    .features-title { font-size: 12px; font-weight: 600; color: #F0B90B; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 18px; }
    .feature { display: flex; align-items: flex-start; margin-bottom: 16px; }
    .feature:last-child { margin-bottom: 0; }
    .feature-icon { width: 36px; height: 36px; background: rgba(240,185,11,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 14px; font-size: 16px; }
    .feature-text h4 { font-size: 13px; font-weight: 600; color: #FFFFFF; margin-bottom: 2px; }
    .feature-text p { font-size: 12px; color: #6B7280; line-height: 1.5; }
    .cta-section { text-align: center; margin-bottom: 32px; }
    .cta-btn { display: inline-block; background: linear-gradient(135deg, #F0B90B 0%, #d4a008 100%); color: #000000; font-size: 14px; font-weight: 700; padding: 14px 36px; border-radius: 12px; text-decoration: none; letter-spacing: 0.3px; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0; }
    .security-note { background: rgba(255,255,255,0.03); border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; margin-bottom: 24px; }
    .security-note span { font-size: 20px; margin-right: 12px; }
    .security-note p { font-size: 12px; color: #6B7280; line-height: 1.5; }
    .footer { padding: 24px 40px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; }
    .footer p { font-size: 11px; color: #4B5563; line-height: 1.7; }
    .footer a { color: #F0B90B; text-decoration: none; }
    .countries { font-size: 11px; color: #4B5563; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo-wrap">
          <img src="https://i.imgur.com/placeholder.png" alt="Ashtech Pay" onerror="this.style.display='none'" />
          <span style="color:#F0B90B;font-weight:700;font-size:18px;letter-spacing:0.5px;">ASHTECH<span style="color:#fff;">PAY</span></span>
        </div>
        <div class="badge">✦ Compte activé</div>
        <h1 class="headline">Bienvenue, <span>${firstName}</span>&nbsp;! 🎉</h1>
      </div>

      <div class="body-content">
        <p class="greeting">Félicitations pour l'ouverture de ton compte Ashtech Pay.</p>
        <p class="intro">
          Tu rejoins une plateforme de paiement pensée pour l'Afrique. Collecte tes paiements, envoie de l'argent et gère ton activité en toute simplicité — partout sur le continent.
        </p>

        <div class="features">
          <p class="features-title">Ce que tu peux faire dès maintenant</p>
          <div class="feature">
            <div class="feature-icon">🔗</div>
            <div class="feature-text">
              <h4>Liens de paiement</h4>
              <p>Crée un lien en 30 secondes et partage-le pour recevoir tes paiements instantanément.</p>
            </div>
          </div>
          <div class="feature">
            <div class="feature-icon">📲</div>
            <div class="feature-text">
              <h4>Mobile Money</h4>
              <p>Accepte MTN, Orange, Wave et bien d'autres — dans 22+ pays africains.</p>
            </div>
          </div>
          <div class="feature">
            <div class="feature-icon">💼</div>
            <div class="feature-text">
              <h4>Dashboard marchand</h4>
              <p>Suis tes transactions, télécharge tes reçus et pilote ton activité en temps réel.</p>
            </div>
          </div>
          <div class="feature">
            <div class="feature-icon">🏦</div>
            <div class="feature-text">
              <h4>Retraits rapides</h4>
              <p>Retire vers ton mobile money ou compte bancaire directement depuis ton wallet.</p>
            </div>
          </div>
        </div>

        <div class="cta-section">
          <a href="${APP_URL}/dashboard" class="cta-btn">Accéder à mon dashboard →</a>
        </div>

        <hr class="divider" />

        <div class="security-note">
          <span>🔒</span>
          <p>Pour ta sécurité, ne partage jamais ton mot de passe. Ashtech Pay ne te demandera jamais tes identifiants par email ou téléphone.</p>
        </div>
      </div>

      <div class="footer">
        <p>Tu reçois cet email car tu viens de créer un compte sur <a href="${APP_URL}">Ashtech Pay</a>.</p>
        <p class="countries">Disponible au Cameroun, Kenya, Sénégal, Côte d'Ivoire, Ghana, Nigeria, Rwanda et 16 autres pays.</p>
        <p style="margin-top:12px;">© 2026 Ashtech Pay — Tous droits réservés</p>
      </div>
    </div>
  </div>
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
      console.error("[Email] Resend error:", error);
    } else {
      console.log("[Email] Welcome email sent:", data?.id, "→", to);
    }
  } catch (err: any) {
    console.error("[Email] Failed to send welcome email:", err.message);
  }
}
