import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Globe, Shield, Users, Zap, Target, Heart } from "lucide-react";
import logoImage from "@assets/logo.png";

export default function AboutPage() {
  const values = [
    {
      icon: Shield,
      title: "Sécurité",
      description: "La protection de vos données et de votre argent est notre priorité absolue."
    },
    {
      icon: Zap,
      title: "Innovation",
      description: "Nous développons des solutions technologiques adaptées aux besoins africains."
    },
    {
      icon: Users,
      title: "Accessibilité",
      description: "Nous rendons les paiements en ligne accessibles à tous, partout en Afrique."
    },
    {
      icon: Heart,
      title: "Confiance",
      description: "Nous construisons des relations durables basées sur la transparence et l'intégrité."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <img src={logoImage} alt="Ashtech-Pay Afrique" className="h-14 w-auto" />
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Notre histoire</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">À propos de Ashtech Pay</h1>
            <p className="text-lg text-muted-foreground">
              La plateforme de paiement conçue pour l'Afrique
            </p>
          </div>

          <div className="space-y-12">
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Notre mission</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Ashtech Pay a été créé avec une vision simple : permettre à chaque entrepreneur, créateur et commerçant africain 
                de vendre en ligne et de recevoir des paiements facilement, sans barrières techniques ni frontières géographiques.
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mt-4">
                Nous croyons que le commerce en ligne doit être accessible à tous, que vous vendiez des formations, 
                des produits artisanaux, des services ou des biens physiques. C'est pourquoi nous avons développé 
                une solution de liens de paiement simple, sécurisée et adaptée aux réalités africaines.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Notre vision</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Devenir la référence des paiements en ligne en Afrique, en connectant des millions de vendeurs 
                à leurs clients à travers le continent et au-delà. Nous voulons contribuer à l'essor de l'économie 
                numérique africaine en offrant des outils financiers modernes et accessibles.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-8">Nos valeurs</h2>
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
              <h2 className="text-2xl font-bold text-foreground mb-4">Notre présence</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Ashtech Pay est présent dans plus de 18 pays africains, permettant aux vendeurs de recevoir 
                des paiements via Mobile Money (MTN, Orange, Airtel, Wave, Moov, M-Pesa...), cartes bancaires 
                (Visa, Mastercard) et autres moyens de paiement locaux.
              </p>
            </section>

            <section className="text-center pt-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary font-medium">Rejoignez-nous</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Prêt à commencer ?</h2>
              <p className="text-muted-foreground mb-6">
                Créez votre compte gratuitement et commencez à vendre dès aujourd'hui.
              </p>
              <Link href="/register">
                <Button size="lg" className="text-lg px-8">
                  Créer un compte
                </Button>
              </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
