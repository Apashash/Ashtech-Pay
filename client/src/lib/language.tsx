import { createContext, useContext, useState, useEffect } from "react";

export type Language = "fr" | "en";

const translations = {
  fr: {
    // Landing Navbar
    nav: {
      menu: "Menu",
      close: "Fermer le menu",
      account: "Compte",
      login: "Se connecter",
      register: "Créer un compte",
      resources: "Ressources",
      help: "Centre d'aide",
      faq: "FAQ",
      blog: "Blog",
      contact: "Contact",
      apiDocs: "Documentation API",
      hostedDocs: "Documentation Hosted Page",
      about: "À propos",
      about_link: "À propos",
      careers: "Carrières",
      legal: "Légal",
      terms: "Conditions d'utilisation",
      privacy: "Politique de confidentialité",
      legalNotice: "Mentions légales",
    },
    // Landing Hero
    hero: {
      title1: "Vendez en ligne.",
      title2: "Encaissez instantanément.",
      desc: " est une plateforme de paiement innovante qui permet aux créateurs, entrepreneurs et commerçants de vendre leurs produits physiques ou digitaux grâce à un simple lien de paiement, et de recevoir leur argent immédiatement, en toute sécurité.",
      bullet1: "Aucun site requis.",
      bullet2: "Aucun stress technique.",
      bullet3: "Paiements locaux & internationaux.",
      cta: "Commencer maintenant",
      ctaLogin: "Se connecter",
      totalBalance: "Solde total",
      send: "Envoyer",
      receive: "Recevoir",
      topup: "Recharger",
      recentTx: "Transactions récentes",
    },
    // Landing sections
    landing: {
      onlineSalesTag: "Un lien. Plusieurs moyens de paiement.",
      onlineSalesTitle1: "VENDEZ",
      onlineSalesTitle2: "tout type de produit",
      onlineSalesDesc: "Vos clients peuvent payer avec MOBILE MONEY (MTN, ORANGE, AIRTEL, MOOV), CARTE BANCAIRE (VISA, MASTERCARD), virements locaux et autres moyens selon le pays.",
      digitalProducts: "Produits digitaux",
      files: "Fichiers",
      courses: "Formations",
      privateAccess: "Accès privés",
      services: "Services",
      autoDelivery: "Livraison automatique après paiement",
      physicalProducts: "Produits physiques",
      clientInfo: "Collecte des informations client",
      orderTracking: "Suivi des commandes",
      salesManagement: "Gestion simple des ventes",
      txHistory: "Historique complet des transactions",
      paymentLinksTag: "Liens de paiement",
      paymentLinksTitle: "Créez vos liens et partagez-les partout",
      paymentLinksDesc: "De la création du lien au retrait de vos fonds, tout devient facile. Créez en quelques secondes un lien de paiement adapté à vos besoins.",
      fixedOrFree: "Montant fixe ou libre",
      fixedOrFreeDesc: "Adaptez selon vos besoins",
      pdfFile: "Fichier PDF inclus",
      pdfFileDesc: "Joignez vos documents",
      expiry: "Date d'expiration",
      expiryDesc: "Contrôlez la validité",
      redirect: "Lien de redirection",
      redirectDesc: "Après paiement",
      feesTitle: "Des frais transparents",
      feesDesc: "Aucune surprise. Vous payez uniquement lorsque vous encaissez.",
      coverageTitle: "Couverture africaine",
      coverageDesc: "Disponible dans plus de 20 pays africains.",
      securityTitle: "Sécurité maximale",
      securityDesc: "Transactions chiffrées, données protégées.",
      ctaTitle: "Prêt à commencer ?",
      ctaDesc: "Rejoignez des milliers de marchands qui font confiance à AshTech Pay.",
      ctaBtn: "Créer un compte gratuit",
    },
    // Dashboard sidebar
    sidebar: {
      availableBalance: "Solde disponible",
      mainMenu: "Menu Principal",
      settingsSupport: "Paramètres & Support",
      administration: "Administration",
      adminPanel: "Panel Admin",
      logout: "Déconnexion",
      verified: "Vérifié",
      dashboard: "Tableau de bord",
      links: "Mes liens",
      transactions: "Transactions",
      deposit: "Dépôt",
      withdraw: "Retrait",
      send: "Envoyer",
      wallets: "Comptes",
      kyc: "KYC",
      support: "Support",
      apiKeys: "Clés API",
      settings: "Paramètres",
      fees: "Frais",
    },
    // Dashboard home
    dashboard: {
      title: "Tableau de bord",
      welcome: "Bienvenue",
      quickActions: "ACTIONS RAPIDES",
      overview: "VUE D'ENSEMBLE",
      deposit: "Dépôt",
      withdraw: "Retrait",
      send: "Envoyer",
      paymentLink: "Lien paiement",
      totalBalance: "Solde Total",
      totalLinks: "Liens de Paiement",
      successRate: "Taux de Succès",
      totalVolume: "Volume Total",
      recentActivity: "ACTIVITÉ RÉCENTE",
      noTransactions: "Aucune transaction récente",
      seeAll: "Voir tout",
      today: "Aujourd'hui",
      yesterday: "Hier",
      maintenance: "Maintenance en cours",
      maintenanceDesc: "La plateforme est temporairement indisponible pour maintenance.",
    },
    // Common
    common: {
      confirm: "Confirmer",
      cancel: "Annuler",
      back: "Retour",
      save: "Enregistrer",
      edit: "Modifier",
      delete: "Supprimer",
      close: "Fermer",
      loading: "Chargement...",
      error: "Erreur",
      success: "Succès",
      amount: "Montant",
      currency: "Devise",
      country: "Pays",
      operator: "Opérateur",
      phone: "Téléphone",
      name: "Nom",
      email: "Email",
      search: "Rechercher",
      filter: "Filtrer",
      export: "Exporter",
      status: "Statut",
      date: "Date",
      type: "Type",
      completed: "Complété",
      pending: "En attente",
      failed: "Échoué",
      all: "Tous",
    },
    // Notifications
    notifications: {
      title: "Notifications",
      markAllRead: "Tout marquer comme lu",
      noNotifications: "Aucune notification",
    },
  },

  en: {
    // Landing Navbar
    nav: {
      menu: "Menu",
      close: "Close menu",
      account: "Account",
      login: "Log in",
      register: "Create an account",
      resources: "Resources",
      help: "Help Center",
      faq: "FAQ",
      blog: "Blog",
      contact: "Contact",
      apiDocs: "API Documentation",
      hostedDocs: "Hosted Page Documentation",
      about: "About",
      about_link: "About",
      careers: "Careers",
      legal: "Legal",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      legalNotice: "Legal Notices",
    },
    // Landing Hero
    hero: {
      title1: "Sell online.",
      title2: "Get paid instantly.",
      desc: " is an innovative payment platform that allows creators, entrepreneurs and merchants to sell their physical or digital products through a simple payment link, and receive their money immediately, safely.",
      bullet1: "No website required.",
      bullet2: "No technical hassle.",
      bullet3: "Local & international payments.",
      cta: "Get started now",
      ctaLogin: "Log in",
      totalBalance: "Total balance",
      send: "Send",
      receive: "Receive",
      topup: "Top up",
      recentTx: "Recent transactions",
    },
    // Landing sections
    landing: {
      onlineSalesTag: "One link. Multiple payment methods.",
      onlineSalesTitle1: "SELL",
      onlineSalesTitle2: "any type of product",
      onlineSalesDesc: "Your customers can pay with MOBILE MONEY (MTN, ORANGE, AIRTEL, MOOV), BANK CARD (VISA, MASTERCARD), local transfers and other methods depending on the country.",
      digitalProducts: "Digital products",
      files: "Files",
      courses: "Courses",
      privateAccess: "Private access",
      services: "Services",
      autoDelivery: "Automatic delivery after payment",
      physicalProducts: "Physical products",
      clientInfo: "Customer information collection",
      orderTracking: "Order tracking",
      salesManagement: "Simple sales management",
      txHistory: "Full transaction history",
      paymentLinksTag: "Payment links",
      paymentLinksTitle: "Create your links and share them everywhere",
      paymentLinksDesc: "From link creation to fund withdrawal, everything becomes easy. Create a payment link tailored to your needs in seconds.",
      fixedOrFree: "Fixed or open amount",
      fixedOrFreeDesc: "Adapt to your needs",
      pdfFile: "PDF file included",
      pdfFileDesc: "Attach your documents",
      expiry: "Expiry date",
      expiryDesc: "Control validity",
      redirect: "Redirect link",
      redirectDesc: "After payment",
      feesTitle: "Transparent fees",
      feesDesc: "No surprises. You only pay when you collect.",
      coverageTitle: "African coverage",
      coverageDesc: "Available in more than 20 African countries.",
      securityTitle: "Maximum security",
      securityDesc: "Encrypted transactions, protected data.",
      ctaTitle: "Ready to get started?",
      ctaDesc: "Join thousands of merchants who trust AshTech Pay.",
      ctaBtn: "Create a free account",
    },
    // Dashboard sidebar
    sidebar: {
      availableBalance: "Available balance",
      mainMenu: "Main Menu",
      settingsSupport: "Settings & Support",
      administration: "Administration",
      adminPanel: "Admin Panel",
      logout: "Log out",
      verified: "Verified",
      dashboard: "Dashboard",
      links: "My links",
      transactions: "Transactions",
      deposit: "Deposit",
      withdraw: "Withdraw",
      send: "Send",
      wallets: "Accounts",
      kyc: "KYC",
      support: "Support",
      apiKeys: "API Keys",
      settings: "Settings",
      fees: "Fees",
    },
    // Dashboard home
    dashboard: {
      title: "Dashboard",
      welcome: "Welcome",
      quickActions: "QUICK ACTIONS",
      overview: "OVERVIEW",
      deposit: "Deposit",
      withdraw: "Withdraw",
      send: "Send",
      paymentLink: "Payment link",
      totalBalance: "Total Balance",
      totalLinks: "Payment Links",
      successRate: "Success Rate",
      totalVolume: "Total Volume",
      recentActivity: "RECENT ACTIVITY",
      noTransactions: "No recent transactions",
      seeAll: "See all",
      today: "Today",
      yesterday: "Yesterday",
      maintenance: "Maintenance in progress",
      maintenanceDesc: "The platform is temporarily unavailable for maintenance.",
    },
    // Common
    common: {
      confirm: "Confirm",
      cancel: "Cancel",
      back: "Back",
      save: "Save",
      edit: "Edit",
      delete: "Delete",
      close: "Close",
      loading: "Loading...",
      error: "Error",
      success: "Success",
      amount: "Amount",
      currency: "Currency",
      country: "Country",
      operator: "Operator",
      phone: "Phone",
      name: "Name",
      email: "Email",
      search: "Search",
      filter: "Filter",
      export: "Export",
      status: "Status",
      date: "Date",
      type: "Type",
      completed: "Completed",
      pending: "Pending",
      failed: "Failed",
      all: "All",
    },
    // Notifications
    notifications: {
      title: "Notifications",
      markAllRead: "Mark all as read",
      noNotifications: "No notifications",
    },
  },
} as const;

export type Translations = typeof translations.fr;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("ashtech_language");
    return (saved === "en" || saved === "fr") ? saved : "fr";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("ashtech_language", lang);
  };

  const t = translations[language] as Translations;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
