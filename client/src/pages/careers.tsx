import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Briefcase, MapPin, Clock, Users, Zap, Heart, Globe } from "lucide-react";
import logoImage from "@assets/logo.png";

export default function CareersPage() {
  const benefits = [
    { icon: Globe, title: "Travail à distance", description: "Travaillez de n'importe où en Afrique" },
    { icon: Users, title: "Équipe internationale", description: "Collaborez avec des talents de tout le continent" },
    { icon: Zap, title: "Innovation", description: "Travaillez sur des projets à fort impact" },
    { icon: Heart, title: "Culture inclusive", description: "Un environnement de travail bienveillant" }
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
              <Briefcase className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Rejoignez l'équipe</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Carrières chez Ashtech Pay</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Construisez l'avenir des paiements en Afrique avec nous. Nous recherchons des talents passionnés 
              pour rejoindre notre mission.
            </p>
          </div>

          <section className="mb-16">
            <h2 className="text-2xl font-bold text-foreground mb-8 text-center">Pourquoi nous rejoindre ?</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index} className="p-6 bg-card border-border">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{benefit.title}</h3>
                      <p className="text-muted-foreground text-sm">{benefit.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-8 text-center">Offres d'emploi</h2>
            
            <div className="bg-card/50 rounded-2xl border border-border p-12 text-center">
              <Briefcase className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-4">Aucune offre disponible actuellement</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Nous n'avons pas de postes ouverts pour le moment, mais nous sommes toujours à la recherche de talents exceptionnels.
              </p>
              <p className="text-muted-foreground">
                Envoyez votre candidature spontanée à notre page de contact.
              </p>
              <Link href="/contact">
                <Button className="mt-6">
                  Nous contacter
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
