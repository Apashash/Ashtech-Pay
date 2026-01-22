import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import logoImage from "@assets/logo.png";

export default function PrivacyPage() {
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
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">Politique de confidentialité</h1>
          
          <div className="prose prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">1. Collecte des données</h2>
              <p className="text-muted-foreground">
                Nous collectons les informations que vous nous fournissez lors de votre inscription et de l'utilisation de nos services : 
                nom, prénom, adresse email, numéro de téléphone, informations de paiement et données de transaction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">2. Utilisation des données</h2>
              <p className="text-muted-foreground">
                Vos données sont utilisées pour :
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Fournir et améliorer nos services</li>
                <li>Traiter vos transactions</li>
                <li>Communiquer avec vous concernant votre compte</li>
                <li>Assurer la sécurité de la plateforme</li>
                <li>Respecter nos obligations légales</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">3. Protection des données</h2>
              <p className="text-muted-foreground">
                Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données 
                contre tout accès non autorisé, modification, divulgation ou destruction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">4. Partage des données</h2>
              <p className="text-muted-foreground">
                Nous ne vendons pas vos données personnelles. Nous pouvons partager vos informations avec :
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Nos partenaires de paiement pour traiter les transactions</li>
                <li>Les autorités compétentes en cas d'obligation légale</li>
                <li>Nos prestataires de services sous contrat de confidentialité</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">5. Vos droits</h2>
              <p className="text-muted-foreground">
                Vous disposez des droits suivants concernant vos données personnelles :
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Droit d'accès à vos données</li>
                <li>Droit de rectification</li>
                <li>Droit à l'effacement</li>
                <li>Droit à la portabilité</li>
                <li>Droit d'opposition</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">6. Cookies</h2>
              <p className="text-muted-foreground">
                Nous utilisons des cookies pour améliorer votre expérience sur notre plateforme. 
                Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">7. Conservation des données</h2>
              <p className="text-muted-foreground">
                Vos données sont conservées pendant la durée nécessaire aux finalités pour lesquelles elles ont été collectées, 
                et conformément aux obligations légales applicables.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">8. Contact</h2>
              <p className="text-muted-foreground">
                Pour exercer vos droits ou pour toute question relative à la protection de vos données, 
                veuillez nous contacter via notre page de contact.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
