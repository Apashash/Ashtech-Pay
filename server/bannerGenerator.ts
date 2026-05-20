import sharp from "sharp";

export type BannerType =
  | "stats" | "pending" | "kyc" | "users" | "revenue" | "wallet"
  | "rapport" | "liens" | "top" | "verif" | "broadcast" | "taux"
  | "pays" | "search" | "user" | "help" | "ban" | "tx";

interface BannerConfig {
  title: string;
  subtitle: string;
  accent: string;
  letter: string;
}

const CONFIGS: Record<BannerType, BannerConfig> = {
  stats:     { title: "STATISTIQUES",       subtitle: "Tableau de bord · Ashtech Pay",         accent: "#F0B90B", letter: "S" },
  pending:   { title: "EN ATTENTE",          subtitle: "Transactions en attente de traitement",  accent: "#F6851B", letter: "P" },
  kyc:       { title: "VÉRIFICATION KYC",   subtitle: "Contrôle d'identité · Ashtech Pay",      accent: "#0ECB81", letter: "K" },
  users:     { title: "UTILISATEURS",        subtitle: "Gestion des comptes · Ashtech Pay",      accent: "#2196F3", letter: "U" },
  revenue:   { title: "REVENUS",             subtitle: "Marges et commissions · Ashtech Pay",    accent: "#0ECB81", letter: "R" },
  wallet:    { title: "SOLDE PLATEFORME",    subtitle: "Fonds en circulation · Ashtech Pay",     accent: "#F0B90B", letter: "W" },
  rapport:   { title: "RAPPORT COMPLET",     subtitle: "Analyse globale · Ashtech Pay",          accent: "#9C27B0", letter: "A" },
  liens:     { title: "LIENS PAIEMENT",      subtitle: "Liens actifs aujourd'hui",               accent: "#2196F3", letter: "L" },
  top:       { title: "TOP UTILISATEURS",    subtitle: "Classement par solde · Ashtech Pay",     accent: "#F0B90B", letter: "T" },
  verif:     { title: "VÉRIFICATION TX",     subtitle: "Contrôle de transaction · Ashtech Pay",  accent: "#2196F3", letter: "V" },
  broadcast: { title: "BROADCAST EMAIL",     subtitle: "Message groupé · Ashtech Pay",           accent: "#9C27B0", letter: "B" },
  taux:      { title: "TAUX DE CHANGE",      subtitle: "Devises et taux FX · Ashtech Pay",       accent: "#F6851B", letter: "X" },
  pays:      { title: "PAYS ACTIFS",         subtitle: "Gestion des marchés · Ashtech Pay",      accent: "#0ECB81", letter: "G" },
  search:    { title: "RECHERCHE",           subtitle: "Recherche utilisateur · Ashtech Pay",    accent: "#2196F3", letter: "Q" },
  user:      { title: "PROFIL UTILISATEUR",  subtitle: "Informations du compte · Ashtech Pay",   accent: "#F0B90B", letter: "I" },
  help:      { title: "AIDE & COMMANDES",    subtitle: "Liste des commandes disponibles",        accent: "#848E9C", letter: "?" },
  ban:       { title: "GESTION COMPTE",      subtitle: "Modération utilisateur · Ashtech Pay",   accent: "#F44336", letter: "M" },
  tx:        { title: "NOUVELLE TRANSACTION",subtitle: "Notification · Ashtech Pay",             accent: "#0ECB81", letter: "N" },
};

function buildSvg(cfg: BannerConfig): string {
  const { title, subtitle, accent, letter } = cfg;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="180">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0B0E11"/>
        <stop offset="100%" stop-color="#141A21"/>
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1E2329"/>
        <stop offset="100%" stop-color="#181D23"/>
      </linearGradient>
    </defs>

    <!-- Background -->
    <rect width="800" height="180" fill="url(#bg)"/>

    <!-- Left accent stripe -->
    <rect x="0" y="0" width="5" height="180" fill="${accent}"/>

    <!-- Icon circle background -->
    <circle cx="92" cy="90" r="52" fill="url(#card)" stroke="${accent}" stroke-width="2" stroke-opacity="0.4"/>

    <!-- Icon letter -->
    <text x="92" y="108" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="bold"
          text-anchor="middle" fill="${accent}">${letter}</text>

    <!-- Vertical divider -->
    <line x1="168" y1="28" x2="168" y2="152" stroke="#2B3139" stroke-width="1"/>

    <!-- Title -->
    <text x="192" y="80" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="bold"
          fill="#EAECEF" letter-spacing="1">${escapeXml(title)}</text>

    <!-- Subtitle -->
    <text x="192" y="114" font-family="Arial, Helvetica, sans-serif" font-size="15"
          fill="#848E9C">${escapeXml(subtitle)}</text>

    <!-- Accent underline below title -->
    <rect x="192" y="88" width="60" height="3" rx="1.5" fill="${accent}" opacity="0.7"/>

    <!-- Brand pill -->
    <rect x="596" y="144" width="184" height="24" rx="12" fill="#1E2329" stroke="${accent}" stroke-width="1" stroke-opacity="0.3"/>
    <text x="688" y="161" font-family="Arial, Helvetica, sans-serif" font-size="12"
          text-anchor="middle" fill="${accent}" font-weight="bold">ASHTECH PAY</text>

    <!-- Bottom golden bar -->
    <rect x="0" y="175" width="800" height="5" fill="${accent}" opacity="0.6"/>
  </svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const cache = new Map<BannerType, Buffer>();

export async function generateBanner(type: BannerType): Promise<Buffer> {
  if (cache.has(type)) return cache.get(type)!;
  const cfg = CONFIGS[type] ?? CONFIGS.stats;
  const svgBuffer = Buffer.from(buildSvg(cfg));
  const png = await sharp(svgBuffer).png().toBuffer();
  cache.set(type, png);
  return png;
}
