import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Building2, Mail, Phone, User, MapPin, AlertTriangle, Shield, FileSearch, Eye, Flag } from "lucide-react";


export default function LegalPage() {
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
        <div className="max-w-4xl mx-auto space-y-12">

          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Informations légales officielles</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Mentions légales</h1>
            <p className="text-muted-foreground">Ashtech SARL — Ashtech Pay</p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Identité de la société
            </h2>
            <Card className="p-6 bg-card border-border">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Dénomination sociale</p>
                    <p className="text-foreground font-semibold">Ashtech SARL</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nom commercial</p>
                    <p className="text-foreground font-semibold">Ashtech Pay</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Forme juridique</p>
                    <p className="text-foreground">Société à Responsabilité Limitée (SARL)</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Gérant</p>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <p className="text-foreground font-medium">Alassa Ash</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pays d'enregistrement</p>
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-primary" />
                      <p className="text-foreground">Cameroun</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Siège social</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <p className="text-foreground">Foumbot, Région Ouest, Cameroun</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email professionnel</p>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      <a href="mailto:support@ashtechpay.top" className="text-primary hover:underline">support@ashtechpay.top</a>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Téléphone</p>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" />
                      <a href="tel:+237683677872" className="text-foreground">+237 6 83 67 78 72</a>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Activité et réglementation</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Ashtech Pay est une solution de paiement digitale opérant sous la dénomination sociale <strong className="text-foreground">Ashtech SARL</strong>. 
                La société propose des services de collecte de paiements en ligne, de transferts d'argent et d'intégration API 
                pour plateformes digitales à destination des marchands opérant en Afrique.
              </p>
              <p>
                Ashtech Pay opère dans le respect des réglementations financières en vigueur dans les pays où ses services sont disponibles. 
                Nous collaborons avec des partenaires de paiement agréés — notamment <strong className="text-foreground">Swychr (AccountPE)</strong> — 
                conformes aux normes locales et internationales pour le traitement des transactions Mobile Money.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Hébergement</h2>
            <p className="text-muted-foreground leading-relaxed">
              La plateforme Ashtech Pay est hébergée sur une infrastructure cloud sécurisée. Toutes les communications 
              sont chiffrées via le protocole HTTPS/SSL. Le nom de domaine principal est <strong className="text-foreground">ashtechpay.top</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Propriété intellectuelle</h2>
            <p className="text-muted-foreground leading-relaxed">
              L'ensemble du contenu de ce site (textes, images, logos, interface, code source, etc.) est protégé par le droit d'auteur 
              et appartient à Ashtech SARL ou à ses partenaires. Toute reproduction, représentation, modification 
              ou exploitation non autorisée est strictement interdite sans accord écrit préalable.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Limitation de responsabilité</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ashtech Pay s'efforce de fournir des informations exactes et à jour. Toutefois, nous ne pouvons garantir 
              l'exactitude ou l'exhaustivité des informations diffusées. La société décline toute responsabilité en cas 
              d'interruption du service due à des facteurs extérieurs (défaillance réseau, maintenance, force majeure).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Droit applicable</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les présentes mentions légales sont soumises au droit camerounais. En cas de litige, les parties s'efforceront 
              de trouver un règlement amiable. À défaut, les tribunaux compétents du ressort de Foumbot, Cameroun, seront saisis.
            </p>
          </section>

          <section className="border-t border-border pt-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 rounded-full border border-amber-500/20 mb-6">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-amber-500 font-medium">Politique AML/CFT</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Lutte contre le blanchiment de capitaux et le financement du terrorisme
            </h2>
            <p className="text-muted-foreground mb-8">ASHTECH SARL — Ashtech Pay</p>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  1. Engagement
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  ASHTECH SARL s'engage fermement à prévenir, détecter et signaler toute tentative d'utilisation 
                  de sa plateforme à des fins illicites, notamment :
                </p>
                <ul className="mt-3 space-y-2 ml-4">
                  {[
                    "Blanchiment de capitaux",
                    "Financement du terrorisme",
                    "Fraude financière",
                    "Corruption",
                    "Escroquerie",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  La société applique une approche basée sur le risque, conformément aux standards internationaux 
                  édictés par le GAFI/FATF (Groupe d'Action Financière).
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <Card className="p-5 bg-card border-border">
                  <FileSearch className="w-8 h-8 text-primary mb-3" />
                  <h4 className="font-semibold text-foreground mb-2">Vérification KYC</h4>
                  <p className="text-sm text-muted-foreground">
                    Tous les marchands font l'objet d'une vérification d'identité (Know Your Customer) 
                    avant activation des services de paiement.
                  </p>
                </Card>
                <Card className="p-5 bg-card border-border">
                  <Eye className="w-8 h-8 text-primary mb-3" />
                  <h4 className="font-semibold text-foreground mb-2">Surveillance des transactions</h4>
                  <p className="text-sm text-muted-foreground">
                    Les transactions sont surveillées en temps réel. Toute activité suspecte 
                    déclenche une alerte et peut entraîner un gel temporaire du compte.
                  </p>
                </Card>
                <Card className="p-5 bg-card border-border">
                  <Flag className="w-8 h-8 text-primary mb-3" />
                  <h4 className="font-semibold text-foreground mb-2">Signalement obligatoire</h4>
                  <p className="text-sm text-muted-foreground">
                    Toute transaction suspecte est signalée aux autorités compétentes conformément 
                    aux obligations légales en vigueur au Cameroun.
                  </p>
                </Card>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">2. Mesures appliquées</h3>
                <div className="space-y-3">
                  {[
                    { title: "Identification client", desc: "Collecte et vérification des documents d'identité officiels pour tous les marchands." },
                    { title: "Seuils de transaction", desc: "Surveillance renforcée des transactions dépassant les seuils réglementaires applicables." },
                    { title: "Conservation des données", desc: "Tenue d'un registre de toutes les transactions pendant une durée minimum de 5 ans." },
                    { title: "Formation interne", desc: "Sensibilisation de l'ensemble du personnel aux risques de blanchiment et aux procédures de signalement." },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-3 p-4 bg-secondary/30 rounded-lg border border-border">
                      <div className="w-1.5 rounded-full bg-primary flex-shrink-0 my-1" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{item.title}</p>
                        <p className="text-muted-foreground text-sm mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Contact conformité :</strong> Pour toute question relative à notre politique AML/CFT, 
                  contactez notre équipe conformité à{" "}
                  <a href="mailto:support@ashtechpay.top" className="text-primary hover:underline">support@ashtechpay.top</a>
                  {" "}ou au{" "}
                  <a href="tel:+237683677872" className="text-foreground hover:text-primary">+237 6 83 67 78 72</a>.
                </p>
              </div>
            </div>
          </section>

          <div className="text-center pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Dernière mise à jour : Février 2026 — © 2026 Ashtech SARL. Tous droits réservés.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
