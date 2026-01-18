import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Code, Clock } from "lucide-react";

export default function ApiKeysPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clés API</h1>
          <p className="text-muted-foreground">Gérez vos clés API pour l'intégration</p>
        </div>

        <Card className="border-primary/20">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Code className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">Fonctionnalité à venir</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              L'API Ashtech Pay vous permettra d'intégrer les paiements directement dans votre application ou site web. 
              Cette fonctionnalité sera bientôt disponible.
            </p>
            <div className="flex items-center gap-2 text-primary">
              <Clock className="w-5 h-5" />
              <span className="font-medium">Bientôt disponible</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
