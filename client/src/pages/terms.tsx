import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Building2, Mail, Phone, User, MapPin, AlertTriangle, Shield, FileSearch, Eye, Flag, Scale } from "lucide-react";
import { useLanguage } from "@/lib/language";

const content = {
  fr: {
    back: "Retour",
    title: "Conditions générales d'utilisation",
    subtitle: "Ashtech SARL — Ashtech Pay · Dernière mise à jour : Février 2026",
    copyright: "© 2026 Ashtech SARL. Tous droits réservés.",

    s1title: "Conditions d'utilisation",
    s1_1h: "1. Acceptation des conditions",
    s1_1p: "En accédant et en utilisant la plateforme Ashtech Pay, vous acceptez d'être lié par les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.",
    s1_2h: "2. Description des services",
    s1_2p: "Ashtech Pay est une plateforme de paiement en ligne permettant aux utilisateurs de créer des liens de paiement, recevoir des paiements via Mobile Money et cartes bancaires, et gérer leurs transactions financières.",
    s1_3h: "3. Inscription et compte",
    s1_3p: "Pour utiliser nos services, vous devez créer un compte en fournissant des informations exactes et complètes. Vous êtes responsable de la confidentialité de vos identifiants de connexion et de toutes les activités effectuées sous votre compte.",
    s1_4h: "4. Utilisation autorisée",
    s1_4p: "Vous vous engagez à utiliser Ashtech Pay uniquement à des fins légales et conformément aux lois applicables. Toute utilisation frauduleuse, illégale ou abusive est strictement interdite et peut entraîner la suspension de votre compte.",
     s1_5h: "5. Activités interdites et non conformes",
     s1_5p: "Ashtech Pay n'accepte pas les marchands, projets ou transactions liés à des activités illégales, dangereuses, trompeuses, non déclarées ou incompatibles avec nos obligations réglementaires. Sont notamment interdits :",
     s1_5list: [
       "Les systèmes de type Ponzi, pyramides, chaînes de parrainage frauduleuses et autres mécanismes promettant des rendements irréalistes.",
       "Les prêts d'argent en ligne, services de crédit, collecte d'épargne, investissement, financement participatif ou autres services financiers non agréés.",
       "La vente de produits physiques ou de services dont la nature, l'origine, la conformité, la livraison ou le bénéficiaire ne peuvent pas être clairement établis.",
       "Le blanchiment de capitaux, le financement du terrorisme, la fraude, l'escroquerie, l'usurpation d'identité, le phishing et les fausses collectes.",
       "Le trafic ou la vente de drogues, d'armes, de biens volés, de contrefaçons, de produits interdits ou d'espèces protégées.",
       "Les jeux d'argent, paris, loteries, casinos ou activités assimilées non autorisés par les autorités compétentes.",
       "Les contenus ou services liés à l'exploitation sexuelle, aux abus, à la violence, à la haine, au terrorisme ou à l'extrémisme violent.",
       "Le piratage informatique, la vente de données obtenues illégalement, les logiciels malveillants et toute activité mettant en danger des personnes ou des systèmes.",
     ],
     s1_5footer: "Cette liste n'est pas exhaustive. Ashtech Pay peut refuser, suspendre ou signaler toute autre activité illégale, dangereuse, trompeuse, non conforme ou dont la nature demeure insuffisamment claire, conformément à la réglementation applicable.",
     s1_6h: "6. Frais et commissions",
     s1_6p: "Les frais applicables aux transactions sont clairement indiqués avant chaque opération. Ashtech Pay se réserve le droit de modifier ses tarifs avec un préavis raisonnable.",
     s1_7h: "7. Limitation de responsabilité",
     s1_7p: "Ashtech Pay ne peut être tenu responsable des dommages indirects, pertes de données ou interruptions de service résultant de l'utilisation de la plateforme, sauf en cas de faute grave de notre part.",
     s1_8h: "8. Modification des conditions",
     s1_8p: "Nous nous réservons le droit de modifier ces conditions à tout moment. Les utilisateurs seront informés des changements significatifs par email ou notification sur la plateforme.",
     s1_9h: "9. Contact",
     s1_9p: "Pour toute question concernant ces conditions, veuillez nous contacter via notre page de contact ou à",

    s2title: "Politique de confidentialité",
    s2_1h: "1. Collecte des données",
    s2_1p: "Nous collectons les informations que vous nous fournissez lors de votre inscription et de l'utilisation de nos services : nom, prénom, adresse email, numéro de téléphone, informations de paiement et données de transaction.",
    s2_2h: "2. Utilisation des données",
    s2_2intro: "Vos données sont utilisées pour :",
    s2_2list: ["Fournir et améliorer nos services", "Traiter vos transactions", "Communiquer avec vous concernant votre compte", "Assurer la sécurité de la plateforme", "Respecter nos obligations légales"],
    s2_3h: "3. Protection des données",
    s2_3p: "Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction.",
    s2_4h: "4. Partage des données",
    s2_4intro: "Nous ne vendons pas vos données personnelles. Nous pouvons partager vos informations avec :",
    s2_4list: ["Nos partenaires de paiement pour traiter les transactions", "Les autorités compétentes en cas d'obligation légale", "Nos prestataires de services sous contrat de confidentialité"],
    s2_5h: "5. Vos droits",
    s2_5intro: "Vous disposez des droits suivants concernant vos données personnelles :",
    s2_5list: ["Droit d'accès à vos données", "Droit de rectification", "Droit à l'effacement", "Droit à la portabilité", "Droit d'opposition"],
    s2_6h: "6. Cookies",
    s2_6p: "Nous utilisons des cookies pour améliorer votre expérience sur notre plateforme. Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur.",
    s2_7h: "7. Conservation des données",
    s2_7p: "Vos données sont conservées pendant la durée nécessaire aux finalités pour lesquelles elles ont été collectées, et conformément aux obligations légales applicables.",

    s3title: "Mentions légales",
    s3_identity: "Identité de la société",
    s3_legalName: "Dénomination sociale",
    s3_tradeName: "Nom commercial",
    s3_legalForm: "Forme juridique",
    s3_legalFormVal: "Société à Responsabilité Limitée (SARL)",
    s3_manager: "Gérant",
    s3_country: "Pays d'enregistrement",
    s3_address: "Siège social",
    s3_addressVal: "Foumbot, Région Ouest, Cameroun",
    s3_email: "Email professionnel",
    s3_phone: "Téléphone",
    s3_activityTitle: "Activité et réglementation",
    s3_activityP1: "Ashtech Pay est une solution de paiement digitale opérant sous la dénomination sociale Ashtech SARL. La société propose des services de collecte de paiements en ligne, de transferts d'argent et d'intégration API pour plateformes digitales à destination des marchands opérant en Afrique.",
    s3_activityP2: "Ashtech Pay opère dans le respect des réglementations financières en vigueur dans les pays où ses services sont disponibles. Nous collaborons avec des partenaires de paiement agréés — notamment AfribaPay et PixPay — conformes aux normes locales et internationales pour le traitement des transactions Mobile Money.",
    s3_hostingTitle: "Hébergement",
    s3_hostingP: "La plateforme Ashtech Pay est hébergée sur une infrastructure cloud sécurisée. Toutes les communications sont chiffrées via le protocole HTTPS/SSL. Le nom de domaine principal est",
    s3_ipTitle: "Propriété intellectuelle",
    s3_ipP: "L'ensemble du contenu de ce site (textes, images, logos, interface, code source, etc.) est protégé par le droit d'auteur et appartient à Ashtech SARL ou à ses partenaires. Toute reproduction, représentation, modification ou exploitation non autorisée est strictement interdite sans accord écrit préalable.",
    s3_lawTitle: "Droit applicable",
    s3_lawP: "Les présentes mentions légales sont soumises au droit camerounais. En cas de litige, les parties s'efforceront de trouver un règlement amiable. À défaut, les tribunaux compétents du ressort de Foumbot, Cameroun, seront saisis.",

    s4badge: "Politique AML/CFT",
    s4title: "Lutte contre le blanchiment de capitaux et le financement du terrorisme",
    s4subtitle: "ASHTECH SARL — Ashtech Pay",
    s4_1h: "1. Engagement",
    s4_1p: "ASHTECH SARL s'engage fermement à prévenir, détecter et signaler toute tentative d'utilisation de sa plateforme à des fins illicites, notamment :",
    s4_1list: ["Blanchiment de capitaux", "Financement du terrorisme", "Fraude financière", "Corruption", "Escroquerie"],
    s4_1footer: "La société applique une approche basée sur le risque, conformément aux standards internationaux édictés par le GAFI/FATF (Groupe d'Action Financière).",
    s4_kyc: "Vérification KYC",
    s4_kycDesc: "Tous les marchands font l'objet d'une vérification d'identité (Know Your Customer) avant activation des services de paiement.",
    s4_monitor: "Surveillance des transactions",
    s4_monitorDesc: "Les transactions sont surveillées en temps réel. Toute activité suspecte déclenche une alerte et peut entraîner un gel temporaire du compte.",
    s4_report: "Signalement obligatoire",
    s4_reportDesc: "Toute transaction suspecte est signalée aux autorités compétentes conformément aux obligations légales en vigueur au Cameroun.",
    s4_2h: "2. Mesures appliquées",
    s4_measures: [
      { title: "Identification client", desc: "Collecte et vérification des documents d'identité officiels pour tous les marchands." },
      { title: "Seuils de transaction", desc: "Surveillance renforcée des transactions dépassant les seuils réglementaires applicables." },
      { title: "Conservation des données", desc: "Tenue d'un registre de toutes les transactions pendant une durée minimum de 5 ans." },
      { title: "Formation interne", desc: "Sensibilisation de l'ensemble du personnel aux risques de blanchiment et aux procédures de signalement." },
    ],
    s4_contact: "Contact conformité :",
    s4_contactP: "Pour toute question relative à notre politique AML/CFT, contactez notre équipe conformité à",
    s4_contactOr: "ou au",
  },
  en: {
    back: "Back",
    title: "Terms & Conditions",
    subtitle: "Ashtech SARL — Ashtech Pay · Last updated: February 2026",
    copyright: "© 2026 Ashtech SARL. All rights reserved.",

    s1title: "Terms of Use",
    s1_1h: "1. Acceptance of Terms",
    s1_1p: "By accessing and using the Ashtech Pay platform, you agree to be bound by these terms of use. If you do not accept these terms, please do not use our services.",
    s1_2h: "2. Service Description",
    s1_2p: "Ashtech Pay is an online payment platform that allows users to create payment links, receive payments via Mobile Money and bank cards, and manage their financial transactions.",
    s1_3h: "3. Registration and Account",
    s1_3p: "To use our services, you must create an account by providing accurate and complete information. You are responsible for the confidentiality of your login credentials and all activities carried out under your account.",
    s1_4h: "4. Permitted Use",
    s1_4p: "You agree to use Ashtech Pay only for lawful purposes and in accordance with applicable laws. Any fraudulent, illegal or abusive use is strictly prohibited and may result in the suspension of your account.",
     s1_5h: "5. Prohibited and Non-Compliant Activities",
     s1_5p: "Ashtech Pay does not accept merchants, projects or transactions connected to illegal, dangerous, deceptive, undeclared activities or activities incompatible with our regulatory obligations. This includes, in particular:",
     s1_5list: [
       "Ponzi schemes, pyramid schemes, fraudulent referral chains and other mechanisms promising unrealistic returns.",
       "Online lending, credit services, deposit-taking, investment, crowdfunding or other unlicensed financial services.",
       "The sale of physical goods or services whose nature, origin, compliance, delivery or beneficiary cannot be clearly established.",
       "Money laundering, terrorist financing, fraud, scams, identity theft, phishing and false fundraising campaigns.",
       "The trafficking or sale of drugs, weapons, stolen goods, counterfeit goods, prohibited products or protected species.",
       "Unauthorized gambling, betting, lotteries, casinos or similar activities.",
       "Content or services involving sexual exploitation, abuse, violence, hate, terrorism or violent extremism.",
       "Hacking, the sale of unlawfully obtained data, malware and any activity that endangers people or systems.",
     ],
     s1_5footer: "This list is not exhaustive. Ashtech Pay may refuse, suspend or report any other illegal, dangerous, deceptive, non-compliant activity or activity whose nature remains insufficiently clear, in accordance with applicable regulations.",
     s1_6h: "6. Fees and Commissions",
     s1_6p: "Applicable transaction fees are clearly indicated before each operation. Ashtech Pay reserves the right to modify its rates with reasonable prior notice.",
     s1_7h: "7. Limitation of Liability",
     s1_7p: "Ashtech Pay cannot be held liable for indirect damages, data loss or service interruptions resulting from the use of the platform, except in cases of gross negligence on our part.",
     s1_8h: "8. Modification of Terms",
     s1_8p: "We reserve the right to modify these terms at any time. Users will be informed of significant changes by email or notification on the platform.",
     s1_9h: "9. Contact",
     s1_9p: "For any questions regarding these terms, please contact us via our contact page or at",

    s2title: "Privacy Policy",
    s2_1h: "1. Data Collection",
    s2_1p: "We collect the information you provide to us when registering and using our services: first and last name, email address, phone number, payment information and transaction data.",
    s2_2h: "2. Use of Data",
    s2_2intro: "Your data is used to:",
    s2_2list: ["Provide and improve our services", "Process your transactions", "Communicate with you about your account", "Ensure platform security", "Comply with our legal obligations"],
    s2_3h: "3. Data Protection",
    s2_3p: "We implement appropriate technical and organizational security measures to protect your data against unauthorized access, modification, disclosure or destruction.",
    s2_4h: "4. Data Sharing",
    s2_4intro: "We do not sell your personal data. We may share your information with:",
    s2_4list: ["Our payment partners to process transactions", "Competent authorities in the event of a legal obligation", "Our service providers under confidentiality agreements"],
    s2_5h: "5. Your Rights",
    s2_5intro: "You have the following rights regarding your personal data:",
    s2_5list: ["Right of access to your data", "Right of rectification", "Right to erasure", "Right to data portability", "Right to object"],
    s2_6h: "6. Cookies",
    s2_6p: "We use cookies to improve your experience on our platform. You can manage your cookie preferences in your browser settings.",
    s2_7h: "7. Data Retention",
    s2_7p: "Your data is retained for as long as necessary for the purposes for which it was collected, and in accordance with applicable legal obligations.",

    s3title: "Legal Notices",
    s3_identity: "Company Identity",
    s3_legalName: "Legal name",
    s3_tradeName: "Trade name",
    s3_legalForm: "Legal form",
    s3_legalFormVal: "Limited Liability Company (SARL)",
    s3_manager: "Manager",
    s3_country: "Country of registration",
    s3_address: "Registered office",
    s3_addressVal: "Foumbot, West Region, Cameroon",
    s3_email: "Professional email",
    s3_phone: "Phone",
    s3_activityTitle: "Activity and Regulation",
    s3_activityP1: "Ashtech Pay is a digital payment solution operating under the legal name Ashtech SARL. The company offers online payment collection services, money transfers and API integration for digital platforms targeting merchants operating in Africa.",
    s3_activityP2: "Ashtech Pay operates in compliance with financial regulations in force in the countries where its services are available. We partner with licensed payment providers — including AfribaPay and PixPay — compliant with local and international standards for Mobile Money transaction processing.",
    s3_hostingTitle: "Hosting",
    s3_hostingP: "The Ashtech Pay platform is hosted on a secure cloud infrastructure. All communications are encrypted via the HTTPS/SSL protocol. The main domain name is",
    s3_ipTitle: "Intellectual Property",
    s3_ipP: "All content on this site (texts, images, logos, interface, source code, etc.) is protected by copyright and belongs to Ashtech SARL or its partners. Any unauthorized reproduction, representation, modification or exploitation is strictly prohibited without prior written consent.",
    s3_lawTitle: "Applicable Law",
    s3_lawP: "These legal notices are governed by Cameroonian law. In the event of a dispute, the parties will endeavor to find an amicable resolution. Failing that, the competent courts of Foumbot, Cameroon, will have jurisdiction.",

    s4badge: "AML/CFT Policy",
    s4title: "Anti-Money Laundering and Counter-Terrorism Financing",
    s4subtitle: "ASHTECH SARL — Ashtech Pay",
    s4_1h: "1. Commitment",
    s4_1p: "ASHTECH SARL is firmly committed to preventing, detecting and reporting any attempt to use its platform for illicit purposes, including:",
    s4_1list: ["Money laundering", "Terrorism financing", "Financial fraud", "Corruption", "Scams"],
    s4_1footer: "The company applies a risk-based approach, in accordance with international standards set by the FATF (Financial Action Task Force).",
    s4_kyc: "KYC Verification",
    s4_kycDesc: "All merchants undergo identity verification (Know Your Customer) before payment services are activated.",
    s4_monitor: "Transaction Monitoring",
    s4_monitorDesc: "Transactions are monitored in real time. Any suspicious activity triggers an alert and may result in a temporary account freeze.",
    s4_report: "Mandatory Reporting",
    s4_reportDesc: "Any suspicious transaction is reported to the competent authorities in accordance with legal obligations in force in Cameroon.",
    s4_2h: "2. Measures Applied",
    s4_measures: [
      { title: "Customer identification", desc: "Collection and verification of official identity documents for all merchants." },
      { title: "Transaction thresholds", desc: "Enhanced monitoring of transactions exceeding applicable regulatory thresholds." },
      { title: "Data retention", desc: "Maintenance of a record of all transactions for a minimum period of 5 years." },
      { title: "Internal training", desc: "Awareness of all staff on money laundering risks and reporting procedures." },
    ],
    s4_contact: "Compliance contact:",
    s4_contactP: "For any questions regarding our AML/CFT policy, contact our compliance team at",
    s4_contactOr: "or at",
  },
};

