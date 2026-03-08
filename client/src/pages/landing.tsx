import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Wallet, 
  ArrowDownUp, 
  Link2, 
  Send, 
  History, 
  Shield, 
  Lock, 
  FileCheck, 
  Zap, 
  Globe, 
  Headphones,
  ChevronRight,
  Smartphone,
  CreditCard,
  Users,
  TrendingUp,
  ShoppingBag,
  Share2,
  Clock,
  FileText,
  Sun,
  Moon,
  Menu,
  X,
  LogIn,
  UserPlus,
  Info,
  Briefcase,
  BookOpen,
  FileText as Terms,
  ShieldCheck,
  Scale,
  HelpCircle,
  Mail,
  MessageCircleQuestion
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";

import paymentValidatedImage from "@assets/IMG_7981_1772401047932.jpeg";
import withdrawalImage from "@assets/IMG_7982_1772401047932.jpeg";
import globalReachImage from "@assets/IMG_7984_1772401047932.jpeg";
import shareImage from "@assets/IMG_7985_1772401047932.jpeg";

const paymentMethods = [
  { name: "Orange Money" },
  { name: "MTN Mobile Money" },
  { name: "Wave" },
  { name: "Airtel Money" },
  { name: "M-Pesa" },
  { name: "Moov Money" },
  { name: "PayPal" },
  { name: "Visa" },
  { name: "Mastercard" },
];

const countries = [
  { name: "Cameroun", code: "cm" },
  { name: "Sénégal", code: "sn" },
  { name: "Côte d'Ivoire", code: "ci" },
  { name: "Mali", code: "ml" },
  { name: "Burkina Faso", code: "bf" },
  { name: "Niger", code: "ne" },
  { name: "Togo", code: "tg" },
  { name: "Bénin", code: "bj" },
  { name: "Gabon", code: "ga" },
  { name: "Congo", code: "cg" },
  { name: "RD Congo", code: "cd" },
  { name: "Centrafrique", code: "cf" },
  { name: "Tchad", code: "td" },
  { name: "Guinée", code: "gn" },
  { name: "Madagascar", code: "mg" },
  { name: "Maroc", code: "ma" },
  { name: "Tunisie", code: "tn" },
  { name: "Algérie", code: "dz" },
  { name: "Kenya", code: "ke" },
  { name: "Nigeria", code: "ng" },
  { name: "Ghana", code: "gh" },
];

