import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Key, Copy, Eye, EyeOff, Plus, Trash2, RefreshCw, Code, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const mockApiKeys = [
  { id: "1", name: "Production", key: "sk_live_xxxxxxxxxxxxxxxxxxxxxx", created: "2024-01-15", active: true },
  { id: "2", name: "Test", key: "sk_test_xxxxxxxxxxxxxxxxxxxxxx", created: "2024-01-10", active: true },
];

export default function ApiKeysPage() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Clé copiée", description: "La clé API a été copiée dans le presse-papier" });
  };

  const toggleShowKey = (id: string) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clés API</h1>
            <p className="text-muted-foreground">Gérez vos clés API pour l'intégration</p>
          </div>
          <Button data-testid="button-new-api-key">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle clé
          </Button>
        </div>

        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Gardez vos clés API secrètes</p>
              <p className="text-sm text-muted-foreground">
                Ne partagez jamais vos clés API. Utilisez les clés de test pour le développement et les clés de production uniquement en production.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {mockApiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Key className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{apiKey.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          apiKey.active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                        }`}>
                          {apiKey.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <code className="px-3 py-1.5 bg-muted rounded text-sm font-mono">
                          {showKey[apiKey.id] ? apiKey.key : apiKey.key.replace(/./g, '*').substring(0, 30) + '...'}
                        </code>
                        <Button variant="ghost" size="icon" onClick={() => toggleShowKey(apiKey.id)} data-testid={`button-toggle-key-${apiKey.id}`}>
                          {showKey[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => copyKey(apiKey.key)} data-testid={`button-copy-key-${apiKey.id}`}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Créée le {apiKey.created}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" data-testid={`button-refresh-key-${apiKey.id}`}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" data-testid={`button-delete-key-${apiKey.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              Documentation API
            </CardTitle>
            <CardDescription>Intégrez Ashtech Pay dans votre application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-2">Exemple d'intégration</p>
              <pre className="text-sm text-muted-foreground overflow-x-auto">
{`// Créer un lien de paiement
const response = await fetch('https://api.ashtechpay.com/v1/payment-links', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_xxx',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 10000,
    currency: 'XAF',
    title: 'Paiement commande #123'
  })
});`}
              </pre>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" data-testid="button-view-docs">
                Voir la documentation
              </Button>
              <Button variant="outline" data-testid="button-download-sdk">
                Télécharger le SDK
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
