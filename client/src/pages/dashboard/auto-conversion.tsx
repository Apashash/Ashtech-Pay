import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ChevronLeft,
  ArrowRight,
  Trash2,
  Plus,
  RefreshCw,
  Loader2,
  Zap,
  Info,
} from "lucide-react";
import { ALL_FX_CURRENCIES } from "@shared/schema";
import type { User, AutoConversionRule } from "@shared/schema";

interface WalletEntry {
  currency: string;
  balance: string;
}

const CURRENCY_FLAGS: Record<string, string> = {
  XAF: "🇨🇲", XAFC: "🇨🇬", XAFG: "🇬🇦",
  XOF: "🇸🇳", XOFC: "🇨🇮", XOFF: "🇧🇫", XOFN: "🇳🇪", XOFB: "🇧🇯", XOFT: "🇹🇬", XOFS: "🇸🇳", XOFM: "🇲🇱",
  GHS: "🇬🇭", NGN: "🇳🇬", KES: "🇰🇪", RWF: "🇷🇼", TZS: "🇹🇿",
  UGX: "🇺🇬", CDF: "🇨🇩", GNF: "🇬🇳", INR: "🇮🇳",
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", USDT: "₮",
};

const CURRENCY_NAMES: Record<string, string> = {};
ALL_FX_CURRENCIES.forEach((c) => { CURRENCY_NAMES[c.code] = c.name; });

export default function AutoConversionPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [fromCurrency, setFromCurrency] = useState("");
  const [toCurrency, setToCurrency] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch current user
  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  // Fetch user wallets (primary + secondary)
  const { data: wallets = [] } = useQuery<WalletEntry[]>({
    queryKey: ["/api/wallets"],
  });

  // Fetch auto-conversion rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery<AutoConversionRule[]>({
    queryKey: ["/api/auto-conversion"],
  });

  // Currencies already used as "from" in a rule
  const usedFromCurrencies = useMemo(
    () => new Set(rules.map((r) => r.fromCurrency)),
    [rules]
  );

  // All wallets the user owns (primary balance + secondary wallets)
  const allUserWallets: WalletEntry[] = useMemo(() => {
    const primary = user?.preferredCurrency || "XAF";
    const primaryBalance = user?.balance || "0";
    const hasPrimary = wallets.some((w) => w.currency === primary);
    const list: WalletEntry[] = hasPrimary
      ? wallets
      : [{ currency: primary, balance: primaryBalance }, ...wallets];
    return list;
  }, [wallets, user]);

  // Source currencies: wallets not yet used as "from" in a rule
  const sourceOptions = useMemo(
    () => allUserWallets.filter((w) => !usedFromCurrencies.has(w.currency)),
    [allUserWallets, usedFromCurrencies]
  );

  // Target currencies: all supported currencies except the chosen source
  const targetOptions = useMemo(
    () => ALL_FX_CURRENCIES.filter((c) => c.code !== fromCurrency),
    [fromCurrency]
  );

  // Create rule mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auto-conversion", { fromCurrency, toCurrency });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] });
      toast({
        title: "Conversion automatique créée",
        description: `${fromCurrency} → ${toCurrency} activée avec succès.`,
      });
      setFromCurrency("");
      setToCurrency("");
      setShowForm(false);
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description: err?.message || "Impossible de créer la règle.",
        variant: "destructive",
      });
    },
  });

  // Delete rule mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id);
      return apiRequest("DELETE", `/api/auto-conversion/${id}`);
    },
    onSuccess: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] });
      toast({ title: "Règle supprimée", description: "La conversion automatique a été désactivée." });
    },
    onError: (err: any) => {
      setDeletingId(null);
      toast({
        title: "Erreur",
        description: err?.message || "Impossible de supprimer la règle.",
        variant: "destructive",
      });
    },
  });

  const canCreate = fromCurrency && toCurrency && fromCurrency !== toCurrency;

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto pb-10">
        {/* Header */}
        <div className="px-4 pt-2 pb-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard/settings")}
            className="p-2 rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Conversion automatique
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dès que vous recevez de l'argent, il est converti automatiquement
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div className="mx-4 mb-5 rounded-xl bg-primary/8 border border-primary/20 p-3.5 flex gap-2.5">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Chaque règle surveille un wallet. Quand de l'argent arrive dans ce wallet,
            il est automatiquement converti vers la devise cible. Une seule règle par devise source.
          </p>
        </div>

        {/* Existing rules */}
        {rulesLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 && !showForm ? (
          <div className="mx-4 rounded-xl border border-dashed border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Aucune conversion automatique</p>
              <p className="text-xs text-muted-foreground mt-1">
                Créez une règle pour convertir automatiquement vos revenus.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mx-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
              >
                {/* From */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">
                      {CURRENCY_FLAGS[rule.fromCurrency] || "💱"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm">{rule.fromCurrency}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {CURRENCY_NAMES[rule.fromCurrency] || rule.fromCurrency}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center gap-1 shrink-0 px-1">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                    auto
                  </span>
                </div>

                {/* To */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">
                      {CURRENCY_FLAGS[rule.toCurrency] || "💱"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm">{rule.toCurrency}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {CURRENCY_NAMES[rule.toCurrency] || rule.toCurrency}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Active badge + delete */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold bg-green-500/10 text-green-500 rounded-full px-2 py-0.5">
                    Actif
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(rule.id)}
                    disabled={deletingId === rule.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {deletingId === rule.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add rule form */}
        {showForm ? (
          <div className="mx-4 mt-4 rounded-xl border border-primary/30 bg-card p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Nouvelle règle de conversion
            </h2>

            {/* Source currency */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Wallet source (argent reçu)
              </label>
              {sourceOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5">
                  Toutes vos devises ont déjà une règle de conversion.
                </p>
              ) : (
                <Select value={fromCurrency} onValueChange={(v) => { setFromCurrency(v); setToCurrency(""); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir le wallet source…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((w) => (
                      <SelectItem key={w.currency} value={w.currency}>
                        <span className="flex items-center gap-2">
                          <span>{CURRENCY_FLAGS[w.currency] || "💱"}</span>
                          <span className="font-medium">{w.currency}</span>
                          <span className="text-muted-foreground text-xs">
                            — {CURRENCY_NAMES[w.currency] || w.currency}
                          </span>
                          <span className="text-muted-foreground text-xs ml-auto">
                            Solde : {parseFloat(w.balance).toLocaleString()}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Arrow indicator */}
            {fromCurrency && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                <div className="flex items-center gap-1 text-xs">
                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                  <span>converti vers</span>
                </div>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {/* Target currency */}
            {fromCurrency && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Devise cible (wallet de destination)
                </label>
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir la devise cible…" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetOptions.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="flex items-center gap-2">
                          <span>{CURRENCY_FLAGS[c.code] || "💱"}</span>
                          <span className="font-medium">{c.code}</span>
                          <span className="text-muted-foreground text-xs">— {c.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowForm(false);
                  setFromCurrency("");
                  setToCurrency("");
                }}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                disabled={!canCreate || createMutation.isPending || sourceOptions.length === 0}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Activer
              </Button>
            </div>
          </div>
        ) : (
          sourceOptions.length > 0 && (
            <div className="mx-4 mt-4">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une conversion automatique
              </Button>
            </div>
          )
        )}

        {/* Footer note */}
        {rules.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-6 px-4">
            Les conversions s'exécutent automatiquement quelques secondes après réception des fonds.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