function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  
  const menuItems = [
    { label: "Se connecter", href: "/login", icon: LogIn },
    { label: "Créer un compte", href: "/register", icon: UserPlus },
    { label: "À propos", href: "/about", icon: Info },
    { label: "Carrières", href: "/careers", icon: Briefcase },
    { label: "Blog", href: "/blog", icon: BookOpen },
    { label: "Conditions d'utilisation", href: "/terms", icon: Terms },
    { label: "Politique de confidentialité", href: "/privacy", icon: ShieldCheck },
    { label: "Mentions légales", href: "/legal", icon: Scale },
    { label: "Centre d'aide", href: "/help", icon: HelpCircle },
    { label: "Contact", href: "/contact", icon: Mail },
    { label: "FAQ", href: "/faq", icon: MessageCircleQuestion },
  ];
  
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="bg-black rounded-xl px-3 py-1.5">
                  <img src="/logo.png" alt="Ashtech-Pay Afrique" className="h-10 w-auto" />
                </div>
              </div>
            </Link>
            
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-accent transition-colors"
                aria-label="Changer de thème"
                data-testid="button-theme-toggle"
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-blue-500" />
                )}
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Menu"
                data-testid="button-hamburger-menu"
              >
                <Menu className="w-6 h-6 text-foreground" />
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {menuOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div 
            className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-background shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-semibold text-lg text-foreground">Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <item.icon className="w-5 h-5 text-primary" />
                    <span className="text-foreground">{item.label}</span>
                  </button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-x-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0" style={{ zIndex: 1, background: "linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.1) 100%)" }} />
      <div className="absolute top-1/4 right-0 w-72 h-72 md:w-96 md:h-96 bg-primary/10 rounded-full blur-3xl" style={{ zIndex: 1 }} />
      <div className="absolute bottom-1/4 left-0 w-48 h-48 md:w-64 md:h-64 bg-primary/5 rounded-full blur-3xl" style={{ zIndex: 1 }} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-full border border-primary/40 w-fit">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">+18 pays africains</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Vendez en ligne.{" "}
              <span className="text-primary">Encaissez instantanément.</span>
            </h1>
            
            <Link href="/login">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-3 text-sm font-semibold w-fit" data-testid="button-commencer-hero">
                Commencer
              </Button>
            </Link>
            
            <p className="text-lg sm:text-xl text-white/75 max-w-xl">
              <span className="text-cyan-400 font-bold">ASHTECH PAY</span> est une <span className="font-bold text-white">plateforme de paiement innovante</span> qui permet aux créateurs, entrepreneurs et commerçants de vendre leurs <span className="font-bold text-white">produits physiques ou digitaux</span> grâce à un <span className="font-bold text-white">simple lien de paiement</span>, et de recevoir leur argent <span className="font-bold text-white">immédiatement, en toute sécurité</span>.
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/80">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Aucun site requis.</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Aucun stress technique.</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Paiements locaux & internationaux.</span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8" data-testid="button-hero-register">
                  Créer un compte
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8 bg-blue-600 hover:bg-blue-700 text-white border-none" data-testid="button-hero-login">
                  Créer un lien de paiement
                </Button>
              </Link>
            </div>
            
            <div className="flex items-center gap-8 pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">50K+</p>
                <p className="text-sm text-white/60">Vendeurs</p>
              </div>
              <div className="w-px h-10 bg-white/25" />
              <div className="text-center">
                <p className="text-2xl font-bold text-white">10M+</p>
                <p className="text-sm text-white/60">Transactions</p>
              </div>
              <div className="w-px h-10 bg-white/25" />
              <div className="text-center">
                <p className="text-2xl font-bold text-white">18+</p>
                <p className="text-sm text-white/60">Pays</p>
              </div>
            </div>
          </div>
          
          <div className="relative lg:pl-8">
            <div className="relative bg-card rounded-2xl border border-border p-6 shadow-2xl">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-primary/20 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-primary/10 rounded-full blur-xl" />
              
              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Wallet className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Solde total</p>
                      <p className="text-2xl font-bold text-foreground">1,250,000 XAF</p>
                    </div>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-secondary/50 rounded-xl p-4 text-center hover-elevate cursor-pointer">
                    <Send className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Envoyer</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-4 text-center hover-elevate cursor-pointer">
                    <ArrowDownUp className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Recevoir</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-4 text-center hover-elevate cursor-pointer">
                    <CreditCard className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Recharger</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Transactions récentes</p>
                  {[
                    { name: "Jean Dupont", amount: "+50,000 XAF", type: "in" },
                    { name: "Marie Claire", amount: "-25,000 XAF", type: "out" },
                    { name: "Recharge MTN", amount: "+100,000 XAF", type: "in" },
                  ].map((tx, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'in' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          <Users className={`w-4 h-4 ${tx.type === 'in' ? 'text-green-500' : 'text-red-500'}`} />
                        </div>
                        <span className="text-sm text-foreground">{tx.name}</span>
                      </div>
                      <span className={`text-sm font-medium ${tx.type === 'in' ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OnlineSalesSection() {
  return (
    <section className="py-20 lg:py-32 bg-card/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-on-scroll">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
            <Link2 className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Un lien. Plusieurs moyens de paiement.</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            <span className="text-cyan-600">VENDEZ</span> tout type de produit
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Vos clients peuvent payer avec <span className="font-bold text-foreground">MOBILE MONEY (MTN, ORANGE, AIRTEL, MOOV)</span>, <span className="font-bold text-foreground">CARTE BANCAIRE (VISA, MASTERCARD)</span>, virements locaux et autres moyens selon le pays.
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <Card className="p-8 bg-card border-border animate-on-scroll-left">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Produits digitaux</h3>
            </div>
            <ul className="space-y-4 mb-6">
              <li className="flex items-center gap-3 text-muted-foreground">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Fichiers</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Formations</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Accès privés</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Services</span>
              </li>
            </ul>
            <div className="flex items-center gap-2 text-primary">
              <Send className="w-4 h-4" />
              <span className="text-sm font-medium">Livraison automatique après paiement</span>
            </div>
          </Card>
          
          <Card className="p-8 bg-card border-border animate-on-scroll-right">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Produits physiques</h3>
            </div>
            <ul className="space-y-4 mb-6">
              <li className="flex items-center gap-3 text-muted-foreground">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Collecte des informations client</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Suivi des commandes</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Gestion simple des ventes</span>
              </li>
            </ul>
            <div className="flex items-center gap-2 text-primary">
              <History className="w-4 h-4" />
              <span className="text-sm font-medium">Historique complet des transactions</span>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function PaymentLinksSection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="flex justify-center order-2 lg:order-1 animate-on-scroll-left">
            <img 
              src={paymentValidatedImage} 
              alt="Paiement validé - Processus de validation de paiement" 
              className="w-full max-w-md rounded-2xl"
            />
          </div>
          
          <div className="space-y-6 order-1 lg:order-2 animate-on-scroll-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
              <Link2 className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Liens de paiement</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Créez vos liens et partagez-les partout
            </h2>
            
            <p className="text-lg text-muted-foreground">
              De la création du lien au retrait de vos fonds, tout devient facile. Créez en quelques secondes un lien de paiement adapté à vos besoins.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
                <CreditCard className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground text-sm">Montant fixe ou libre</h4>
                  <p className="text-xs text-muted-foreground">Adaptez selon vos besoins</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
                <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground text-sm">Fichier PDF inclus</h4>
                  <p className="text-xs text-muted-foreground">Joignez vos documents</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
                <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground text-sm">Date d'expiration</h4>
                  <p className="text-xs text-muted-foreground">Contrôlez la validité</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
                <Globe className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground text-sm">Lien de redirection</h4>
                  <p className="text-xs text-muted-foreground">Après paiement</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShareSection() {
  return (
    <section className="py-20 lg:py-32 bg-card/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="space-y-6 animate-on-scroll-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
              <Share2 className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Partage facile</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              <span className="text-cyan-600">DIFFUSEZ</span> vos <span className="font-bold">liens de paiement</span> partout
            </h2>
            
            <p className="text-lg text-muted-foreground">
              Diffusez vos liens de paiement sur WhatsApp, SMS, email ou réseaux sociaux, et offrez à vos clients une expérience fluide où qu'ils soient.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full">
                <span className="text-green-500 font-medium">WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full">
                <span className="text-blue-500 font-medium">Facebook</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-pink-500/10 rounded-full">
                <span className="text-pink-500 font-medium">Instagram</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-full">
                <span className="text-red-500 font-medium">Email</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-full">
                <span className="text-yellow-500 font-medium">SMS</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">
            <img 
              src={shareImage} 
              alt="Partagez vos liens sur WhatsApp, Email, SMS et réseaux sociaux" 
              className="w-full max-w-md rounded-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function WithdrawalSection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="flex justify-center order-2 lg:order-1 animate-on-scroll-left">
            <img 
              src={withdrawalImage} 
              alt="Interface de retrait - Retrait rapide vers Mobile Money ou carte bancaire" 
              className="w-full max-w-md rounded-2xl"
            />
          </div>
          
          <div className="space-y-6 order-1 lg:order-2 animate-on-scroll-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
              <ArrowDownUp className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Retraits</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              <span className="text-cyan-600">RETRAITS</span> rapides et <span className="font-bold">flexibles</span>
            </h2>
            
            <p className="text-lg text-muted-foreground">
              Retirez vos fonds facilement via <span className="font-bold text-foreground">MOBILE MONEY</span> ou <span className="font-bold text-foreground">CARTE BANCAIRE</span>, avec <span className="font-bold text-foreground">historique détaillé</span> et <span className="font-bold text-foreground">confirmation instantanée</span>.
            </p>
            
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-muted-foreground">Retrait vers MTN, Orange Money, Airtel Money, Wave...</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-muted-foreground">Retrait vers Visa et Mastercard</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-muted-foreground">Historique détaillé de toutes vos transactions</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-muted-foreground">Confirmation instantanée par notification</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function GlobalReachSection() {
  return (
    <section className="py-20 lg:py-32 bg-card/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Portée internationale</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Disponible dans plus de 18 pays africains
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Recevez des paiements de partout dans le monde et retirez vos fonds localement via Mobile Money.
          </p>
        </div>
        
        <div className="flex justify-center">
          <img 
            src={globalReachImage} 
            alt="Couverture internationale - Disponible dans plus de 21 pays" 
            className="w-full max-w-3xl rounded-2xl"
          />
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Wallet,
      title: "Solde en temps réel",
      description: "Consultez votre solde et vos revenus à tout moment depuis votre tableau de bord."
    },
    {
      icon: History,
      title: "Historique complet",
      description: "Retrouvez toutes vos transactions avec des détails complets et des filtres avancés."
    },
    {
      icon: ArrowDownUp,
      title: "Retraits rapides",
      description: "Retirez vos fonds vers Mobile Money ou banque de manière sécurisée."
    },
    {
      icon: CreditCard,
      title: "Frais transparents",
      description: "Aucun frais caché. Vous savez exactement ce que vous payez."
    },
    {
      icon: Link2,
      title: "Liens de paiement",
      description: "Créez des liens personnalisés avec montant fixe ou libre, fichiers PDF, date d'expiration."
    }
  ];

  return (
    <section id="features" className="py-20 lg:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-on-scroll">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Wallet sécurisé</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Un wallet sécurisé pour gérer votre argent
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tout ce dont vous avez besoin pour encaisser et gérer vos revenus
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="p-6 bg-card border-border hover-elevate transition-all duration-300 group"
              data-testid={`card-feature-${index}`}
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyAshtechSection() {
  const targetAudience = [
    { icon: Users, title: "Créateurs de contenu" },
    { icon: TrendingUp, title: "Entrepreneurs" },
    { icon: ShoppingBag, title: "E-commerçants" },
    { icon: FileText, title: "Formateurs" },
    { icon: Smartphone, title: "Freelancers" },
    { icon: Zap, title: "Startups" },
    { icon: Globe, title: "PME africaines" }
  ];

  const benefits = [
    {
      icon: Zap,
      title: "Transactions rapides",
      description: "Transferts effectués en quelques secondes, pas en jours."
    },
    {
      icon: Shield,
      title: "Sécurité renforcée",
      description: "Vos données et transactions sont protégées par un chiffrement de niveau bancaire."
    },
    {
      icon: Smartphone,
      title: "Interface moderne",
      description: "Une expérience utilisateur intuitive et agréable sur tous vos appareils."
    },
    {
      icon: Globe,
      title: "Disponible partout",
      description: "Accessible dans plus de 18 pays africains et en expansion."
    },
    {
      icon: Headphones,
      title: "Support réactif",
      description: "Notre équipe est disponible 24/7 pour répondre à vos questions."
    }
  ];

  return (
    <section className="py-20 lg:py-32 bg-card/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Pour qui ?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Pour qui est Ashtech Pay ?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Si vous vendez en ligne, Ashtech Pay est fait pour vous.
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {targetAudience.map((item, index) => (
            <div 
              key={index}
              className="flex items-center gap-3 px-6 py-3 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors"
            >
              <item.icon className="w-5 h-5 text-primary" />
              <span className="text-foreground font-medium">{item.title}</span>
            </div>
          ))}
        </div>
        
        <div className="text-center mb-12">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Pourquoi choisir Ashtech Pay ?
          </h3>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <div 
              key={index} 
              className="flex gap-4 items-start"
              data-testid={`benefit-${index}`}
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <benefit.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Créez votre lien de paiement",
      description: "Ajoutez votre produit, fixez le prix et générez un lien partageable."
    },
    {
      number: "02",
      title: "Partagez le lien",
      description: "WhatsApp, Facebook, Instagram, email ou site web."
    },
    {
      number: "03",
      title: "Encaissez instantanément",
      description: "Le client paie. L'argent arrive directement dans votre wallet."
    },
    {
      number: "04",
      title: "Retirez quand vous voulez",
      description: "Mobile Money, banque ou autre méthode locale."
    }
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-on-scroll">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            <span className="text-cyan-600">COMMENT</span> ça marche ?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Commencez à utiliser <span className="font-bold text-foreground">ASHTECH PAY</span> en <span className="font-bold">4 étapes simples</span>
          </p>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative animate-on-scroll-scale" style={{ transitionDelay: `${index * 100}ms` }} data-testid={`step-${index}`}>
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-primary/50 to-transparent -translate-x-8" />
              )}
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-primary/20">
                  <span className="text-2xl font-bold text-primary">{step.number}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const securityFeatures = [
    {
      icon: Lock,
      title: "Chiffrement SSL (HTTPS)",
      description: "Toutes les communications entre votre navigateur et nos serveurs sont chiffrées via le protocole SSL/TLS. Vos données ne peuvent pas être interceptées."
    },
    {
      icon: FileCheck,
      title: "Vérification KYC",
      description: "Chaque marchand passe par une vérification d'identité (Know Your Customer) avant activation. Seuls les utilisateurs vérifiés peuvent encaisser et retirer."
    },
    {
      icon: Shield,
      title: "Monitoring anti-fraude",
      description: "Un système de surveillance temps réel analyse chaque transaction. Toute activité anormale déclenche une alerte immédiate et un blocage préventif."
    },
    {
      icon: Zap,
      title: "Surveillance des transactions",
      description: "Chaque paiement et retrait est journalisé, horodaté et vérifié. Vous disposez d'un historique complet et immuable de toutes vos opérations."
    },
    {
      icon: Globe,
      title: "Politique AML/CFT",
      description: "Ashtech Pay applique une politique stricte de lutte contre le blanchiment de capitaux et le financement du terrorisme, conforme aux standards GAFI/FATF."
    },
    {
      icon: Headphones,
      title: "Partenaires agréés",
      description: "Nous travaillons exclusivement avec des partenaires de paiement reconnus et conformes — dont Swychr — garantissant la fiabilité de chaque transaction."
    }
  ];

  return (
    <section id="security" className="py-20 lg:py-32 bg-card/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-on-scroll">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Votre confiance est notre priorité</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            <span className="text-cyan-600">SÉCURITÉ</span> & <span className="text-cyan-600">CONFORMITÉ</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            <span className="font-bold text-foreground">ASHTECH PAY</span> applique des <span className="font-bold">standards stricts de sécurité</span> et de <span className="font-bold">conformité réglementaire</span> 
            pour protéger <span className="font-bold">chaque transaction</span> et <span className="font-bold">chaque utilisateur</span>.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {securityFeatures.map((feature, index) => (
            <Card 
              key={index} 
              className="p-6 bg-card border-border hover-elevate transition-all duration-300 group"
              data-testid={`security-${index}`}
            >
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>

        <div className="mt-12 p-6 bg-primary/5 border border-primary/20 rounded-2xl text-center animate-on-scroll">
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            La sécurité des utilisateurs et la conformité réglementaire sont au cœur de toutes nos opérations.
            {" "}<Link href="/legal" className="text-primary hover:underline font-medium">Consulter notre politique AML/CFT complète →</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-5">
            <span className="text-sm text-primary font-medium">Ce que disent nos clients</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            <span className="text-cyan-600">ILS NOUS</span> font <span className="font-bold">confiance</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Des <span className="font-bold">milliers de marchands africains</span> utilisent <span className="font-bold text-foreground">ASHTECH PAY</span> pour <span className="font-bold">encaisser et envoyer</span> de l'argent <span className="font-bold">rapidement</span>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center animate-on-scroll">
          <div className="flex justify-center">
            <img
              src="/avis-clients.jpeg"
              alt="Avis des clients Ashtech Pay"
              className="w-full max-w-md rounded-2xl shadow-2xl border border-border object-cover"
            />
          </div>
          <div className="flex justify-center">
            <img
              src="/notification-transaction.png"
              alt="Notification de transaction Ashtech Pay"
              className="w-full max-w-sm rounded-2xl shadow-2xl border border-border object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function OperatorLogosSection() {
  const operators = [
    { name: "Moov Money", src: "/op-moov.png" },
    { name: "MTN MoMo", src: "/op-mtn.jpeg" },
    { name: "TMoney", src: "/op-tmoney.jpeg" },
    { name: "Airtel Money", src: "/op-airtel.png" },
    { name: "Vodacom", src: "/op-vodacom.jpeg" },
    { name: "Wave", src: "/op-wave.png" },
    { name: "Free Money", src: "/op-freemoney.png" },
    { name: "Wizall Money", src: "/op-wizall.png" },
    { name: "Zamani", src: "/op-zamani.png" },
    { name: "SmartCash", src: "/op-smartcash.png" },
    { name: "Telecel Money", src: "/op-telecel.jpeg" },
  ];

  const duplicated = [...operators, ...operators, ...operators];

  return (
    <section className="py-14 bg-card border-y border-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Opérateurs de Mobile Money acceptés
        </p>
      </div>
      <div className="relative overflow-hidden">
        <div className="flex animate-marquee">
          {duplicated.map((op, index) => (
            <div
              key={index}
              className="flex-shrink-0 flex flex-col items-center gap-2 mx-5"
              data-testid={`operator-logo-${index}`}
            >
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border shadow-md bg-white flex items-center justify-center">
                <img
                  src={op.src}
                  alt={op.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap max-w-[88px] text-center leading-tight">
                {op.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 animate-on-scroll-scale">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-6">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-medium">Développez votre business sans frontières</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
          <span className="text-cyan-600">COMMENCEZ</span> maintenant
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Créez votre <span className="font-bold text-foreground">compte gratuitement</span> et commencez à vendre <span className="font-bold text-foreground">dès aujourd'hui</span>. Vendez <span className="font-bold">localement ou à l'international</span>, sans vous soucier des <span className="font-bold">moyens de paiement</span> ou de la <span className="font-bold">technique</span>.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="text-lg px-10 py-6" data-testid="button-cta-register">
              Créer un compte
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="text-lg px-10 py-6">
              Créer un lien de paiement
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-card border-t border-border py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-black rounded-xl px-3 py-1.5">
                <img src="/logo.png" alt="Ashtech-Pay Afrique" className="h-10 w-auto" />
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              La plateforme de liens de paiement moderne, sécurisée et accessible à tous en Afrique.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-foreground mb-4">Entreprise</h4>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-muted-foreground hover:text-foreground text-sm transition-colors">À propos</Link></li>
              <li><Link href="/careers" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Carrières</Link></li>
              <li><Link href="/blog" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Blog</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-foreground mb-4">Légal</h4>
            <ul className="space-y-2">
              <li><Link href="/terms" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Conditions d'utilisation</Link></li>
              <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Politique de confidentialité</Link></li>
              <li><Link href="/legal" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Mentions légales</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-foreground mb-4">Support</h4>
            <ul className="space-y-2">
              <li><Link href="/help" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Centre d'aide</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Contact</Link></li>
              <li><Link href="/faq" className="text-muted-foreground hover:text-foreground text-sm transition-colors">FAQ</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            © 2026 Ashtech Pay. Tous droits réservés.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://www.facebook.com/share/1Eczpeowdp/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Facebook">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Twitter">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Instagram">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <a href="https://whatsapp.com/channel/0029VbC5tPPCxoAveJ44Vs2w" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="WhatsApp">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function VideoPaymentSection() {
  const duplicatedMethods = [...paymentMethods, ...paymentMethods];
  const duplicatedCountries = [...countries, ...countries];

  return (
    <section className="bg-card border-y border-border overflow-hidden">
      <div className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <h3 className="text-center text-lg font-semibold text-foreground">
            Modes de paiement acceptés
          </h3>
        </div>
        <div className="relative overflow-hidden">
          <div className="flex animate-marquee">
            {duplicatedMethods.map((method, index) => (
              <div
                key={index}
                className="flex-shrink-0 mx-4 px-6 py-3 bg-background rounded-lg border border-border flex items-center"
              >
                <span className="text-foreground font-medium whitespace-nowrap">{method.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 mb-6">
          <h3 className="text-center text-lg font-semibold text-foreground">
            Disponible dans +18 pays africains
          </h3>
        </div>
        <div className="relative overflow-hidden">
          <div className="flex animate-marquee-reverse">
            {duplicatedCountries.map((country, index) => (
              <div
                key={index}
                className="flex-shrink-0 mx-4 px-6 py-3 bg-background rounded-lg border border-border flex items-center gap-3"
              >
                <img
                  src={`https://flagcdn.com/w40/${country.code}.png`}
                  alt={`Drapeau ${country.name}`}
                  className="w-8 h-6 rounded object-cover"
                />
                <span className="text-foreground font-medium whitespace-nowrap">{country.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  useScrollAnimation();
  
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <VideoPaymentSection />
      <OperatorLogosSection />
      <OnlineSalesSection />
      <PaymentLinksSection />
      <ShareSection />
      <WithdrawalSection />
      <GlobalReachSection />
      <FeaturesSection />
      <WhyAshtechSection />
      <HowItWorksSection />
      <SecuritySection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
