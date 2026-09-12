import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetFooter } from "@/components/ui/bottom-sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, X, ChevronRight, Check, Loader2, AlertTriangle, Search } from "lucide-react";
import { ALL_FX_CURRENCIES, CURRENCY_SYMBOLS } from "@shared/schema";
import type { User, Transaction } from "@shared/schema";
import { useLanguage } from "@/lib/language";

interface WalletEntry {
  currency: string;
  balance: string;
  symbol: string;
}

const CURRENCY_FLAGS: Record<string, string> = {
  XAF: "🇨🇲", XAFC: "🇨🇬", XAFG: "🇬🇦",
  XOF: "🇸🇳", XOFC: "🇨🇮", XOFF: "🇧🇫", XOFN: "🇳🇪", XOFB: "🇧🇯", XOFT: "🇹🇬", XOFS: "🇸🇳", XOFM: "🇲🇱",
  RWF: "🇷🇼", TZS: "🇹🇿",
  UGX: "🇺🇬", CDF: "🇨🇩", SLE: "🇸🇱",
  GHS: "🇬🇭", KES: "🇰🇪", NGN: "🇳🇬", MWK: "🇲🇼", LSL: "🇱🇸", ZMK: "🇿🇲", ZAR: "🇿🇦", EGP: "🇪🇬", MAD: "🇲🇦",
  ETB: "🇪🇹", MZN: "🇲🇿", ZWE: "🇿🇼", CVE: "🇨🇻",
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
ALL_FX_CURRENCIES.forEach(c => { CURRENCY_NAMES[c.code] = c.name; });

const CURRENCY_COUNTRIES: Record<string, string> = {
  USD: "États-Unis",
  EUR: "Europe",
  GBP: "Royaume-Uni",
  XAF: "Cameroun",
  XOF: "Afrique de l’Ouest",
  XOFC: "Côte d’Ivoire",
  XOFF: "Burkina Faso",
  XOFN: "Niger",
  XOFB: "Bénin",
  XOFT: "Togo",
  XOFS: "Sénégal",
  XOFM: "Mali",
  XAFC: "Congo Brazzaville",
  XAFG: "Gabon",
  RWF: "Rwanda",
  TZS: "Tanzanie",
  UGX: "Ouganda",
  GHS: "Ghana",
  KES: "Kenya",
  MWK: "Malawi",
  MZN: "Mozambique",
  NGN: "Nigeria",
  ETB: "Éthiopie",
  LSL: "Lesotho",
  SLE: "Sierra Leone",
  ZMW: "Zambie",
  XAFCF: "Centrafrique",
  XAFTD: "Tchad",
  XOFGW: "Guinée-Bissau",
  CDF: "République démocratique du Congo",
  INR: "Inde",
  USDT: "Crypto · Tron",
};

export default function WalletsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState<WalletEntry | null>(null);
  const [newWalletCurrency, setNewWalletCurrency] = useState("");
  const [walletCurrencySearch, setWalletCurrencySearch] = useState("");
  const currencyListRef = useRef<HTMLDivElement>(null);
  const currencyTouchRef = useRef({ startY: 0, startScrollTop: 0 });

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: rawWalletList = [], isLoading } = useQuery<WalletEntry[]>({
    queryKey: ["/api/wallets"],
    refetchInterval: 30000,
  });
  const { data: transactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });

  const primaryCurrency = user?.preferredCurrency || "XAF";

  const walletList = useMemo(() => {
    const lastTxDate: Record<string, number> = {};
    for (const tx of transactions) {
      if (!tx.currency || !tx.createdAt) continue;
      const ts = new Date(tx.createdAt).getTime();
      if (!lastTxDate[tx.currency] || ts > lastTxDate[tx.currency]) lastTxDate[tx.currency] = ts;
    }
    return [...rawWalletList].sort((a, b) => {
      const dateA = lastTxDate[a.currency] ?? 0;
      const dateB = lastTxDate[b.currency] ?? 0;
      if (dateB !== dateA) return dateB - dateA;
      return parseFloat(b.balance || "0") - parseFloat(a.balance || "0");
    });
  }, [rawWalletList, transactions]);

  const existingCurrencies = new Set(walletList.map(w => w.currency));
  const availableCurrencies = ALL_FX_CURRENCIES.filter(c => !existingCurrencies.has(c.code));
  const filteredAvailableCurrencies = useMemo(() => {
    const query = walletCurrencySearch.trim().toLowerCase();
    if (!query) return availableCurrencies;
    return availableCurrencies.filter((currency) => {
      const country = CURRENCY_COUNTRIES[currency.code] || "";
      return `${currency.code} ${currency.name} ${country}`.toLowerCase().includes(query);
    });
  }, [availableCurrencies, walletCurrencySearch]);

  const walletSymbol = (currency: string) => (CURRENCY_SYMBOLS as Record<string, string>)[currency] || currency;

  const openConversion = (sourceCurrency: string) => {
    const targetWallet = walletList.find((wallet) => wallet.currency !== sourceCurrency);
    if (!targetWallet) return;
    navigate(`/dashboard/convert?from=${encodeURIComponent(sourceCurrency)}&to=${encodeURIComponent(targetWallet.currency)}`);
  };

  const handleCurrencyTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch || !currencyListRef.current) return;
    currencyTouchRef.current = {
      startY: touch.clientY,
      startScrollTop: currencyListRef.current.scrollTop,
    };
  };

  const handleCurrencyTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    const list = currencyListRef.current;
    if (!touch || !list) return;
    event.preventDefault();
    list.scrollTop = currencyTouchRef.current.startScrollTop
      + currencyTouchRef.current.startY - touch.clientY;
  };

  const handleAddWalletOpenChange = (open: boolean) => {
    setAddWalletOpen(open);
    if (!open) {
      setNewWalletCurrency("");
      setWalletCurrencySearch("");
    }
  };

  const addWalletMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wallets/create", { currency: newWalletCurrency });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: t.wallets.toastCreated, description: `${t.wallets.toastCreatedDescPre}${newWalletCurrency}${t.wallets.toastCreatedDescSuf}` });
      setAddWalletOpen(false);
      setNewWalletCurrency("");
    },
    onError: (error: Error) => {
      toast({ title: t.wallets.toastError, description: error.message, variant: "destructive" });
    },
  });

  const deleteWalletMutation = useMutation({
    mutationFn: async (currency: string) => {
      const res = await apiRequest("DELETE", `/api/wallets/${currency}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (_, currency) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: t.wallets.toastDisabled, description: `${t.wallets.toastDisabledDescPre}${currency}${t.wallets.toastDisabledDescSuf}` });
      setWalletToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: t.wallets.toastError, description: error.message, variant: "destructive" });
      setWalletToDelete(null);
    },
  });

  const deleteBalance = parseFloat(walletToDelete?.balance || "0");
  const hasBalanceToLose = deleteBalance > 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto space-y-4 animate-pulse">
          <div className="h-36 bg-muted rounded-2xl" />
          <div className="h-10 bg-muted rounded-xl" />
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-2xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-4 pb-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.wallets.title}</h1>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddWalletOpen(true)}
            className="gap-1.5 rounded-xl"
            data-testid="button-add-wallet"
          >
            <Plus className="w-4 h-4" />
            {t.wallets.addAccount}
          </Button>
        </div>

        {/* Portfolio hero card */}
        <div className="rounded-2xl bg-[#1A237E] border border-[#1A237E] overflow-hidden p-6 text-white">
          <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/75 text-sm mb-1">{t.wallets.walletsLabel}</p>
                <p className="text-4xl font-bold text-white tabular-nums">
                  {walletList.length}
                </p>
                <p className="text-sm text-white/75 mt-1">
                  {walletList.length === 1 ? "compte actif" : "comptes actifs"}
                </p>
              </div>
              <button
                onClick={() => { if (walletList.length >= 2) navigate("/dashboard/convert"); }}
                disabled={walletList.length < 2}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="button-open-convert"
              >
                <img src="/exchange-icon.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
                {t.wallets.requestConversion}
              </button>
            </div>
          </div>
        </div>

        {/* Wallet list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {walletList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm">Aucun wallet disponible.</p>
            </div>
          ) : (
            walletList.map((wallet) => {
              const balance = parseFloat(wallet.balance || "0");
              const isMain = wallet.currency === primaryCurrency;
              const flag = CURRENCY_FLAGS[wallet.currency] || "🌍";
              const name = CURRENCY_NAMES[wallet.currency] || wallet.currency;
              const sym = wallet.symbol || walletSymbol(wallet.currency);
              return (
                <div
                  key={wallet.currency}
                  className="flex items-center gap-4 px-4 py-4 hover:bg-muted/30 transition-colors group"
                  data-testid={`wallet-row-${wallet.currency}`}
                >
                  {/* Flag + currency info */}
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-2xl shrink-0 border border-border">
                    {flag}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{wallet.currency}</span>
                      {isMain && (
                        <span className="text-[10px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                          {t.wallets.principal}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{name}</p>
                  </div>
                  {/* Balance */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground tabular-nums text-sm">
                      {balance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{sym}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openConversion(wallet.currency)}
                      disabled={walletList.length < 2}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={t.wallets.requestConversion}
                      data-testid={`button-convert-${wallet.currency}`}
                    >
                      <img src="/exchange-icon.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
                    </button>
                    {!isMain && (
                      <button
                        onClick={() => setWalletToDelete(wallet)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                        title={t.wallets.disableTooltip}
                        data-testid={`button-disable-wallet-${wallet.currency}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isMain && <div className="w-8 h-8" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add wallet hint */}
        <button
          onClick={() => setAddWalletOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all group"
          data-testid="button-add-wallet-hint"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:border-primary group-hover:text-primary transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{t.wallets.addAccount}</span>
          </div>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Add Wallet dialog ── */}
      <Dialog open={addWalletOpen} onOpenChange={handleAddWalletOpenChange}>
        <DialogContent className="max-w-sm w-full p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
            <DialogTitle className="text-base font-semibold">{t.wallets.addDialogTitle}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{t.wallets.addDialogDesc}</p>
          </DialogHeader>

          <div className="px-3 py-2.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher un pays ou une devise..."
                value={walletCurrencySearch}
                onChange={(event) => setWalletCurrencySearch(event.target.value)}
                className="pl-8 h-9 text-sm"
                autoFocus
              />
            </div>
          </div>

          <div
            ref={currencyListRef}
            className="overflow-y-auto max-h-[55vh] overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch", touchAction: "none" }}
            data-testid="wallet-currency-options"
            onTouchStart={handleCurrencyTouchStart}
            onTouchMove={handleCurrencyTouchMove}
          >
            {filteredAvailableCurrencies.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Aucun pays ou devise trouvé.</p>
            ) : (
              filteredAvailableCurrencies.map((currency) => {
                const country = CURRENCY_COUNTRIES[currency.code] || currency.name;
                const isSelected = newWalletCurrency === currency.code;
                return (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => setNewWalletCurrency(currency.code)}
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
              })
            )}
          </div>

          <div className="px-4 py-3 border-t border-border bg-muted/20 flex gap-2">
            <Button variant="outline" className="flex-1 h-9" onClick={() => handleAddWalletOpenChange(false)} data-testid="button-cancel-wallet">
              {t.wallets.cancel}
            </Button>
            <Button
              className="flex-1 h-9 font-bold"
              disabled={!newWalletCurrency || addWalletMutation.isPending}
              onClick={() => addWalletMutation.mutate()}
              data-testid="button-create-wallet"
            >
              {addWalletMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t.wallets.create}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Wallet Confirmation ── */}
      <BottomSheet open={!!walletToDelete} onOpenChange={(open) => { if (!open) setWalletToDelete(null); }}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t.wallets.disableTitle}
            </BottomSheetTitle>
            <BottomSheetDescription>
              {hasBalanceToLose ? (
                <>
                  {t.wallets.disableWithBalancePre}<strong>{walletToDelete?.currency}</strong>{t.wallets.disableWithBalanceMid}
                  <strong className="text-destructive">
                    {deleteBalance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {walletToDelete?.symbol || walletToDelete?.currency}
                  </strong>.{" "}
                  <span className="text-destructive font-semibold">{t.wallets.disableLose}</span>{t.wallets.disableWithBalanceSuf}
                </>
              ) : (
                <>{t.wallets.disableNoBalancePre}<strong>{walletToDelete?.currency}</strong>{t.wallets.disableNoBalanceSuf}</>
              )}
            </BottomSheetDescription>
          </BottomSheetHeader>
          <BottomSheetFooter>
            <Button variant="outline" className="flex-1" onClick={() => setWalletToDelete(null)}>
              {t.wallets.cancel}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-bold"
              disabled={deleteWalletMutation.isPending}
              onClick={() => walletToDelete && deleteWalletMutation.mutate(walletToDelete.currency)}
              data-testid="button-confirm-disable-wallet"
            >
              {deleteWalletMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t.wallets.disableButtonSimple}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </DashboardLayout>
  );
}
