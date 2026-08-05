import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Globe, Shield, Users, Zap, Target, Heart, TrendingUp, ShoppingBag, Send, Code2, MapPin, Mail, Phone, Building2 } from "lucide-react";


const activityBreakdown = [
  { label: "E-commerce", percent: 45, color: "bg-primary" },
  { label: "Transfert d'argent", percent: 25, color: "bg-blue-500" },
  { label: "Paiement marchands", percent: 15, color: "bg-green-500" },
  { label: "Services digitaux", percent: 15, color: "bg-purple-500" },
];

const values = [
  {
    icon: Shield,
    title: "Sécurité",
    description: "La protection de vos données et de votre argent est notre priorité absolue. Nous appliquons les standards de sécurité bancaires.",
  },
  {
    icon: Zap,
    title: "Innovation",
    description: "Nous développons des solutions technologiques modernes, adaptées aux réalités et aux besoins des marchés africains.",
  },
  {
    icon: Users,
    title: "Accessibilité",
    description: "Nous rendons les paiements en ligne accessibles à tous — entrepreneurs, créateurs, PME — partout en Afrique.",
  },
  {
    icon: Heart,
    title: "Confiance",
    description: "Nous construisons des relations durables basées sur la transparence, l'intégrité et la conformité réglementaire.",
  },
];

const services = [
  {
    icon: Send,
    title: "Liens de paiement",
    description: "Créez un lien partageable en quelques secondes. Vos clients paient via Mobile Money, carte bancaire ou virement local.",
  },
  {
    icon: TrendingUp,
    title: "Transferts d'argent",
    description: "Envoyez de l'argent vers n'importe quel numéro Mobile Money dans les 22 pays couverts.",
  },
  {
    icon: Code2,
    title: "Intégration API",
    description: "Intégrez Ashtech Pay dans votre site ou application grâce à notre API sécurisée et bien documentée.",
  },
  {
    icon: ShoppingBag,
    title: "Solutions marchands",
    description: "Des outils complets pour gérer vos ventes, suivre vos transactions et retirer vos fonds facilement.",
  },
];

const partners = [
  { name: "AfribaPay & PixPay", description: "Partenaires de paiement Mobile Money pour les dépôts et les retraits." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <img src="/logo.png" alt="Ashtech-Pay Afrique" className="h-28 w-auto" />
              </div>
            </Link>
            <Link href="/">
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-16">

          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Basée à Douala, Cameroun</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">À propos de Ashtech Pay</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              La solution de paiement digitale conçue pour simplifier le commerce en ligne en Afrique
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Qui sommes-nous ?</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
              <p>
                <strong className="text-foreground">Ashtech Pay</strong> est une solution de paiement digitale basée à Douala, Cameroun, 
                développée par <strong className="text-foreground">Ashtech SARL</strong> sous la direction de son gérant, Alassa Ash.
              </p>
              <p>
                Notre mission est simple : <strong className="text-foreground">simplifier les paiements digitaux en Afrique</strong> en offrant 
                une infrastructure sécurisée, fiable et conforme aux standards internationaux. Nous permettons aux créateurs, 
                entrepreneurs et commerçants de vendre leurs produits et services en ligne, de recevoir des paiements instantanément 
                et de retirer leurs fonds via Mobile Money dans plus de 22 pays africains.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Nos services</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {services.map((service, index) => (
                <Card key={index} className="p-6 bg-card border-border">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <service.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{service.title}</h3>
                      <p className="text-muted-foreground text-sm">{service.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Répartition de nos activités</h2>
            <Card className="p-6 bg-card border-border">
              <div className="space-y-5">
                {activityBreakdown.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-foreground font-medium">{item.label}</span>
                      <span className="text-primary font-bold">{item.percent}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-3">
                      <div
                        className={`${item.color} h-3 rounded-full transition-all duration-500`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Nos valeurs</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {values.map((value, index) => (
                <Card key={index} className="p-6 bg-card border-border">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <value.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                      <p className="text-muted-foreground text-sm">{value.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Partenaires technologiques</h2>
            <p className="text-muted-foreground mb-6">
              Ashtech Pay s'appuie sur des partenaires technologiques reconnus pour assurer la fiabilité, 
              la sécurité et la conformité des transactions :
            </p>
            <div className="space-y-4">
              {partners.map((partner) => (
                <Card key={partner.name} className="p-5 bg-card border-border">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{partner.name}</p>
                      <p className="text-sm text-muted-foreground">{partner.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Notre présence</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Ashtech Pay est disponible dans plus de 22 pays africains, permettant aux vendeurs de recevoir 
              des paiements via Mobile Money (MTN, Orange, Airtel, Wave, Moov, M-Pesa...), cartes bancaires 
              (Visa, Mastercard) et autres moyens de paiement locaux.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Nous contacter</h2>
            <Card className="p-6 bg-card border-border">
              <div className="grid sm:grid-cols-3 gap-6">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Siège social</p>
                    <p className="text-foreground text-sm font-medium">Foumbot, Région Ouest, Cameroun</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                    <a href="mailto:support@ashtechpay.top" className="text-primary text-sm hover:underline">support@ashtechpay.top</a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Téléphone</p>
                    <a href="tel:+237683677872" className="text-foreground text-sm">+237 6 83 67 78 72</a>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section className="text-center pt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Rejoignez-nous</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Prêt à commencer ?</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Créez votre compte gratuitement et commencez à vendre dès aujourd'hui.
            </p>
            <Link href="/register">
              <Button size="lg" className="text-lg px-8">
                Créer un compte
              </Button>
            </Link>
          </section>

        </div>
      </main>
    </div>
  );
}
