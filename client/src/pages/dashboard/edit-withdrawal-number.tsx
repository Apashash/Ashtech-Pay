import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WithdrawalNumber, User } from "@shared/schema";
import { Phone, Loader2, ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useLocation, useParams } from "wouter";

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

export default function EditWithdrawalNumberPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const [selectedOperator, setSelectedOperator] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [label, setLabel] = useState("");

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  
  const { data: withdrawalNumbers = [] } = useQuery<WithdrawalNumber[]>({
    queryKey: ["/api/withdrawal-numbers"],
  });

  const currentNumber = withdrawalNumbers.find(n => n.id === params.id);

  useEffect(() => {
    if (currentNumber) {
      setSelectedOperator(currentNumber.operatorName);
      setPhoneNumber(currentNumber.phoneNumber);
      setLabel(currentNumber.label || "");
    }
  }, [currentNumber]);

  const { data: countriesConfig = [] } = useQuery<CountryConfig[]>({
    queryKey: ["/api/public/withdrawal-operators"],
  });

  const operators = useMemo(() => {
    if (!countriesConfig.length || !user?.country) return [];
    
    const userCountryLower = user.country.toLowerCase().trim();
    
    const userCountry = countriesConfig.find(c => {
      const configNameLower = c.name.toLowerCase().trim();
      return configNameLower === userCountryLower || 
             configNameLower.includes(userCountryLower) ||
             userCountryLower.includes(configNameLower) ||
             (c.name.toLowerCase().includes("cameroun") && userCountryLower.includes("cameroon")) ||
             (c.name.toLowerCase().includes("cameroon") && userCountryLower.includes("cameroun"));
    });
    
    if (!userCountry) return [];
    
    return userCountry.operators.map(op => op.name);
  }, [countriesConfig, user?.country]);

  const requestChangeMutation = useMutation({
    mutationFn: async (data: { id: string; phoneNumber: string; operatorName: string; label?: string }) => {
      const res = await apiRequest("POST", `/api/withdrawal-numbers/${data.id}/request-change`, {
        phoneNumber: data.phoneNumber,
        operatorName: data.operatorName,
        label: data.label,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-number-changes"] });
      toast({ 
        title: "Demande envoyée", 
        description: "Votre demande de modification a été envoyée pour approbation" 
      });
      setLocation("/dashboard/withdrawal-numbers");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!selectedOperator || !phoneNumber || !params.id) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    requestChangeMutation.mutate({
      id: params.id,
      phoneNumber,
      operatorName: selectedOperator,
      label: label || undefined,
    });
  };

  if (!currentNumber) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

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
            <h1 className="text-2xl font-bold text-foreground">Modifier le numéro de retrait</h1>
            <p className="text-muted-foreground">La modification nécessite une approbation admin</p>
          </div>
        </div>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-500">Approbation requise</p>
                <p className="text-sm text-muted-foreground">
                  Toute modification de numéro de retrait doit être approuvée par un administrateur pour des raisons de sécurité.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle>Informations du numéro</CardTitle>
            <CardDescription>
              Modifiez les informations de votre numéro {selectedOperator}
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
              disabled={requestChangeMutation.isPending || !phoneNumber || !selectedOperator}
            >
              {requestChangeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Soumettre la demande de modification
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
