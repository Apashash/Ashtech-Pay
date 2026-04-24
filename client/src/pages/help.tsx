import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, HelpCircle, Link2, Wallet, ArrowDownUp, Shield, CreditCard, Users } from "lucide-react";


export default function HelpPage() {
  const categories = [
    {
      icon: Link2,
      title: "Liens de paiement",
      description: "Comment créer, partager et gérer vos liens de paiement",
      articles: ["Créer un lien de paiement", "Personnaliser votre lien", "Partager votre lien"]
    },
    {
      icon: Wallet,
      title: "Wallet & Solde",
      description: "Gérer votre wallet et consulter votre solde",
      articles: ["Consulter votre solde", "Historique des transactions", "Notifications"]
    },
    {
      icon: ArrowDownUp,
      title: "Retraits",
      description: "Comment retirer vos fonds",
      articles: ["Retrait Mobile Money", "Retrait bancaire", "Délais de traitement"]
    },
    {
      icon: CreditCard,
      title: "Paiements",
      description: "Moyens de paiement acceptés et traitement",
      articles: ["Mobile Money", "Cartes bancaires", "Frais de transaction"]
    },
    {
      icon: Shield,
      title: "Sécurité",
      description: "Protéger votre compte et vos transactions",
      articles: ["Sécuriser votre compte", "Vérification KYC", "Signaler un problème"]
    },
    {
      icon: Users,
      title: "Compte",
      description: "Gérer votre profil et vos paramètres",
      articles: ["Modifier votre profil", "Changer de mot de passe", "Supprimer votre compte"]
    }
  ];

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
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
              <HelpCircle className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Support</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Centre d'aide</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Trouvez rapidement des réponses à vos questions
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {categories.map((category, index) => (
              <Card key={index} className="p-6 bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <category.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{category.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{category.description}</p>
                <ul className="space-y-2">
                  {category.articles.map((article, i) => (
                    <li key={i} className="text-sm text-primary hover:underline cursor-pointer">
                      {article}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <div className="bg-card/50 rounded-2xl border border-border p-8 text-center">
            <h3 className="text-xl font-semibold text-foreground mb-4">Vous n'avez pas trouvé de réponse ?</h3>
            <p className="text-muted-foreground mb-6">
              Notre équipe de support est là pour vous aider
            </p>
            <Link href="/contact">
              <Button>
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
