import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";


export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <img src="/logo.png" alt="Ashtech-Pay Afrique" className="h-20 w-auto" />
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
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">Conditions d'utilisation</h1>
          
          <div className="prose prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">1. Acceptation des conditions</h2>
              <p className="text-muted-foreground">
                En accédant et en utilisant la plateforme Ashtech Pay, vous acceptez d'être lié par les présentes conditions d'utilisation. 
                Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">2. Description des services</h2>
              <p className="text-muted-foreground">
                Ashtech Pay est une plateforme de paiement en ligne permettant aux utilisateurs de créer des liens de paiement, 
                recevoir des paiements via Mobile Money et cartes bancaires, et gérer leurs transactions financières.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">3. Inscription et compte</h2>
              <p className="text-muted-foreground">
                Pour utiliser nos services, vous devez créer un compte en fournissant des informations exactes et complètes. 
                Vous êtes responsable de la confidentialité de vos identifiants de connexion et de toutes les activités effectuées sous votre compte.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">4. Utilisation autorisée</h2>
              <p className="text-muted-foreground">
                Vous vous engagez à utiliser Ashtech Pay uniquement à des fins légales et conformément aux lois applicables. 
                Toute utilisation frauduleuse, illégale ou abusive est strictement interdite et peut entraîner la suspension de votre compte.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">5. Frais et commissions</h2>
              <p className="text-muted-foreground">
                Les frais applicables aux transactions sont clairement indiqués avant chaque opération. 
                Ashtech Pay se réserve le droit de modifier ses tarifs avec un préavis raisonnable.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">6. Limitation de responsabilité</h2>
              <p className="text-muted-foreground">
                Ashtech Pay ne peut être tenu responsable des dommages indirects, pertes de données ou interruptions de service 
                résultant de l'utilisation de la plateforme, sauf en cas de faute grave de notre part.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">7. Modification des conditions</h2>
              <p className="text-muted-foreground">
                Nous nous réservons le droit de modifier ces conditions à tout moment. 
                Les utilisateurs seront informés des changements significatifs par email ou notification sur la plateforme.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">8. Contact</h2>
              <p className="text-muted-foreground">
                Pour toute question concernant ces conditions, veuillez nous contacter via notre page de contact.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
