import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ChevronLeft, ArrowRight, Trash2, Plus, RefreshCw,
  Loader2, Zap, Info, Check, Pencil, X, Search, Wallet,
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

// ─── Source picker modal ──────────────────────────────────────────────────────
// Uses a local draft so Cancel truly discards; Confirmer commits the selection.
function SourcePickerModal({
  open,
  onClose,
  onConfirm,
  options,
  initialSelected,
  balanceMap,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (selected: Set<string>) => void;
  options: { code: string; name: string }[];
  initialSelected: Set<string>;
  balanceMap: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  // Local draft — copied from parent on open; never mutates parent until Confirm
  const [draft, setDraft] = useState<Set<string>>(new Set());

  // Sync draft when modal opens
  useState(() => { setDraft(new Set(initialSelected)); });

  // Reset draft each time the modal opens
  const handleOpenChange = (v: boolean) => {
    if (v) setDraft(new Set(initialSelected));
    else onClose();
  };

  function toggleDraft(code: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(draft);
    onClose();
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return options.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [options, search]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-base font-semibold">
            Wallets source
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sélectionnez une ou plusieurs devises à convertir automatiquement
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher une devise…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-[55vh]">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucun résultat</p>
          ) : (
            filtered.map((c) => {
              const isSelected = draft.has(c.code);
              const balance = balanceMap[c.code];
              const hasBalance = balance !== undefined && parseFloat(balance) > 0;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => toggleDraft(c.code)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-0 ${
                    isSelected ? "bg-primary/8" : "hover:bg-muted/40"
                  }`}
                >
                  <span className="text-xl leading-none shrink-0">{CURRENCY_FLAGS[c.code] || "💱"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground leading-tight">{c.code}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                    {hasBalance && (
                      <p className="text-[11px] text-primary font-medium mt-0.5">
                        Solde : {parseFloat(balance).toLocaleString()} {c.code}
                      </p>
                    )}
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? "bg-primary border-primary" : "border-border"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border bg-muted/20 flex gap-2">
          <Button variant="outline" className="flex-1 h-9" onClick={onClose}>
            Annuler
          </Button>
          <Button className="flex-1 h-9" onClick={handleConfirm} disabled={draft.size === 0}>
            <Check className="w-4 h-4 mr-1.5" />
            Confirmer ({draft.size})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Grouped rule card ────────────────────────────────────────────────────────
// Groups all rules with the same toCurrency into one card.
function GroupedRuleCard({
  toCurrency,
  rules,
  balanceMap,
  onDelete,
  onUpdate,
  deletingId,
}: {
  toCurrency: string;
  rules: AutoConversionRule[];
  balanceMap: Record<string, string>;
  onDelete: (id: string) => void;
  onUpdate: (id: string, newToCurrency: string, silent?: boolean) => Promise<void>;
  deletingId: string | null;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [newTarget, setNewTarget] = useState(toCurrency);
  const [saving, setSaving] = useState(false);

  // All codes used as sources in this group — can't be target
  const usedSources = new Set(rules.map((r) => r.fromCurrency));
  const targetOptions = ALL_FX_CURRENCIES.filter((c) => !usedSources.has(c.code));

  async function saveAll() {
    if (!newTarget || newTarget === toCurrency) { setEditing(false); return; }
    setSaving(true);
    const failed: string[] = [];
    for (const rule of rules) {
      try {
        // silent=true: suppress per-rule toast and rethrow on error
        await onUpdate(rule.id, newTarget, true);
      } catch {
        failed.push(rule.fromCurrency);
      }
    }
    setSaving(false);
    const ok = rules.length - failed.length;
    if (failed.length === 0) {
      setEditing(false);
      toast({
        title: ok === 1 ? "Règle mise à jour" : `${ok} règles mises à jour`,
        description: "La conversion démarre immédiatement si un solde est disponible.",
      });
    } else {
      toast({
        title: "Mise à jour partielle",
        description: `${ok} règle(s) mise(s) à jour. Échec pour : ${failed.join(", ")}.`,
        variant: "destructive",
      });
      // edit mode stays open so user can retry
    }
  }

  // Total sources with balance
  const totalBalance = rules.reduce((sum, rule) => {
    const bal = parseFloat(balanceMap[rule.fromCurrency] || "0");
    return sum + (isFinite(bal) ? bal : 0);
  }, 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Conversion automatique
          </span>
          <span className="text-[10px] font-semibold bg-green-500/10 text-green-500 rounded-full px-2 py-0.5">Actif</span>
        </div>

        {/* Sources | arrow | destination */}
        <div className="flex items-stretch gap-2">

          {/* Left: source rows */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {rules.map((rule) => {
              const balance = balanceMap[rule.fromCurrency];
              const hasBalance = balance !== undefined && parseFloat(balance) > 0;
              return (
                <div key={rule.id} className="flex items-center gap-1.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0 rounded-lg bg-muted/30 px-2.5 py-2">
                    <span className="text-base leading-none shrink-0">{CURRENCY_FLAGS[rule.fromCurrency] || "💱"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground leading-tight">{rule.fromCurrency}</p>
                      {hasBalance && (
                        <p className="text-[10px] text-primary font-medium leading-tight">
                          {parseFloat(balance).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Delete per source */}
                  <button
                    onClick={() => onDelete(rule.id)}
                    disabled={deletingId === rule.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0"
                    title="Supprimer"
                  >
                    {deletingId === rule.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Center: single arrow */}
          <div className="flex items-center justify-center px-1 shrink-0">
            <div className="flex flex-col items-center gap-0.5">
              <ArrowRight className="w-4 h-4 text-primary" />
              <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-semibold leading-none">auto</span>
            </div>
          </div>

          {/* Right: destination (once, vertically centered) */}
          <div className="flex items-center">
            <div className="flex items-center gap-2 rounded-xl bg-primary/8 border border-primary/20 px-3 py-3 min-w-[90px]">
              <span className="text-xl leading-none shrink-0">{CURRENCY_FLAGS[toCurrency] || "💱"}</span>
              <div className="min-w-0">
                <p className="font-bold text-sm text-foreground leading-tight">{toCurrency}</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate max-w-[60px]">
                  {CURRENCY_NAMES[toCurrency] || toCurrency}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mt-2.5">
          {totalBalance > 0 && (
            <p className="text-[10px] text-primary flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Soldes en cours de conversion
            </p>
          )}
          <button
            onClick={() => { setEditing(!editing); setNewTarget(toCurrency); }}
            className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Changer la devise cible pour tout le groupe"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline edit panel */}
      {editing && (
        <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3">
          <p className="text-xs text-muted-foreground font-medium">
            Changer la devise cible pour toutes les sources :
          </p>
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
            <Button size="sm" className="flex-1 h-8" onClick={saveAll} disabled={saving || !newTarget}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              Enregistrer
            </Button>
          </div>
          {newTarget !== toCurrency && (
            <p className="text-[10px] text-primary flex items-center gap-1">
              <Zap className="w-3 h-3" />
              La conversion démarrera immédiatement si un solde est disponible.
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
  const [showPicker, setShowPicker] = useState(false);
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

  // Currencies not yet used as source
  const sourceOptions = useMemo(
    () => ALL_FX_CURRENCIES.filter((c) => !usedFromCurrencies.has(c.code)),
    [usedFromCurrencies]
  );

  const targetOptions = useMemo(
    () => ALL_FX_CURRENCIES.filter((c) => !selectedSources.has(c.code)),
    [selectedSources]
  );

  // Group existing rules by toCurrency
  const groupedRules = useMemo(() => {
    const groups: Record<string, AutoConversionRule[]> = {};
    for (const rule of rules) {
      if (!groups[rule.toCurrency]) groups[rule.toCurrency] = [];
      groups[rule.toCurrency].push(rule);
    }
    return groups;
  }, [rules]);

  function toggleSource(code: string) {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id);
      return apiRequest("DELETE", `/api/auto-conversion/${id}`);
    },
    onSuccess: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Règle supprimée" });
    },
    onError: (err: any) => {
      setDeletingId(null);
      toast({ title: "Erreur", description: err?.message || "Impossible de supprimer.", variant: "destructive" });
    },
  });

  // Update (edit toCurrency).
  // silent=true: skip toasts and rethrow so batch callers (saveAll) can aggregate.
  async function handleUpdate(id: string, newToCurrency: string, silent = false) {
    try {
      await apiRequest("PATCH", `/api/auto-conversion/${id}`, { toCurrency: newToCurrency });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/wallets"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
      ]);
      if (!silent) {
        toast({
          title: "Règle mise à jour",
          description: "La conversion démarre immédiatement si vous avez un solde à convertir.",
        });
      }
    } catch (err: any) {
      if (!silent) {
        toast({ title: "Erreur", description: err?.message || "Impossible de modifier.", variant: "destructive" });
      }
      throw err; // rethrow so batch callers detect partial failure
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

    // Refresh all balances and rules after creation — conversion may have started
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
    ]);
    setCreating(false);

    if (successCount > 0) {
      toast({
        title: successCount === 1 ? "Conversion automatique créée" : `${successCount} conversions créées`,
        description: "La conversion démarre immédiatement si un solde est disponible.",
      });
    }
    if (errors.length > 0) {
      toast({ title: "Certaines règles n'ont pas pu être créées", description: errors.join("\n"), variant: "destructive" });
    }

    setSelectedSources(new Set());
    setToCurrency("");
    setShowForm(false);
  }

  const canCreate = selectedSources.size > 0 && !!toCurrency && !selectedSources.has(toCurrency);

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
            Chaque wallet source est converti automatiquement vers le wallet de destination dès réception des fonds,
            ou immédiatement si un solde est déjà présent.
          </p>
        </div>

        {/* Existing rules grouped */}
        {rulesLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {Object.keys(groupedRules).length > 0 && (
              <div className="space-y-3 mx-4 mb-4">
                {Object.entries(groupedRules).map(([toCurr, groupRules]) => (
                  <GroupedRuleCard
                    key={toCurr}
                    toCurrency={toCurr}
                    rules={groupRules}
                    balanceMap={balanceMap}
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

            {/* Source selector button */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Wallet(s) source — argent reçu
              </label>

              {sourceOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5">
                  Toutes les devises ont déjà une règle de conversion.
                </p>
              ) : (
                <>
                  {/* Trigger button */}
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      selectedSources.size > 0
                        ? "border-primary bg-primary/8"
                        : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm">
                      {selectedSources.size === 0 ? (
                        <span className="text-muted-foreground">Choisir les wallets source…</span>
                      ) : (
                        <span className="text-foreground font-medium">
                          {Array.from(selectedSources).join(", ")}
                        </span>
                      )}
                    </span>
                    {selectedSources.size > 0 && (
                      <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-2 py-0.5 shrink-0">
                        {selectedSources.size}
                      </span>
                    )}
                    <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0 rotate-180" />
                  </button>

                  {/* Selected preview chips */}
                  {selectedSources.size > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(selectedSources).map((code) => {
                        const bal = balanceMap[code];
                        const hasBal = bal && parseFloat(bal) > 0;
                        return (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full pl-2 pr-1 py-0.5"
                          >
                            <span>{CURRENCY_FLAGS[code] || "💱"}</span>
                            <span>{code}</span>
                            {hasBal && (
                              <span className="text-[10px] text-primary/70">
                                {parseFloat(bal).toLocaleString()}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleSource(code)}
                              className="ml-0.5 w-4 h-4 rounded-full hover:bg-primary/20 flex items-center justify-center"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </>
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

      {/* Source picker modal */}
      <SourcePickerModal
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onConfirm={(confirmed) => setSelectedSources(confirmed)}
        options={sourceOptions}
        initialSelected={selectedSources}
        balanceMap={balanceMap}
      />
    </DashboardLayout>
  );
}