export default function TermsPage() {
  const { language } = useLanguage();
  const c = content[language] ?? content.fr;

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
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
                {c.back}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">

          {/* Header */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">{c.title}</h1>
            <p className="text-muted-foreground">{c.subtitle}</p>
          </div>

          {/* ── SECTION 1 : Terms of Use ── */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">{c.s1title}</h2>
            <div className="space-y-6">
               {[
                 [c.s1_1h, c.s1_1p], [c.s1_2h, c.s1_2p], [c.s1_3h, c.s1_3p],
                 [c.s1_4h, c.s1_4p], [c.s1_6h, c.s1_6p], [c.s1_7h, c.s1_7p], [c.s1_8h, c.s1_8p],
               ].map(([h, p]) => (
                <div key={h}>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{h}</h3>
                  <p className="text-muted-foreground leading-relaxed">{p}</p>
                </div>
              ))}
               <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                 <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                   <AlertTriangle className="w-5 h-5 text-amber-500" />
                   {c.s1_5h}
                 </h3>
                 <p className="text-muted-foreground leading-relaxed">{c.s1_5p}</p>
                 <ul className="mt-4 list-disc pl-6 text-muted-foreground space-y-2">
                   {c.s1_5list.map(item => <li key={item}>{item}</li>)}
                 </ul>
                 <p className="text-muted-foreground leading-relaxed mt-4">{c.s1_5footer}</p>
               </div>
              <div>
                 <h3 className="text-lg font-semibold text-foreground mb-2">{c.s1_9h}</h3>
                <p className="text-muted-foreground leading-relaxed">
                   {c.s1_9p}{" "}
                  <a href="mailto:support@ashtechpay.com" className="text-primary hover:underline">support@ashtechpay.com</a>.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 2 : Privacy Policy ── */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">{c.s2title}</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{c.s2_1h}</h3>
                <p className="text-muted-foreground leading-relaxed">{c.s2_1p}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{c.s2_2h}</h3>
                <p className="text-muted-foreground leading-relaxed mb-2">{c.s2_2intro}</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">{c.s2_2list.map(i => <li key={i}>{i}</li>)}</ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{c.s2_3h}</h3>
                <p className="text-muted-foreground leading-relaxed">{c.s2_3p}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{c.s2_4h}</h3>
                <p className="text-muted-foreground leading-relaxed mb-2">{c.s2_4intro}</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">{c.s2_4list.map(i => <li key={i}>{i}</li>)}</ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{c.s2_5h}</h3>
                <p className="text-muted-foreground leading-relaxed mb-2">{c.s2_5intro}</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">{c.s2_5list.map(i => <li key={i}>{i}</li>)}</ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{c.s2_6h}</h3>
                <p className="text-muted-foreground leading-relaxed">{c.s2_6p}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{c.s2_7h}</h3>
                <p className="text-muted-foreground leading-relaxed">{c.s2_7p}</p>
              </div>
            </div>
          </section>

          {/* ── SECTION 3 : Legal Notices ── */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">{c.s3title}</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />{c.s3_identity}
                </h3>
                <Card className="p-6 bg-card border-border">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{c.s3_legalName}</p>
                        <p className="text-foreground font-semibold">Ashtech SARL</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{c.s3_tradeName}</p>
                        <p className="text-foreground font-semibold">Ashtech Pay</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{c.s3_legalForm}</p>
                        <p className="text-foreground">{c.s3_legalFormVal}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{c.s3_manager}</p>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-primary" />
                          <p className="text-foreground font-medium">Alassa Ash</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{c.s3_country}</p>
                        <div className="flex items-center gap-2">
                          <Flag className="w-4 h-4 text-primary" />
                          <p className="text-foreground">Cameroon</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{c.s3_address}</p>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          <p className="text-foreground">{c.s3_addressVal}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{c.s3_email}</p>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-primary" />
                          <a href="mailto:support@ashtechpay.com" className="text-primary hover:underline">support@ashtechpay.com</a>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{c.s3_phone}</p>
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
                <h3 className="text-lg font-semibold text-foreground mb-3">{c.s3_activityTitle}</h3>
                <div className="space-y-3 text-muted-foreground leading-relaxed">
                  <p>{c.s3_activityP1}</p>
                  <p>{c.s3_activityP2}</p>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">{c.s3_hostingTitle}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {c.s3_hostingP} <strong className="text-foreground">www.ashtechpay.com</strong>.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">{c.s3_ipTitle}</h3>
                <p className="text-muted-foreground leading-relaxed">{c.s3_ipP}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">{c.s3_lawTitle}</h3>
                <p className="text-muted-foreground leading-relaxed">{c.s3_lawP}</p>
              </div>
            </div>
          </section>

          {/* ── SECTION 4 : AML/CFT ── */}
          <section className="border-t border-border pt-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 rounded-full border border-amber-500/20 mb-6">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-amber-500 font-medium">{c.s4badge}</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{c.s4title}</h2>
            <p className="text-muted-foreground mb-8">{c.s4subtitle}</p>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />{c.s4_1h}
                </h3>
                <p className="text-muted-foreground leading-relaxed">{c.s4_1p}</p>
                <ul className="mt-3 space-y-2 ml-4">
                  {c.s4_1list.map(item => (
                    <li key={item} className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />{item}
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">{c.s4_1footer}</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <Card className="p-5 bg-card border-border">
                  <FileSearch className="w-8 h-8 text-primary mb-3" />
                  <h4 className="font-semibold text-foreground mb-2">{c.s4_kyc}</h4>
                  <p className="text-sm text-muted-foreground">{c.s4_kycDesc}</p>
                </Card>
                <Card className="p-5 bg-card border-border">
                  <Eye className="w-8 h-8 text-primary mb-3" />
                  <h4 className="font-semibold text-foreground mb-2">{c.s4_monitor}</h4>
                  <p className="text-sm text-muted-foreground">{c.s4_monitorDesc}</p>
                </Card>
                <Card className="p-5 bg-card border-border">
                  <Flag className="w-8 h-8 text-primary mb-3" />
                  <h4 className="font-semibold text-foreground mb-2">{c.s4_report}</h4>
                  <p className="text-sm text-muted-foreground">{c.s4_reportDesc}</p>
                </Card>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">{c.s4_2h}</h3>
                <div className="space-y-3">
                  {c.s4_measures.map(item => (
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
                  <strong className="text-foreground">{c.s4_contact}</strong>{" "}{c.s4_contactP}{" "}
                  <a href="mailto:support@ashtechpay.com" className="text-primary hover:underline">support@ashtechpay.com</a>
                  {" "}{c.s4_contactOr}{" "}
                  <a href="tel:+237683677872" className="text-foreground hover:text-primary">+237 6 83 67 78 72</a>.
                </p>
              </div>
            </div>
          </section>

          <div className="text-center pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">{c.copyright}</p>
          </div>

        </div>
      </main>
    </div>
  );
}
