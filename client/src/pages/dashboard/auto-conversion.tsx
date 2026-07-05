import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ChevronLeft, ArrowRight, Trash2, Plus, RefreshCw,
  Loader2, Zap, Info, Check, Pencil, X,
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

// ─── Rule card (with inline edit) ────────────────────────────────────────────
function RuleCard({
  rule,
  onDelete,
  onUpdate,
  deletingId,
}: {
  rule: AutoConversionRule;
  onDelete: (id: string) => void;
  onUpdate: (id: string, toCurrency: string) => Promise<void>;
  deletingId: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [newTarget, setNewTarget] = useState(rule.toCurrency);
  const [saving, setSaving] = useState(false);

  const targetOptions = ALL_FX_CURRENCIES.filter((c) => c.code !== rule.fromCurrency);

  async function save() {
    if (!newTarget || newTarget === rule.toCurrency) { setEditing(false); return; }
    setSaving(true);
    await onUpdate(rule.id, newTarget);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Main row */}
      <div className="p-4 flex items-center gap-3">
        {/* From */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{CURRENCY_FLAGS[rule.fromCurrency] || "💱"}</span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm">{rule.fromCurrency}</p>
              <p className="text-xs text-muted-foreground truncate">{CURRENCY_NAMES[rule.fromCurrency] || rule.fromCurrency}</p>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 px-1">
          <ArrowRight className="w-4 h-4 text-primary" />
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">auto</span>
        </div>

        {/* To */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{CURRENCY_FLAGS[rule.toCurrency] || "💱"}</span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm">{rule.toCurrency}</p>
              <p className="text-xs text-muted-foreground truncate">{CURRENCY_NAMES[rule.toCurrency] || rule.toCurrency}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-semibold bg-green-500/10 text-green-500 rounded-full px-2 py-0.5">Actif</span>
          <button
            onClick={() => { setEditing(!editing); setNewTarget(rule.toCurrency); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Modifier"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            disabled={deletingId === rule.id}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            title="Supprimer"
          >
            {deletingId === rule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Inline edit panel */}
      {editing && (
        <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Changer la devise cible :</p>
          <Select value={newTarget} onValueChange={setNewTarget}>
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue />
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => setEditing(false)} disabled={saving}>
              <X className="w-3.5 h-3.5 mr-1" /> Annuler
            </Button>
            <Button size="sm" className="flex-1 h-8" onClick={save} disabled={saving || !newTarget}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              Enregistrer
            </Button>
          </div>
          {newTarget !== rule.toCurrency && (
            <p className="text-[10px] text-primary flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Si vous avez un solde en {rule.fromCurrency}, la conversion démarrera immédiatement.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AutoConversionPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [toCurrency, setToCurrency] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: wallets = [] } = useQuery<WalletEntry[]>({ queryKey: ["/api/wallets"] });
  const { data: rules = [], isLoading: rulesLoading } = useQuery<AutoConversionRule[]>({
    queryKey: ["/api/auto-conversion"],
  });

  const usedFromCurrencies = useMemo(() => new Set(rules.map((r) => r.fromCurrency)), [rules]);

  const balanceMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (user) map[user.preferredCurrency || "XAF"] = user.balance;
    wallets.forEach((w) => { map[w.currency] = w.balance; });
    return map;
  }, [wallets, user]);

  // All currencies not yet used as a source
  const sourceOptions = useMemo(
    () => ALL_FX_CURRENCIES.filter((c) => !usedFromCurrencies.has(c.code)),
    [usedFromCurrencies]
  );

  const targetOptions = useMemo(
    () => ALL_FX_CURRENCIES.filter((c) => !selectedSources.has(c.code)),
    [selectedSources]
  );

  function toggleSource(code: string) {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    if (toCurrency && selectedSources.has(toCurrency)) setToCurrency("");
  }

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { setDeletingId(id); return apiRequest("DELETE", `/api/auto-conversion/${id}`); },
    onSuccess: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] });
      toast({ title: "Règle supprimée" });
    },
    onError: (err: any) => {
      setDeletingId(null);
      toast({ title: "Erreur", description: err?.message || "Impossible de supprimer.", variant: "destructive" });
    },
  });

  // Update (edit toCurrency)
  async function handleUpdate(id: string, newToCurrency: string) {
    try {
      await apiRequest("PATCH", `/api/auto-conversion/${id}`, { toCurrency: newToCurrency });
      await queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] });
      toast({
        title: "Règle mise à jour",
        description: "La conversion démarre immédiatement si vous avez un solde à convertir.",
      });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible de modifier.", variant: "destructive" });
    }
  }

  // Create multiple rules sequentially
  async function handleCreate() {
    if (selectedSources.size === 0 || !toCurrency) return;
    setCreating(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const from of Array.from(selectedSources)) {
      if (from === toCurrency) continue;
      try {
        await apiRequest("POST", "/api/auto-conversion", { fromCurrency: from, toCurrency });
        successCount++;
      } catch (err: any) {
        errors.push(`${from}: ${err?.message || "Erreur"}`);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] });
    setCreating(false);

    if (successCount > 0) {
      toast({
        title: successCount === 1 ? "Conversion automatique créée" : `${successCount} conversions créées`,
        description: "La conversion démarre immédiatement si vous avez un solde à convertir.",
      });
    }
    if (errors.length > 0) {
      toast({ title: "Certaines règles n'ont pas pu être créées", description: errors.join("\n"), variant: "destructive" });
    }

    setSelectedSources(new Set());
    setToCurrency("");
    setShowForm(false);
  }

  const canCreate = selectedSources.size > 0 && toCurrency && !selectedSources.has(toCurrency);

  function resetForm() {
    setShowForm(false);
    setSelectedSources(new Set());
    setToCurrency("");
  }

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
            Sélectionnez une ou plusieurs devises source. Dès que de l'argent arrive (ou est déjà présent),
            il est converti automatiquement vers la devise cible.
          </p>
        </div>

        {/* Existing rules */}
        {rulesLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {rules.length > 0 && (
              <div className="space-y-3 mx-4 mb-4">
                {rules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    deletingId={deletingId}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            )}

            {rules.length === 0 && !showForm && (
              <div className="mx-4 rounded-xl border border-dashed border-border bg-card p-8 flex flex-col items-center gap-3 text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Aucune conversion automatique</p>
                  <p className="text-xs text-muted-foreground mt-1">Créez une règle pour convertir automatiquement vos revenus.</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Add rule form */}
        {showForm ? (
          <div className="mx-4 rounded-xl border border-primary/30 bg-card p-5 space-y-5">
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Nouvelle règle de conversion
            </h2>

            {/* Multi-select source grid */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Wallet(s) source — argent reçu
                {selectedSources.size > 0 && (
                  <span className="ml-2 text-primary">({selectedSources.size} sélectionné{selectedSources.size > 1 ? "s" : ""})</span>
                )}
              </label>
              {sourceOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5">
                  Toutes les devises ont déjà une règle de conversion.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {sourceOptions.map((c) => {
                    const selected = selectedSources.has(c.code);
                    const balance = balanceMap[c.code];
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggleSource(c.code)}
                        className={`relative flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                          selected
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
                        }`}
                      >
                        <span className="text-xl leading-none shrink-0">{CURRENCY_FLAGS[c.code] || "💱"}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground text-sm leading-tight">{c.code}</p>
                          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{c.name}</p>
                          {balance !== undefined && parseFloat(balance) > 0 && (
                            <p className="text-[10px] text-primary font-medium mt-0.5">
                              {parseFloat(balance).toLocaleString()}
                            </p>
                          )}
                        </div>
                        {selected && (
                          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-primary-foreground" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Arrow divider */}
            {selectedSources.size > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                  <span>converti vers</span>
                </div>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {/* Target */}
            {selectedSources.size > 0 && (
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
                {toCurrency && selectedSources.size > 0 && (
                  <p className="text-[10px] text-primary flex items-center gap-1 pt-0.5">
                    <Zap className="w-3 h-3" />
                    Si un solde existe déjà dans ces wallets, la conversion démarre immédiatement.
                  </p>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={resetForm} disabled={creating}>
                Annuler
              </Button>
              <Button className="flex-1" disabled={!canCreate || creating} onClick={handleCreate}>
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {selectedSources.size > 1 ? `Activer (${selectedSources.size})` : "Activer"}
              </Button>
            </div>
          </div>
        ) : (
          sourceOptions.length > 0 && (
            <div className="mx-4">
              <Button className="w-full" variant="outline" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une conversion automatique
              </Button>
            </div>
          )
        )}

        {rules.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-6 px-4">
            Les conversions s'exécutent automatiquement quelques secondes après réception des fonds.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
