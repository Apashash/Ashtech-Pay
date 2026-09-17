import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Check, Loader2, Plus, Search } from "lucide-react";
import { ALL_FX_CURRENCIES } from "@shared/schema";
import { useLanguage } from "@/lib/language";
import { CURRENCY_COUNTRIES, CURRENCY_FLAGS } from "@/lib/walletCurrencies";

interface WalletEntry {
  currency: string;
  balance: string;
}

export default function AddWalletPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [search, setSearch] = useState("");

  const { data: wallets = [], isLoading } = useQuery<WalletEntry[]>({
    queryKey: ["/api/wallets"],
  });

  const availableCurrencies = useMemo(() => {
    const existingCurrencies = new Set(wallets.map((wallet) => wallet.currency));
    const query = search.trim().toLowerCase();
    return ALL_FX_CURRENCIES.filter((currency) => {
      if (existingCurrencies.has(currency.code)) return false;
      if (!query) return true;
      const country = CURRENCY_COUNTRIES[currency.code] || "";
      return `${currency.code} ${currency.name} ${country}`.toLowerCase().includes(query);
    });
  }, [wallets, search]);

  const addWalletMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wallets/create", { currency: selectedCurrency });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({
        title: t.wallets.toastCreated,
        description: `${t.wallets.toastCreatedDescPre}${selectedCurrency}${t.wallets.toastCreatedDescSuf}`,
      });
      navigate("/dashboard/wallets");
    },
    onError: (error: Error) => {
      toast({ title: t.wallets.toastError, description: error.message, variant: "destructive" });
    },
  });

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto pb-10">
        <button
          type="button"
          onClick={() => navigate("/dashboard/wallets")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          data-testid="button-back-wallets"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.wallets.title}
        </button>

        <div className="mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t.wallets.addDialogTitle}</h1>
              <p className="text-sm text-muted-foreground">{t.wallets.addDialogDesc}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un pays ou une devise..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                autoFocus
                data-testid="input-wallet-currency-search"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement...
            </div>
          ) : availableCurrencies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Aucun pays ou devise trouvé.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {availableCurrencies.map((currency) => {
                const country = CURRENCY_COUNTRIES[currency.code] || currency.name;
                const isSelected = selectedCurrency === currency.code;
                return (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => setSelectedCurrency(currency.code)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-0 ${
                      isSelected ? "bg-primary/8" : "hover:bg-muted/40"
                    }`}
                    data-testid={`wallet-currency-option-${currency.code}`}
                  >
                    <span className="text-xl leading-none shrink-0">{CURRENCY_FLAGS[currency.code] || "🌍"}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-sm text-foreground leading-tight">{currency.code}</span>
                      <span className="block text-xs text-muted-foreground truncate">{country}</span>
                    </span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? "bg-primary border-primary" : "border-border"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="p-4 border-t border-border bg-muted/20 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/dashboard/wallets")}
              data-testid="button-cancel-wallet"
            >
              {t.wallets.cancel}
            </Button>
            <Button
              className="flex-1 font-bold"
              disabled={!selectedCurrency || addWalletMutation.isPending}
              onClick={() => addWalletMutation.mutate()}
              data-testid="button-create-wallet"
            >
              {addWalletMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t.wallets.create}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}