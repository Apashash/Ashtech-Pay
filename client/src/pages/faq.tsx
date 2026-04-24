import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HelpCircle, ChevronDown } from "lucide-react";
import { useState } from "react";


interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "Qu'est-ce que Ashtech Pay ?",
    answer: "Ashtech Pay est une plateforme de paiement en ligne qui permet aux entrepreneurs, créateurs et commerçants africains de vendre leurs produits physiques ou digitaux grâce à des liens de paiement simples et sécurisés."
  },
  {
    question: "Comment créer un lien de paiement ?",
    answer: "Après avoir créé votre compte, accédez à la section 'Liens de paiement' de votre tableau de bord. Cliquez sur 'Créer un lien', ajoutez les informations de votre produit (nom, prix, description), puis générez votre lien. Vous pouvez ensuite le partager sur vos réseaux sociaux ou par message."
  },
  {
    question: "Quels moyens de paiement sont acceptés ?",
    answer: "Nous acceptons Mobile Money (MTN, Orange, Airtel, Wave, Moov, M-Pesa...), les cartes bancaires (Visa, Mastercard), et d'autres moyens de paiement locaux selon le pays."
  },
  {
    question: "Dans quels pays Ashtech Pay est-il disponible ?",
    answer: "Ashtech Pay est disponible dans plus de 18 pays africains, incluant le Cameroun, le Sénégal, la Côte d'Ivoire, le Mali, le Burkina Faso, le Niger, le Togo, le Bénin, le Gabon, le Congo, la RD Congo, la Centrafrique, le Tchad, la Guinée, Madagascar, le Maroc, la Tunisie, le Kenya, le Nigeria, le Ghana et l'Algérie."
  },
  {
    question: "Quels sont les frais de transaction ?",
    answer: "Les frais varient selon le moyen de paiement utilisé et le pays. Tous les frais sont clairement affichés avant chaque transaction pour une transparence totale. Aucun frais caché."
  },
  {
    question: "Comment retirer mon argent ?",
    answer: "Vous pouvez retirer vos fonds vers votre compte Mobile Money ou votre compte bancaire. Accédez à la section 'Retraits' de votre tableau de bord, choisissez votre méthode de retrait et suivez les instructions."
  },
  {
    question: "Combien de temps prend un retrait ?",
    answer: "Les retraits via Mobile Money sont généralement traités en quelques minutes à quelques heures. Les retraits bancaires peuvent prendre 1 à 3 jours ouvrés selon votre banque."
  },
  {
    question: "Puis-je vendre des produits digitaux ?",
    answer: "Oui ! Ashtech Pay est parfait pour vendre des produits digitaux comme des fichiers, formations, accès privés et services. La livraison peut être automatique après le paiement."
  },
  {
    question: "Comment assurer la sécurité de mon compte ?",
    answer: "Nous utilisons un chiffrement de niveau bancaire pour protéger vos données. Nous vous recommandons d'utiliser un mot de passe fort et de ne jamais partager vos identifiants de connexion."
  },
  {
    question: "Que faire si j'ai un problème avec une transaction ?",
    answer: "Contactez notre équipe de support via la page Contact. Nous sommes disponibles pour vous aider à résoudre tout problème lié à vos transactions."
  }
];

function FAQAccordion({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between text-left"
      >
        <span className="text-lg font-medium text-foreground pr-4">{item.question}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="pb-6">
          <p className="text-muted-foreground">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
              <HelpCircle className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Questions fréquentes</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">FAQ</h1>
            <p className="text-lg text-muted-foreground">
              Retrouvez les réponses aux questions les plus fréquentes
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 sm:p-8">
            {faqs.map((faq, index) => (
              <FAQAccordion
                key={index}
                item={faq}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Vous n'avez pas trouvé la réponse à votre question ?
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
