import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen } from "lucide-react";


export default function BlogPage() {
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
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Actualités</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Blog</h1>
            <p className="text-lg text-muted-foreground">
              Découvrez nos derniers articles, conseils et actualités
            </p>
          </div>

          <div className="bg-card/50 rounded-2xl border border-border p-12 text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-foreground mb-4">Bientôt disponible</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Notre blog est en cours de préparation. Revenez bientôt pour découvrir des articles sur 
              les paiements en ligne, l'entrepreneuriat africain et des conseils pour développer votre business.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
