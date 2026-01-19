import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { Phone, Loader2, ArrowLeft, Check } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";

interface CountryConfig {
  id: string;
  name: string;
  code: string;
  flag: string;
  currency: string;
  operators: Array<{
    id: string;
    name: string;
  }>;
}

export default function AddWithdrawalNumberPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedOperator, setSelectedOperator] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [label, setLabel] = useState("");

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  
  const { data: countriesConfig = [] } = useQuery<CountryConfig[]>({
    queryKey: ["/api/public/deposit-config"],
  });

  const operators = useMemo(() => {
    if (!countriesConfig.length || !user?.country) return [];
    
    const userCountry = countriesConfig.find(c => 
      c.name === user.country || c.name.toLowerCase() === user.country?.toLowerCase()
    );
    
    if (!userCountry) return [];
    
    return userCountry.operators.map(op => op.name);
  }, [countriesConfig, user?.country]);

  const addNumberMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; operatorName: string; label?: string }) => {
      const res = await apiRequest("POST", "/api/withdrawal-numbers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-numbers"] });
      toast({ title: "Numéro ajouté", description: "Le numéro de retrait a été enregistré avec succès" });
      setLocation("/dashboard/withdrawal-numbers");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!selectedOperator || !phoneNumber) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un opérateur et saisir un numéro", variant: "destructive" });
      return;
    }
    addNumberMutation.mutate({
      phoneNumber,
      operatorName: selectedOperator,
      label: label || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation("/dashboard/withdrawal-numbers")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ajouter un numéro de retrait</h1>
            <p className="text-muted-foreground">Sélectionnez votre opérateur et saisissez votre numéro</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Choisir un opérateur
            </CardTitle>
            <CardDescription>
              Opérateurs disponibles pour {user?.country || "votre pays"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {operators.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Aucun opérateur disponible pour votre pays</p>
                <p className="text-sm">Contactez le support pour plus d'informations</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {operators.map((operator) => (
                  <button
                    key={operator}
                    type="button"
                    onClick={() => setSelectedOperator(operator)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedOperator === operator
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{operator}</span>
                      {selectedOperator === operator && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedOperator && (
          <Card>
            <CardHeader>
              <CardTitle>Informations du numéro</CardTitle>
              <CardDescription>
                Saisissez le numéro {selectedOperator} pour les retraits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Numéro de téléphone</Label>
                <Input
                  id="phoneNumber"
                  placeholder="+237 6XX XXX XXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Libellé (optionnel)</Label>
                <Input
                  id="label"
                  placeholder="ex: Principal, Secondaire"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={addNumberMutation.isPending || !phoneNumber}
              >
                {addNumberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer le numéro
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
