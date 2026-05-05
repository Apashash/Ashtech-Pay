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
import { useLanguage } from "@/lib/language";

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
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [selectedOperator, setSelectedOperator] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [label, setLabel] = useState("");

  const { data: user, isLoading: userLoading } = useQuery<User>({ queryKey: ["/api/user"] });

  const { data: countriesConfig = [], isLoading: operatorsLoading } = useQuery<CountryConfig[]>({
    queryKey: ["/api/public/withdrawal-operators"],
  });

  const isLoading = userLoading || operatorsLoading;

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

  const addNumberMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; operatorName: string; label?: string }) => {
      const res = await apiRequest("POST", "/api/withdrawal-numbers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-numbers"] });
      toast({ title: t.addWithdrawalNumber.toastAdded, description: t.addWithdrawalNumber.toastAddedDesc });
      setLocation("/dashboard/withdrawal-numbers");
    },
    onError: (error: Error) => {
      toast({ title: t.addWithdrawalNumber.toastError, description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!selectedOperator || !phoneNumber) {
      toast({ title: t.addWithdrawalNumber.toastError, description: t.addWithdrawalNumber.toastErrorDesc, variant: "destructive" });
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
            <h1 className="text-2xl font-semibold text-foreground">{t.addWithdrawalNumber.title}</h1>
            <p className="text-muted-foreground">{t.addWithdrawalNumber.subtitle}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              {t.addWithdrawalNumber.chooseOperator}
            </CardTitle>
            <CardDescription>
              {t.addWithdrawalNumber.operatorsFor} {user?.country || t.addWithdrawalNumber.yourCountry}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : operators.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t.addWithdrawalNumber.noOperators}</p>
                <p className="text-sm">{t.addWithdrawalNumber.contactSupport}</p>
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
              <CardTitle>{t.addWithdrawalNumber.numberInfo}</CardTitle>
              <CardDescription>
                {t.addWithdrawalNumber.numberInfoDescPre}{selectedOperator}{t.addWithdrawalNumber.numberInfoDescSuf}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">{t.addWithdrawalNumber.phoneLabel}</Label>
                <Input
                  id="phoneNumber"
                  placeholder="XXXXXXXXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">{t.addWithdrawalNumber.labelLabel}</Label>
                <Input
                  id="label"
                  placeholder={t.addWithdrawalNumber.labelPlaceholder}
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
                {t.addWithdrawalNumber.saveButton}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
