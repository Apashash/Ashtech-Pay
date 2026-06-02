import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Building2, Mail, Phone, User, MapPin, AlertTriangle, Shield, FileSearch, Eye, Flag, Scale } from "lucide-react";

export default function TermsPage() {
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

          {/* Header */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Conditions générales d'utilisation</h1>
            <p className="text-muted-foreground">Ashtech SARL — Ashtech Pay · Dernière mise à jour : Février 2026</p>
          </div>

          {/* ── SECTION 1 : Conditions d'utilisation ── */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">Conditions d'utilisation</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">1. Acceptation des conditions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  En accédant et en utilisant la plateforme Ashtech Pay, vous acceptez d'être lié par les présentes conditions d'utilisation.
                  Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">2. Description des services</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Ashtech Pay est une plateforme de paiement en ligne permettant aux utilisateurs de créer des liens de paiement,
                  recevoir des paiements via Mobile Money et cartes bancaires, et gérer leurs transactions financières.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">3. Inscription et compte</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Pour utiliser nos services, vous devez créer un compte en fournissant des informations exactes et complètes.
                  Vous êtes responsable de la confidentialité de vos identifiants de connexion et de toutes les activités effectuées sous votre compte.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">4. Utilisation autorisée</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Vous vous engagez à utiliser Ashtech Pay uniquement à des fins légales et conformément aux lois applicables.
                  Toute utilisation frauduleuse, illégale ou abusive est strictement interdite et peut entraîner la suspension de votre compte.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">5. Frais et commissions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Les frais applicables aux transactions sont clairement indiqués avant chaque opération.
                  Ashtech Pay se réserve le droit de modifier ses tarifs avec un préavis raisonnable.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">6. Limitation de responsabilité</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Ashtech Pay ne peut être tenu responsable des dommages indirects, pertes de données ou interruptions de service
                  résultant de l'utilisation de la plateforme, sauf en cas de faute grave de notre part.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">7. Modification des conditions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nous nous réservons le droit de modifier ces conditions à tout moment.
                  Les utilisateurs seront informés des changements significatifs par email ou notification sur la plateforme.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">8. Contact</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Pour toute question concernant ces conditions, veuillez nous contacter via notre page de contact ou à{" "}
                  <a href="mailto:support@ashtechpay.top" className="text-primary hover:underline">support@ashtechpay.top</a>.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 2 : Politique de confidentialité ── */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">Politique de confidentialité</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">1. Collecte des données</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nous collectons les informations que vous nous fournissez lors de votre inscription et de l'utilisation de nos services :
                  nom, prénom, adresse email, numéro de téléphone, informations de paiement et données de transaction.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">2. Utilisation des données</h3>
                <p className="text-muted-foreground leading-relaxed mb-2">Vos données sont utilisées pour :</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Fournir et améliorer nos services</li>
                  <li>Traiter vos transactions</li>
                  <li>Communiquer avec vous concernant votre compte</li>
                  <li>Assurer la sécurité de la plateforme</li>
                  <li>Respecter nos obligations légales</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">3. Protection des données</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données
                  contre tout accès non autorisé, modification, divulgation ou destruction.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">4. Partage des données</h3>
                <p className="text-muted-foreground leading-relaxed mb-2">Nous ne vendons pas vos données personnelles. Nous pouvons partager vos informations avec :</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Nos partenaires de paiement pour traiter les transactions</li>
                  <li>Les autorités compétentes en cas d'obligation légale</li>
                  <li>Nos prestataires de services sous contrat de confidentialité</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">5. Vos droits</h3>
                <p className="text-muted-foreground leading-relaxed mb-2">Vous disposez des droits suivants concernant vos données personnelles :</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Droit d'accès à vos données</li>
                  <li>Droit de rectification</li>
                  <li>Droit à l'effacement</li>
                  <li>Droit à la portabilité</li>
                  <li>Droit d'opposition</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">6. Cookies</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Nous utilisons des cookies pour améliorer votre expérience sur notre plateforme.
                  Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">7. Conservation des données</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Vos données sont conservées pendant la durée nécessaire aux finalités pour lesquelles elles ont été collectées,
                  et conformément aux obligations légales applicables.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 3 : Mentions légales ── */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">Mentions légales</h2>

            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Identité de la société
                </h3>
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
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Activité et réglementation</h3>
                <div className="space-y-3 text-muted-foreground leading-relaxed">
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
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Hébergement</h3>
                <p className="text-muted-foreground leading-relaxed">
                  La plateforme Ashtech Pay est hébergée sur une infrastructure cloud sécurisée. Toutes les communications
                  sont chiffrées via le protocole HTTPS/SSL. Le nom de domaine principal est <strong className="text-foreground">ashtechpay.top</strong>.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Propriété intellectuelle</h3>
                <p className="text-muted-foreground leading-relaxed">
                  L'ensemble du contenu de ce site (textes, images, logos, interface, code source, etc.) est protégé par le droit d'auteur
                  et appartient à Ashtech SARL ou à ses partenaires. Toute reproduction, représentation, modification
                  ou exploitation non autorisée est strictement interdite sans accord écrit préalable.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Droit applicable</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Les présentes mentions légales sont soumises au droit camerounais. En cas de litige, les parties s'efforceront
                  de trouver un règlement amiable. À défaut, les tribunaux compétents du ressort de Foumbot, Cameroun, seront saisis.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 4 : Politique AML/CFT ── */}
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
                  {["Blanchiment de capitaux", "Financement du terrorisme", "Fraude financière", "Corruption", "Escroquerie"].map((item) => (
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
              © 2026 Ashtech SARL. Tous droits réservés.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
