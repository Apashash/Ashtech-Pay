import { Link } from "wouter";
import { Button } from "@/components/ui/button";
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
  Code2,
  Terminal,
  FlaskConical,
  Scale,
  HelpCircle,
  Mail,
  MessageCircleQuestion,
  LogOut,
  Download,
  ExternalLink
} from "lucide-react";
import heroPaymentImage from "@assets/file_00000000b290820e8318daa118934236_1788747702718.png";
import marketPaymentImage from "@assets/images_(1)~2_1788747988443.jpeg";
import commercePaymentImage from "@assets/barkapay-african-payment-hub-for-e-commerce_1788747792967.webp";
import { useState, useEffect, useRef, type PointerEvent, type RefObject } from "react";
import { useTheme } from "@/components/theme-provider";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { useLanguage } from "@/lib/language";
import { LanguageSwitcher } from "@/components/language-switcher";

const countryList = [
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
  { name: "Madagascar", code: "mg" },
  { name: "Maroc", code: "ma" },
  { name: "Tunisie", code: "tn" },
  { name: "Algérie", code: "dz" },
];

function useMarqueeScroll(
  containerRef: RefObject<HTMLDivElement | null>,
  pixelsPerSecond: number,
  loopDivisions: number,
  direction = 1,
) {
  const dragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrame = 0;
    let previousTime = performance.now();
    const loopWidth = container.scrollWidth / loopDivisions;
    if (direction < 0 && container.scrollLeft === 0) {
      container.scrollLeft = loopWidth;
    }

    const animate = (currentTime: number) => {
      const elapsed = Math.min(currentTime - previousTime, 50);
      previousTime = currentTime;

      if (!dragRef.current.active && container.scrollWidth > container.clientWidth) {
        container.scrollLeft += (direction * pixelsPerSecond * elapsed) / 1000;
        if (direction > 0 && container.scrollLeft >= loopWidth) {
          container.scrollLeft -= loopWidth;
        } else if (direction < 0 && container.scrollLeft <= 0) {
          container.scrollLeft += loopWidth;
        }
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [containerRef, direction, loopDivisions, pixelsPerSecond]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    dragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || !dragRef.current.active) return;
    container.scrollLeft = dragRef.current.startScrollLeft - (event.clientX - dragRef.current.startX);
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return { onPointerDown, onPointerMove, onPointerUp: stopDragging, onPointerCancel: stopDragging };
}

function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuGroups = [
    {
      title: t.nav.resources,
      items: [
        { label: t.nav.help, href: "/help", icon: HelpCircle },
        { label: t.nav.faq, href: "/faq", icon: MessageCircleQuestion },
        { label: t.nav.blog, href: "/blog", icon: BookOpen },
        { label: t.nav.contact, href: "/contact", icon: Mail },
        { label: t.nav.apiDocs, href: "/docs/api", icon: Terminal },
        { label: t.nav.hostedDocs, href: "/docs/hosted-page", icon: Code2 },
      ],
    },
    {
      title: t.nav.about,
      items: [
        { label: t.nav.about_link, href: "/about", icon: Info },
        { label: t.nav.careers, href: "/careers", icon: Briefcase },
      ],
    },
    {
      title: t.nav.legal,
      items: [
        { label: "Conditions d'utilisation", href: "/terms", icon: Scale },
      ],
    },
  ];
  
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Logo row */}
          <div className="flex items-center justify-between h-14">
            <Link href="/">
              <img src="/logo-compact.png" alt="AshTech Pay" className="h-12 w-auto" />
            </Link>
            <div className="flex items-center gap-1">
              <div className="hidden lg:flex items-center gap-2 mr-2">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="w-44 rounded-full gap-1.5 border-border text-foreground hover:border-primary hover:text-primary" data-testid="button-nav-login-desktop">
                    <LogIn className="w-3.5 h-3.5" />
                    {t.nav.login}
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button size="sm" className="w-44 rounded-full gap-1.5" data-testid="button-nav-contact-desktop">
                    <Mail className="w-3.5 h-3.5" />
                    {t.nav.contact}
                  </Button>
                </Link>
              </div>
              <LanguageSwitcher />
              <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-accent transition-colors" aria-label="Changer de thème" data-testid="button-theme-toggle">
                {theme === "dark" ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
              </button>
              <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-accent transition-all duration-300" aria-label="Menu" data-testid="button-hamburger-menu">
                <Menu className={`w-6 h-6 text-foreground transition-transform duration-300 ${menuOpen ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>
          {/* CTA buttons row */}
          <div className="flex gap-2 pb-2.5 justify-center sm:justify-end lg:hidden">
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-44 rounded-full gap-1.5 border-border text-foreground hover:border-primary hover:text-primary" data-testid="button-nav-login">
                <LogIn className="w-3.5 h-3.5" />
                {t.nav.login}
              </Button>
            </Link>
            <Link href="/contact" className="w-full sm:w-auto">
              <Button size="sm" className="w-full sm:w-44 rounded-full gap-1.5" data-testid="button-nav-contact">
                <Mail className="w-3.5 h-3.5" />
                {t.nav.contact}
              </Button>
            </Link>
          </div>
        </div>
      </nav>
      
      {menuOpen && (
        <div className="fixed inset-0 z-[60] animate-in fade-in duration-300" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300" />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-base text-foreground">{t.nav.menu}</span>
              <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-accent transition-colors" aria-label={t.nav.close}>
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>
            {/* Account shortcuts */}
            <div className="p-3 pb-2 flex gap-2 border-b border-border">
              <Link href="/login" className="flex-1">
                <button onClick={() => setMenuOpen(false)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors text-sm text-foreground">
                  <LogIn className="w-4 h-4 text-primary" />
                  {t.nav.login}
                </button>
              </Link>
              <Link href="/register" className="flex-1">
                <button onClick={() => setMenuOpen(false)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium">
                  <UserPlus className="w-4 h-4" />
                  {t.nav.register}
                </button>
              </Link>
            </div>
            <div className="p-3 space-y-3">
              {menuGroups.map((group) => (
                <div key={group.title}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">{group.title}</p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href}>
                        <button onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left">
                          <item.icon className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-sm text-foreground">{item.label}</span>
                        </button>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HeroSection() {
  const { t } = useLanguage();
  return (
    <section className="pt-32 pb-16 overflow-x-hidden bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] gap-12 xl:gap-20 items-center">
          <div className="text-center lg:text-left min-w-0 animate-on-scroll">
            <h1 className="text-4xl sm:text-5xl lg:text-5xl font-extrabold text-foreground leading-tight mb-6">
              {t.hero.title1}{" "}
              <span className="text-primary">{t.hero.title2}</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground mb-6 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              <span className="font-bold text-foreground">ASHTECH PAY</span>{t.hero.desc}
            </p>

            <div className="space-y-2.5 text-left max-w-sm mx-auto lg:mx-0 mb-8">
              {[t.hero.bullet1, t.hero.bullet2, t.hero.bullet3].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-muted-foreground">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 max-w-xs mx-auto lg:mx-0">
              <Link href="/register" className="w-full">
                <Button size="lg" className="w-full rounded-full text-base font-semibold py-5" data-testid="button-hero-register">
                  {t.hero.cta}
                </Button>
              </Link>
              <Link href="/login" className="w-full">
                <Button size="lg" variant="outline" className="w-full rounded-full text-base font-semibold py-5" data-testid="button-hero-login">
                  {t.hero.ctaLogin}
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative mt-10 lg:mt-0 w-full max-w-xl mx-auto group animate-on-scroll-right">
            <div className="absolute -inset-3 rounded-[2rem] bg-primary/10 blur-2xl transition-opacity duration-500 group-hover:opacity-80" />
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl">
              <img
                src={heroPaymentImage}
                alt="AshTech Pay, une plateforme connectée aux paiements africains"
                className="block w-full aspect-[1752/898] object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SolutionsSection() {
  const solutions = [
    {
      icon: LogIn,
      badge: { label: "TOP", color: "bg-primary text-primary-foreground" },
      title: "Ashtech Pay-IN",
      description:
        "Ashtech Pay-IN ou Paiement Marchand : une plateforme de paiement sécurisée et simple, spécialement conçue pour répondre aux besoins des particuliers et des entreprises en matière de paiements en ligne.",
      link: "/register",
    },
    {
      icon: LogOut,
      badge: null,
      title: "Ashtech Pay-OUT",
      description:
        "Ashtech Pay-OUT ou Décaissements Mobile Money vous permet d'effectuer des paiements de masse ou des décaissements en ligne en toute sécurité et simplicité, à destination de vos clients, fournisseurs, salariés et autres bénéficiaires.",
      link: "/register",
    },
    {
      icon: Download,
      badge: { label: "EXCLUSIF", color: "bg-slate-800 text-white" },
      title: "Ashtech Pay-Link",
      description:
        "Ashtech Pay-Link vous permet de créer des liens de paiement en ligne de manière sécurisée et simple. Partagez-les sur WhatsApp, Facebook, Instagram ou par SMS et encaissez instantanément.",
      link: "/register",
    },
  ];

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 animate-on-scroll">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Nos solutions</h2>
          <p className="text-muted-foreground text-base">Tout ce dont vous avez besoin pour vendre et encaisser en ligne en Afrique.</p>
        </div>
        <div className="flex flex-col gap-6">
          {solutions.map(({ icon: Icon, badge, title, description, link }, index) => (
            <div key={title} className="relative bg-card border border-border rounded-2xl p-7 shadow-sm hover:shadow-md transition-shadow animate-on-scroll-scale" style={{ transitionDelay: `${index * 70}ms` }}>
              {badge && (
                <span className={`absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full ${badge.color}`}>
                  {badge.label}
                </span>
              )}
              <Icon className="w-10 h-10 text-foreground mb-5" strokeWidth={1.5} />
              <h3 className="text-xl font-bold text-foreground mb-3">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">{description}</p>
              <Link href={link}>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary border-b-2 border-primary pb-0.5 hover:opacity-75 transition-opacity">
                  En savoir plus <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommerceVisualSection() {
  return (
    <section className="py-16 lg:py-24 bg-card/50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-10 lg:gap-16 items-center">
          <div className="order-2 lg:order-1 animate-on-scroll-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-5">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Le commerce africain, connecté</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-5">
              Une passerelle simple entre vos clients et leurs moyens de paiement
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
              Proposez une expérience de paiement claire et familière, du Mobile Money aux cartes bancaires, avec une infrastructure pensée pour les réalités du marché africain.
            </p>
          </div>
          <div className="order-1 lg:order-2 relative group animate-on-scroll-right">
            <div className="absolute -inset-3 rounded-3xl bg-primary/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-border bg-background shadow-xl">
              <img
                src={commercePaymentImage}
                alt="Paiements en ligne et commerce africain"
                className="block w-full aspect-[1024/576] object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const { t } = useLanguage();
  const features = [
    { icon: Wallet, title: t.landing.feature1title, description: t.landing.feature1desc },
    { icon: History, title: t.landing.feature2title, description: t.landing.feature2desc },
    { icon: ArrowDownUp, title: t.landing.feature3title, description: t.landing.feature3desc },
    { icon: CreditCard, title: t.landing.feature4title, description: t.landing.feature4desc },
    { icon: Link2, title: t.landing.feature5title, description: t.landing.feature5desc },
  ];

  return (
    <section id="features" className="py-20 lg:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-on-scroll">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">{t.landing.walletTag}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{t.landing.walletTitle}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t.landing.walletDesc}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
            <div key={index} className="p-6 bg-card border border-border rounded-2xl hover:border-primary/40 hover:shadow-md transition-all duration-300 group animate-on-scroll-scale" style={{ transitionDelay: `${index * 70}ms` }} data-testid={`card-feature-${index}`}>
              <div className="w-14 h-14 bg-background border-2 border-border rounded-full flex items-center justify-center mb-5 group-hover:border-primary/50 transition-colors">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyAshtechSection() {
  const { t } = useLanguage();
  const targetAudience = [
    { icon: Users, title: t.landing.audience1 },
    { icon: TrendingUp, title: t.landing.audience2 },
    { icon: ShoppingBag, title: t.landing.audience3 },
    { icon: FileText, title: t.landing.audience4 },
    { icon: Smartphone, title: t.landing.audience5 },
    { icon: Zap, title: t.landing.audience6 },
    { icon: Globe, title: t.landing.audience7 },
  ];
  const benefits = [
    { icon: Zap, title: t.landing.benefit1title, description: t.landing.benefit1desc },
    { icon: Shield, title: t.landing.benefit2title, description: t.landing.benefit2desc },
    { icon: Smartphone, title: t.landing.benefit3title, description: t.landing.benefit3desc },
    { icon: Globe, title: t.landing.benefit4title, description: t.landing.benefit4desc },
    { icon: Headphones, title: t.landing.benefit5title, description: t.landing.benefit5desc },
  ];

  return (
    <section className="py-20 lg:py-32 bg-card/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-on-scroll">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">{t.landing.whyTag}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{t.landing.whyTitle}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t.landing.whyDesc}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mb-16">
            {targetAudience.map((item, index) => (
            <div key={index} className="flex items-center gap-2.5 px-5 py-2.5 bg-card rounded-full border border-border hover:border-primary/50 hover:shadow-sm transition-all animate-on-scroll-scale" style={{ transitionDelay: `${index * 45}ms` }}>
              <item.icon className="w-4 h-4 text-primary" />
              <span className="text-foreground text-sm font-semibold">{item.title}</span>
            </div>
          ))}
        </div>
        <div className="text-center mb-12 animate-on-scroll">
          <h3 className="text-2xl font-bold text-foreground mb-4">{t.landing.whyChooseTitle}</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
            <div key={index} className="flex gap-4 items-start animate-on-scroll-right" style={{ transitionDelay: `${index * 60}ms` }} data-testid={`benefit-${index}`}>
              <div className="w-12 h-12 bg-background border-2 border-border rounded-full flex items-center justify-center flex-shrink-0 shrink-0">
                <benefit.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground mb-1">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const { t } = useLanguage();
  const steps = [
    { number: "01", title: t.landing.step1title, description: t.landing.step1desc },
    { number: "02", title: t.landing.step2title, description: t.landing.step2desc },
    { number: "03", title: t.landing.step3title, description: t.landing.step3desc },
    { number: "04", title: t.landing.step4title, description: t.landing.step4desc },
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-on-scroll">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            <span className="text-primary">{t.landing.howTitle1}</span> {t.landing.howTitle2}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.landing.howDescPre}<span className="font-bold text-foreground">ASHTECH PAY</span>{t.landing.howDescPost}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
            <div key={index} className="relative animate-on-scroll-scale" style={{ transitionDelay: `${index * 70}ms` }} data-testid={`step-${index}`}>
              {index < steps.length - 1 && <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-primary/50 to-transparent -translate-x-8" />}
              <div className="text-center">
                <div className="w-16 h-16 bg-background border-2 border-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-extrabold text-primary">{step.number}</span>
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketVisualSection() {
  return (
    <section className="py-16 lg:py-24 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-10 lg:gap-16 items-center">
          <div className="relative max-w-xl mx-auto w-full group animate-on-scroll-left">
            <div className="absolute -inset-3 rounded-3xl bg-primary/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
              <img
                src={marketPaymentImage}
                alt="Une utilisatrice africaine effectue un paiement mobile"
                className="block w-full aspect-square object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            </div>
          </div>
          <div className="animate-on-scroll-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-5">
              <Smartphone className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Une expérience pensée pour le mobile</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-5">
              Des paiements qui inspirent confiance
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
              Offrez à vos clients une expérience fluide, accessible et adaptée à leurs habitudes, quel que soit le pays ou le moyen de paiement choisi.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const { t } = useLanguage();
  const securityFeatures = [
    { icon: Lock, title: t.landing.sec1title, description: t.landing.sec1desc },
    { icon: FileCheck, title: t.landing.sec2title, description: t.landing.sec2desc },
    { icon: Shield, title: t.landing.sec3title, description: t.landing.sec3desc },
    { icon: Zap, title: t.landing.sec4title, description: t.landing.sec4desc },
    { icon: Globe, title: t.landing.sec5title, description: t.landing.sec5desc },
    { icon: Headphones, title: t.landing.sec6title, description: t.landing.sec6desc },
  ];

  return (
    <section id="security" className="py-20 lg:py-32 bg-slate-900 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-on-scroll">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-full border border-primary/30 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">{t.landing.secTag}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            <span className="text-primary">{t.landing.secTitle1}</span> & <span className="text-primary">{t.landing.secTitle2}</span>
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            <span className="font-bold text-white">ASHTECH PAY</span> {t.landing.secDesc}
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityFeatures.map((feature, index) => (
            <div key={index} className="p-6 bg-slate-800/60 border border-slate-700 rounded-2xl hover:border-primary/50 transition-all duration-300 group animate-on-scroll-scale" style={{ transitionDelay: `${index * 60}ms` }} data-testid={`security-${index}`}>
              <div className="w-14 h-14 bg-primary/15 border border-primary/30 rounded-full flex items-center justify-center mb-5 group-hover:bg-primary/25 transition-colors">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 p-6 bg-primary/10 border border-primary/30 rounded-2xl text-center animate-on-scroll">
          <p className="text-slate-300 text-sm max-w-2xl mx-auto">
            {t.landing.secNote}{" "}
            <Link href="/legal" className="text-primary hover:underline font-medium">{t.landing.secLink}</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const { t } = useLanguage();
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 animate-on-scroll">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-5">
            <span className="text-sm text-primary font-medium">{t.landing.testimonialsTag}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            <span className="text-primary">{t.landing.testimonialsTitle1}</span> {t.landing.testimonialsTitle2}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t.landing.testimonialsDesc}</p>
        </div>
      </div>
    </section>
  );
}

function CountriesSection() {
  const { t } = useLanguage();
  const duplicatedCountries = [...countryList, ...countryList];
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollHandlers = useMarqueeScroll(containerRef, 105, 2, -1);

  return (
    <section className="bg-card border-y border-border overflow-hidden">
      <div className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <h3 className="text-center text-lg font-semibold text-foreground animate-on-scroll">{t.landing.countriesTitle}</h3>
        </div>
        <div
          ref={containerRef}
          className="relative overflow-x-auto overflow-y-hidden select-none cursor-grab active:cursor-grabbing touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden animate-on-scroll-right"
          aria-label="Faire défiler les pays disponibles"
          {...scrollHandlers}
        >
          <div className="flex w-max">
            {duplicatedCountries.map((country, index) => (
              <div key={index} className="flex-shrink-0 mx-4 px-6 py-3 bg-background rounded-lg border border-border flex items-center gap-3">
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

function OperatorLogosSection() {
  const { t } = useLanguage();
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
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollHandlers = useMarqueeScroll(containerRef, 120, 3);

  return (
    <section className="py-14 bg-card border-y border-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground animate-on-scroll">{t.landing.operatorsTitle}</p>
      </div>
      <div
        ref={containerRef}
        className="relative overflow-x-auto overflow-y-hidden select-none cursor-grab active:cursor-grabbing touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden animate-on-scroll-left"
        aria-label="Faire défiler les opérateurs Mobile Money"
        {...scrollHandlers}
      >
        <div className="flex w-max">
          {duplicated.map((op, index) => (
            <div key={index} className="flex-shrink-0 flex flex-col items-center gap-2 mx-5" data-testid={`operator-logo-${index}`}>
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border shadow-md bg-white flex items-center justify-center">
                <img src={op.src} alt={op.name} className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap max-w-[88px] text-center leading-tight">{op.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ApiDeveloperSection() {
  const { t } = useLanguage();
  const apiItems = [t.landing.apiItem1, t.landing.apiItem2, t.landing.apiItem3, t.landing.apiItem4];
  const stats = [
    { label: "22 pays", sub: t.landing.apiStat1sub },
    { label: "< 500ms", sub: t.landing.apiStat2sub },
    { label: "99.9%", sub: t.landing.apiStat3sub },
    { label: "Webhooks", sub: t.landing.apiStat4sub },
  ];

  return (
    <section className="py-20 lg:py-32 bg-card/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center min-w-0">
          <div className="animate-on-scroll min-w-0 w-full">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-6">
              <Code2 className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">{t.landing.apiTag}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              <span className="text-primary">{t.landing.apiTitle1}</span> {t.landing.apiTitle2}
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{t.landing.apiDesc}</p>
            <ul className="space-y-3 mb-8">
              {apiItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ChevronRight className="w-3 h-3 text-primary" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/docs/api">
                <Button size="lg" className="gap-2" data-testid="button-api-docs">
                  <BookOpen className="w-4 h-4" />
                  {t.landing.apiBtn1}
                </Button>
              </Link>
              <Link href="/docs/hosted-page">
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-api-hosted-docs">
                  <Globe className="w-4 h-4" />
                  {t.landing.apiBtn2}
                </Button>
              </Link>
            </div>
          </div>

          <div className="animate-on-scroll-right min-w-0 w-full max-w-full">
            <div className="rounded-2xl overflow-hidden border border-border shadow-xl min-w-0 max-w-full">
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-xs text-zinc-400 ml-2 flex items-center gap-1.5"><Terminal className="w-3 h-3" />collect.js</span>
              </div>
              <pre className="text-sm leading-relaxed p-6 bg-zinc-950 overflow-x-auto max-w-full whitespace-pre-wrap break-words text-left font-mono">
                <span className="text-sky-400">const</span>
                <span className="text-zinc-300"> response = </span>
                <span className="text-amber-300">await</span>
                <span className="text-zinc-300"> fetch({"\n"}  </span>
                <span className="text-green-400">"https://api.ashtechpay.top/v1/collect"</span>
                <span className="text-zinc-300">,{"\n"}  {"{"}{"\n"}    method: </span>
                <span className="text-green-400">"POST"</span>
                <span className="text-zinc-300">,{"\n"}    headers: {"{"}{"\n"}      </span>
                <span className="text-green-400">"Authorization"</span>
                <span className="text-zinc-300">: </span>
                <span className="text-green-400">"Bearer ak_live_…"</span>
                <span className="text-zinc-300">,{"\n"}      </span>
                <span className="text-green-400">"Content-Type"</span>
                <span className="text-zinc-300">: </span>
                <span className="text-green-400">"application/json"</span>
                <span className="text-zinc-300">{"\n"}    {"}"},{"\n"}    body: JSON.stringify({"{"}{"\n"}      amount:    </span>
                <span className="text-violet-400">5000</span>
                <span className="text-zinc-300">,{"\n"}      currency:  </span>
                <span className="text-green-400">"XAF"</span>
                <span className="text-zinc-300">,{"\n"}      phone:     </span>
                <span className="text-green-400">"670000000"</span>
                <span className="text-zinc-300">,{"\n"}      operator:  </span>
                <span className="text-green-400">"MTN"</span>
                <span className="text-zinc-300">,{"\n"}      reference: </span>
                <span className="text-green-400">"ORDER-123"</span>
                <span className="text-zinc-300">{"\n"}    {"}"}){"\n"}  {"}"}{"\n"});</span>
              </pre>
              <div className="px-6 py-4 bg-zinc-900 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400 font-mono">{t.landing.apiResponse}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 min-w-0 w-full">
              {stats.map(({ label, sub }, index) => (
                <div key={label} className="rounded-xl border bg-card px-4 py-3 text-center animate-on-scroll-scale" style={{ transitionDelay: `${index * 60}ms` }}>
                  <p className="text-lg font-bold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function useCountUp(target: number, duration: number, started: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!started) return;
    setCount(0);
    const steps = 60;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      const progress = current / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (current >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [started, target, duration]);
  return count;
}

function AnimatedStat({ target, suffix, label, started }: { target: number; suffix: string; label: string; started: boolean }) {
  const count = useCountUp(target, 1400, started);
  const formatted = count >= 1000 ? count.toLocaleString("fr-FR") : count.toString();
  return (
    <div className="text-center">
      <p className="text-4xl sm:text-5xl font-extrabold text-foreground leading-none">
        {formatted}<span className="text-primary">{suffix}</span>
      </p>
      <p className="mt-2 text-sm sm:text-base font-semibold text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

function ReadyToStartSection() {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setStarted(true); observer.disconnect(); } }, { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stats = [
    { target: 50000, suffix: "+", label: t.landing.stat1label },
    { target: 100,   suffix: "+", label: t.landing.stat2label },
    { target: 30,    suffix: "+", label: t.landing.stat3label },
    { target: 22,    suffix: "+", label: t.landing.stat4label },
  ];

  return (
    <section ref={sectionRef} className="py-20 lg:py-28 bg-background relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, #1e3a8a 1px, transparent 1px)`, backgroundSize: "28px 28px" }} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-5 leading-tight">{t.landing.statTitle}</h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-14 leading-relaxed">{t.landing.statDesc}</p>
        <div className="grid grid-cols-2 gap-8 sm:gap-12 max-w-xl mx-auto">
          {stats.map((stat) => (
            <AnimatedStat key={stat.label} target={stat.target} suffix={stat.suffix} label={stat.label} started={started} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const { t } = useLanguage();
  return (
    <section className="py-20 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 animate-on-scroll-scale">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-6">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-medium">{t.landing.ctaTag2}</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
          <span className="text-primary">{t.landing.ctaTitle1}</span> {t.landing.ctaTitle2}
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">{t.landing.ctaDesc}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="text-lg px-10 py-6" data-testid="button-cta-register">
              {t.landing.ctaBtn2}
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="text-lg px-10 py-6">
              {t.landing.ctaBtn3}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-card border-t border-border py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-3">
            <img src="/logo.png" alt="AshTech Pay" className="h-24 w-auto" />
          </div>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto sm:mx-0">{t.landing.footerDesc}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:gap-8 lg:gap-12 mb-10">
          <div>
            <h4 className="font-semibold text-foreground mb-3 sm:mb-4 text-xs sm:text-sm uppercase tracking-wider">{t.landing.footerCol1}</h4>
            <ul className="space-y-2 sm:space-y-3">
              <li><Link href="/about" className="text-muted-foreground hover:text-primary text-xs sm:text-sm transition-colors">{t.landing.footerAbout}</Link></li>
              <li><Link href="/careers" className="text-muted-foreground hover:text-primary text-xs sm:text-sm transition-colors">{t.landing.footerCareers}</Link></li>
              <li><Link href="/blog" className="text-muted-foreground hover:text-primary text-xs sm:text-sm transition-colors">{t.landing.footerBlog}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3 sm:mb-4 text-xs sm:text-sm uppercase tracking-wider">{t.landing.footerCol2}</h4>
            <ul className="space-y-2 sm:space-y-3">
              <li><Link href="/help" className="text-muted-foreground hover:text-primary text-xs sm:text-sm transition-colors">{t.landing.footerHelp}</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-primary text-xs sm:text-sm transition-colors">{t.landing.footerContact}</Link></li>
              <li><Link href="/faq" className="text-muted-foreground hover:text-primary text-xs sm:text-sm transition-colors">{t.landing.footerFaq}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3 sm:mb-4 text-xs sm:text-sm uppercase tracking-wider">{t.landing.footerCol3}</h4>
            <ul className="space-y-2 sm:space-y-3">
              <li><Link href="/terms" className="text-muted-foreground hover:text-primary text-xs sm:text-sm transition-colors">Conditions d'utilisation</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <a href="https://www.facebook.com/share/1Eczpeowdp/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" aria-label="Facebook">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="https://www.linkedin.com/in/ashtech-pay-071290242?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" aria-label="LinkedIn">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://whatsapp.com/channel/0029VbC5tPPCxoAveJ44Vs2w" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" aria-label="WhatsApp">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
          </div>
          <p className="text-muted-foreground text-xs text-center">{t.landing.footerCopyright}</p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  useScrollAnimation();
  
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <ReadyToStartSection />
      <CountriesSection />
      <SolutionsSection />
      <CommerceVisualSection />
      <OperatorLogosSection />
      <FeaturesSection />
      <WhyAshtechSection />
      <HowItWorksSection />
      <MarketVisualSection />
      <SecuritySection />
      <ApiDeveloperSection />
      <Footer />
    </div>
  );
}
