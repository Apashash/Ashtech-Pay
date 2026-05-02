import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  Settings,
  Globe,
  Smartphone,
  AlertTriangle,
  Lock,
  Zap
} from "lucide-react";

export default function AdminSettings() {
  const [, setLocation] = useLocation();

  const settingsSections = [
    {
      id: "platform",
      title: "Info de la plateforme",
      description: "Nom, devise, contact support",
      icon: Settings,
      color: "bg-blue-500/10 text-blue-600",
      borderColor: "border-blue-500/30"
    },
    {
      id: "public-info",
      title: "Info page public",
      description: "Email, téléphone, réseaux sociaux",
      icon: Globe,
      color: "bg-green-500/10 text-green-600",
      borderColor: "border-green-500/30"
    },
    {
      id: "rates",
      title: "Device et taux",
      description: "Taux de change par devise",
      icon: Smartphone,
      color: "bg-purple-500/10 text-purple-600",
      borderColor: "border-purple-500/30"
    },
    {
      id: "maintenance",
      title: "Mode maintenance",
      description: "Activer/désactiver le mode maintenance",
      icon: AlertTriangle,
      color: "bg-orange-500/10 text-orange-600",
      borderColor: "border-orange-500/30"
    },
    {
      id: "limits",
      title: "Limit globale",
      description: "Limites min/max des transferts et retraits",
      icon: Lock,
      color: "bg-red-500/10 text-red-600",
      borderColor: "border-red-500/30"
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">Configuration générale de la plateforme</p>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Modules de configuration</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card 
                key={section.id}
                className={`cursor-pointer hover:shadow-lg transition-all border-2 ${section.borderColor}`}
                onClick={() => setLocation(`/admin/settings/${section.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${section.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  <CardTitle className="mt-4 text-base">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/admin/settings/${section.id}`);
                    }}
                  >
                    Configurer →
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
