import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail, Phone, MessageCircle, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import logoImage from "@assets/photo_2026-01-10_21-16-00_1768076188815.jpg";

interface ContactInfo {
  email: string;
  whatsapp: string;
  telegram: string;
}

export default function ContactPage() {
  const { data: contactInfo } = useQuery<ContactInfo>({
    queryKey: ["/api/contact-info"],
    queryFn: async () => {
      const res = await fetch("/api/contact-info");
      if (!res.ok) {
        return { email: "", whatsapp: "", telegram: "" };
      }
      return res.json();
    }
  });

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
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Support</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Contactez-nous</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Notre équipe est disponible pour répondre à toutes vos questions
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {contactInfo?.email && (
              <Card className="p-6 bg-card border-border text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Email</h3>
                <a 
                  href={`mailto:${contactInfo.email}`}
                  className="text-primary hover:underline break-all"
                >
                  {contactInfo.email}
                </a>
              </Card>
            )}

            {contactInfo?.whatsapp && (
              <Card className="p-6 bg-card border-border text-center">
                <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">WhatsApp</h3>
                <a 
                  href={`https://wa.me/${contactInfo.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-500 hover:underline"
                >
                  {contactInfo.whatsapp}
                </a>
              </Card>
            )}

            {contactInfo?.telegram && (
              <Card className="p-6 bg-card border-border text-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Telegram</h3>
                <a 
                  href={`https://t.me/${contactInfo.telegram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {contactInfo.telegram}
                </a>
              </Card>
            )}
          </div>

          {(!contactInfo?.email && !contactInfo?.whatsapp && !contactInfo?.telegram) && (
            <div className="bg-card/50 rounded-2xl border border-border p-12 text-center">
              <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-4">Informations de contact</h3>
              <p className="text-muted-foreground">
                Les informations de contact seront bientôt disponibles.
              </p>
            </div>
          )}

          <div className="mt-12 bg-card/50 rounded-2xl border border-border p-8">
            <h3 className="text-xl font-semibold text-foreground mb-4 text-center">Horaires de disponibilité</h3>
            <div className="grid sm:grid-cols-2 gap-4 text-center">
              <div>
                <p className="font-medium text-foreground">Lundi - Vendredi</p>
                <p className="text-muted-foreground">8h00 - 18h00</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Samedi - Dimanche</p>
                <p className="text-muted-foreground">9h00 - 15h00</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
