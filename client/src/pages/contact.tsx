import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail, Phone, MessageCircle, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";


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

            <Card className="p-6 bg-card border-border text-center">
              <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Facebook</h3>
              <a 
                href="https://www.facebook.com/share/1Eczpeowdp/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Ashtech Pay
              </a>
            </Card>

            <Card className="p-6 bg-card border-border text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Canal WhatsApp</h3>
              <a 
                href="https://whatsapp.com/channel/0029VbC5tPPCxoAveJ44Vs2w"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-500 hover:underline"
              >
                Suivre notre canal
              </a>
            </Card>
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
