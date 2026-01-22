import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import logoImage from "@assets/logo.png";

export default function LegalPage() {
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
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">Mentions légales</h1>
          
          <div className="prose prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Éditeur du site</h2>
              <p className="text-muted-foreground">
                <strong>Ashtech Pay Afrique</strong><br />
                Plateforme de paiement en ligne<br />
                Siège social : Afrique Centrale<br />
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Directeur de la publication</h2>
              <p className="text-muted-foreground">
                Le directeur de la publication est le représentant légal de Ashtech Pay Afrique.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Hébergement</h2>
              <p className="text-muted-foreground">
                Le site est hébergé sur des serveurs sécurisés avec une infrastructure conforme aux standards internationaux de sécurité.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Propriété intellectuelle</h2>
              <p className="text-muted-foreground">
                L'ensemble du contenu de ce site (textes, images, logos, vidéos, etc.) est protégé par le droit d'auteur 
                et appartient à Ashtech Pay Afrique ou à ses partenaires. Toute reproduction, représentation, modification 
                ou exploitation non autorisée est interdite.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Activité réglementée</h2>
              <p className="text-muted-foreground">
                Ashtech Pay opère dans le respect des réglementations financières en vigueur dans les pays où ses services sont disponibles. 
                Nous travaillons avec des partenaires de paiement agréés et conformes aux normes locales et internationales.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Limitation de responsabilité</h2>
              <p className="text-muted-foreground">
                Ashtech Pay s'efforce de fournir des informations exactes et à jour sur son site. 
                Toutefois, nous ne pouvons garantir l'exactitude, la complétude ou l'actualité des informations diffusées.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Droit applicable</h2>
              <p className="text-muted-foreground">
                Les présentes mentions légales sont soumises au droit applicable dans la juridiction du siège social de Ashtech Pay. 
                En cas de litige, les tribunaux compétents seront ceux du ressort du siège social.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
