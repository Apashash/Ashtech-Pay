import { useState, useMemo, useEffect } from "react";
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
  Loader2, Zap, Check, Pencil, X, Search, Wallet,
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
  RWF: "🇷🇼", TZS: "🇹🇿",
  UGX: "🇺🇬", CDF: "🇨🇩", SLE: "🇸🇱",
  GHS: "🇬🇭", KES: "🇰🇪", NGN: "🇳🇬", MWK: "🇲🇼", LSL: "🇱🇸", ZMW: "🇿🇲", ZMK: "🇿🇲",
  ZAR: "🇿🇦", EGP: "🇪🇬", MAD: "🇲🇦", ETB: "🇪🇹", MZN: "🇲🇿", ZWE: "🇿🇼", CVE: "🇨🇻",
  XAFCF: "🇨🇫", XAFTD: "🇹🇩", XOFGW: "🇬🇼",
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", CHF: "🇨🇭", USDT: "₮",
  CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿",
  INR: "🇮🇳", PKR: "🇵🇰", BDT: "🇧🇩", LRK: "🇱🇰",
  PHP: "🇵🇭", IDR: "🇮🇩", MYR: "🇲🇾", THB: "🇹🇭",
  VND: "🇻🇳", KRW: "🇰🇷", JPY: "🇯🇵", HKD: "🇭🇰", CHN: "🇨🇳",
  SAR: "🇸🇦", AED: "🇦🇪", QAR: "🇶🇦", KWD: "🇰🇼", BHD: "🇧🇭",
  ILS: "🇮🇱", TRY: "🇹🇷",
  SEK: "🇸🇪", NOK: "🇳🇴", DKK: "🇩🇰", PLN: "🇵🇱",
  CZK: "🇨🇿", HUF: "🇭🇺", RON: "🇷🇴", BGN: "🇧🇬", ISK: "🇮🇸",
  BRL: "🇧🇷", MXN: "🇲🇽", ARS: "🇦🇷", CLP: "🇨🇱", COP: "🇨🇴",
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

  // Sync draft from initialSelected every time the modal opens
  useEffect(() => {
    if (open) {
      setDraft(new Set(initialSelected));
      setSearch("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenChange = (v: boolean) => {
    if (!v) onClose();
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
                  <span className="text-xl leading-none shrink-0">{CURRENCY_FLAGS[c.code] || "🌍"}</span>
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
function GroupedRuleCard({
  toCurrency,
  rules,
  balanceMap,
  availableSources,   // currencies free to add (not used in any other rule)
  availableTargets,   // currencies that can be set as target in edit mode
  onDelete,
  onDeleteAll,
  onUpdate,
  onCreate,
}: {
  toCurrency: string;
  rules: AutoConversionRule[];
  balanceMap: Record<string, string>;
  availableSources: { code: string; name: string }[];
  availableTargets: { code: string; name: string }[];
  onDelete: (id: string) => Promise<void>;
  onDeleteAll: (ids: string[]) => Promise<void>;
  onUpdate: (id: string, newToCurrency: string, silent?: boolean) => Promise<void>;
  onCreate: (fromCurrency: string, toCurrency: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // Edit state — initialised when edit opens
  const currentSources = useMemo(() => new Set(rules.map((r) => r.fromCurrency)), [rules]);
  const [editSources, setEditSources] = useState<Set<string>>(new Set());
  const [newTarget, setNewTarget] = useState(toCurrency);

  function openEdit() {
    setEditSources(new Set(currentSources));
    setNewTarget(toCurrency);
    setEditing(true);
  }

  // Picker options = current sources + globally free sources (so user can deselect existing ones too)
  const pickerOptions = useMemo(() => {
    const existing = ALL_FX_CURRENCIES.filter((c) => currentSources.has(c.code));
    const free = availableSources.filter((c) => !currentSources.has(c.code));
    return [...existing, ...free];
  }, [currentSources, availableSources]);

  // Target options = availableTargets filtered by current edit sources draft
  const targetOptions = useMemo(
    () => availableTargets.filter((c) => !editSources.has(c.code)),
    [availableTargets, editSources]
  );

  async function saveEdit() {
    if (editSources.size === 0) return;
    setSaving(true);
    const errors: string[] = [];

    // 1. Sources to remove (were in old set, not in new set)
    const toRemove = rules.filter((r) => !editSources.has(r.fromCurrency));
    for (const rule of toRemove) {
      try { await onDelete(rule.id); } catch { errors.push(`Suppression ${rule.fromCurrency}`); }
    }

    // 2. Sources to add (in new set, not in old set)
    const toAdd = Array.from(editSources).filter((c) => !currentSources.has(c));
    for (const from of toAdd) {
      try { await onCreate(from, newTarget); } catch { errors.push(`Ajout ${from}`); }
    }

    // 3. Target changed — update all remaining rules
    if (newTarget !== toCurrency) {
      const remaining = rules.filter((r) => editSources.has(r.fromCurrency));
      for (const rule of remaining) {
        try { await onUpdate(rule.id, newTarget, true); } catch { errors.push(`Cible ${rule.fromCurrency}`); }
      }
    }

    setSaving(false);

    if (errors.length === 0) {
      setEditing(false);
      toast({ title: "Règles mises à jour", description: "La conversion démarre immédiatement si un solde est disponible." });
    } else {
      toast({ title: "Mise à jour partielle", description: errors.join(", "), variant: "destructive" });
    }
  }

  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      await onDeleteAll(rules.map((r) => r.id));
    } finally {
      setDeletingAll(false);
    }
  }

  const totalBalance = rules.reduce((sum, rule) => {
    const bal = parseFloat(balanceMap[rule.fromCurrency] || "0");
    return sum + (isFinite(bal) ? bal : 0);
  }, 0);

  return (
    <>
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
          {/* Left: source rows (no delete buttons here) */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {rules.map((rule) => {
              const balance = balanceMap[rule.fromCurrency];
              const hasBalance = balance !== undefined && parseFloat(balance) > 0;
              return (
                <div key={rule.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-2">
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

        {/* Footer: hint + edit + delete-all */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50">
          {totalBalance > 0 ? (
            <p className="text-[10px] text-primary flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Soldes en cours de conversion
            </p>
          ) : <span />}
          <div className="flex items-center gap-1">
            <button
              onClick={openEdit}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Modifier
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {deletingAll
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />}
              Supprimer tout
            </button>
          </div>
        </div>
      </div>

      {/* ── Inline edit panel ── */}
      {editing && (
        <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-4">

          {/* Source selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Wallets source
              {editSources.size > 0 && (
                <span className="ml-1.5 text-primary normal-case">({editSources.size} sélectionné{editSources.size > 1 ? "s" : ""})</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setShowSourcePicker(true)}
              className="w-full flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-left hover:border-primary/50 transition-colors"
            >
              <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm text-foreground font-medium truncate">
                {editSources.size === 0
                  ? <span className="text-muted-foreground">Aucun wallet sélectionné</span>
                  : Array.from(editSources).join(", ")
                }
              </span>
              <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0" />
            </button>
          </div>

          {/* Target selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Wallet cible</p>
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
          </div>

          {(newTarget !== toCurrency || editSources.size !== currentSources.size || ![...editSources].every(c => currentSources.has(c))) && (
            <p className="text-[10px] text-primary flex items-center gap-1">
              <Zap className="w-3 h-3" />
              La conversion démarrera immédiatement si un solde est disponible.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-9" onClick={() => setEditing(false)} disabled={saving}>
              <X className="w-3.5 h-3.5 mr-1" /> Annuler
            </Button>
            <Button size="sm" className="flex-1 h-9" onClick={saveEdit}
              disabled={saving || editSources.size === 0 || !newTarget || editSources.has(newTarget)}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </div>

    {/* Source picker for edit mode */}
    <SourcePickerModal
      open={showSourcePicker}
      onClose={() => setShowSourcePicker(false)}
      onConfirm={(confirmed) => setEditSources(confirmed)}
      options={pickerOptions}
      initialSelected={editSources}
      balanceMap={balanceMap}
    />
    </>
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
  const [creating, setCreating] = useState(false);

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: wallets = [] } = useQuery<WalletEntry[]>({ queryKey: ["/api/wallets"] });
  const { data: rules = [], isLoading: rulesLoading } = useQuery<AutoConversionRule[]>({
    queryKey: ["/api/auto-conversion"],
  });

  const usedFromCurrencies = useMemo(() => new Set(rules.map((r) => r.fromCurrency)), [rules]);
  // All currencies already used as destination in any rule
  const usedToCurrencies = useMemo(() => new Set(rules.map((r) => r.toCurrency)), [rules]);
  // Union: any currency appearing in any rule (source OR target) is "locked"
  const lockedCurrencies = useMemo(
    () => new Set([...usedFromCurrencies, ...usedToCurrencies]),
    [usedFromCurrencies, usedToCurrencies]
  );

  const balanceMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (user) map[user.preferredCurrency || "XAF"] = user.balance;
    wallets.forEach((w) => { map[w.currency] = w.balance; });
    return map;
  }, [wallets, user]);

  // New-form source picker: exclude any currency already locked (source OR target in any rule)
  const sourceOptions = useMemo(
    () => ALL_FX_CURRENCIES.filter((c) => !lockedCurrencies.has(c.code)),
    [lockedCurrencies]
  );

  // New-form target select: exclude locked currencies AND the currently selected sources
  const targetOptions = useMemo(
    () => ALL_FX_CURRENCIES.filter((c) => !lockedCurrencies.has(c.code) && !selectedSources.has(c.code)),
    [lockedCurrencies, selectedSources]
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

  // Delete one rule (silent — caller handles toast)
  async function handleDeleteOne(id: string): Promise<void> {
    await apiRequest("DELETE", `/api/auto-conversion/${id}`);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
    ]);
  }

  // Delete all rules in a group
  async function handleDeleteAll(ids: string[]): Promise<void> {
    try {
      await Promise.all(ids.map((id) => apiRequest("DELETE", `/api/auto-conversion/${id}`)));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/wallets"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
      ]);
      toast({ title: ids.length === 1 ? "Règle supprimée" : `${ids.length} règles supprimées` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible de supprimer.", variant: "destructive" });
    }
  }

  // Create a single rule (used by GroupedRuleCard edit to add a new source)
  async function handleCreateOne(fromCurrency: string, toCurr: string): Promise<void> {
    await apiRequest("POST", "/api/auto-conversion", { fromCurrency, toCurrency: toCurr });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/auto-conversion"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
    ]);
  }

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

  // Create multiple rules via bulk endpoint (single Telegram notification)
  async function handleCreate() {
    if (selectedSources.size === 0 || !toCurrency) return;
    setCreating(true);
    let successCount = 0;
    const errors: string[] = [];

    const sources = Array.from(selectedSources).filter((f) => f !== toCurrency);
    try {
      const result = await apiRequest("POST", "/api/auto-conversion/bulk", { fromCurrencies: sources, toCurrency });
      successCount = (result as any)?.created ?? sources.length;
    } catch (err: any) {
      // Fallback: create one by one if bulk endpoint fails
      for (const from of sources) {
        try {
          await apiRequest("POST", "/api/auto-conversion", { fromCurrency: from, toCurrency });
          successCount++;
        } catch (e: any) {
          errors.push(`${from}: ${e?.message || "Erreur"}`);
        }
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
          </div>
        </div>

        {!showForm && sourceOptions.length > 0 && (
          <div className="mx-4 mb-4">
            <Button
              className="w-full bg-[#1A237E] text-white hover:bg-[#151c68]"
              onClick={() => setShowForm(true)}
            >
              <img src="/exchange-icon.png" alt="" aria-hidden="true" className="mr-2 h-5 w-5 object-contain" />
              Ajouter une conversion automatique
            </Button>
          </div>
        )}

        {/* Existing rules grouped */}
        {rulesLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {Object.keys(groupedRules).length > 0 && (
              <div className="space-y-3 mx-4 mb-4">
                {Object.entries(groupedRules).map(([toCurr, groupRules]) => {
                  // Sources that belong to THIS group (can be toggled in edit mode)
                  const thisGroupSources = new Set(groupRules.map((r) => r.fromCurrency));

                  // availableSources for picker:
                  //   - currencies in this group (already selected, can be deselected)
                  //   - currencies not locked at all (completely free)
                  //   - must NOT be the group's own target
                  const availableSources = ALL_FX_CURRENCIES.filter(
                    (c) =>
                      c.code !== toCurr &&
                      (thisGroupSources.has(c.code) || !lockedCurrencies.has(c.code))
                  );

                  // availableTargets for target select in edit mode:
                  //   - the current toCurr itself (user can keep it)
                  //   - currencies that are completely free (not locked by any rule)
                  const availableTargets = ALL_FX_CURRENCIES.filter(
                    (c) => c.code === toCurr || !lockedCurrencies.has(c.code)
                  );

                  return (
                    <GroupedRuleCard
                      key={toCurr}
                      toCurrency={toCurr}
                      rules={groupRules}
                      balanceMap={balanceMap}
                      availableSources={availableSources}
                      availableTargets={availableTargets}
                      onDelete={handleDeleteOne}
                      onDeleteAll={handleDeleteAll}
                      onUpdate={handleUpdate}
                      onCreate={handleCreateOne}
                    />
                  );
                })}
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
                            <span>{CURRENCY_FLAGS[code] || "🌍"}</span>
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
                          <span>{CURRENCY_FLAGS[c.code] || "🌍"}</span>
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
        ) : null}

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
