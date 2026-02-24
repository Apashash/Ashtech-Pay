import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Wallet, ArrowLeftRight, Info, Plus, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WalletEntry {
  currency: string;
  balance: string;
  symbol: string;
}

const CURRENCY_NAMES: Record<string, string> = {
  XAF: "Franc CFA (Afrique Centrale)",
  XOF: "Franc CFA (Afrique de l'Ouest)",
  GHS: "Cédi Ghanéen",
  NGN: "Naira Nigérian",
  KES: "Shilling Kenyan",
  RWF: "Franc Rwandais",
  TZS: "Shilling Tanzanien",
  UGX: "Shilling Ougandais",
  CDF: "Franc Congolais",
  GNF: "Franc Guinéen",
  USD: "Dollar Américain",
};

const CURRENCY_FLAGS: Record<string, string> = {
  XAF: "🇨🇲", XOF: "🇸🇳", GHS: "🇬🇭", NGN: "🇳🇬", KES: "🇰🇪",
  RWF: "🇷🇼", TZS: "🇹🇿", UGX: "🇺🇬", CDF: "🇨🇩", GNF: "🇬🇳", USD: "🇺🇸",
};

export default function WalletsPage() {
  const { toast } = useToast();
  const [convertOpen, setConvertOpen] = useState(false);
  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const [pendingSuccess, setPendingSuccess] = useState<{ fromCurrency: string; toCurrency: string; fromAmount: number } | null>(null);

  const [fromCurrency, setFromCurrency] = useState("XAF");
  const [toCurrency, setToCurrency] = useState("XOF");
  const [convertAmount, setConvertAmount] = useState("");
  const [newWalletCurrency, setNewWalletCurrency] = useState("");

  const { data: walletList = [], isLoading } = useQuery<WalletEntry[]>({
    queryKey: ["/api/wallets"],
    refetchInterval: 30000,
  });

  const existingCurrencies = walletList.map(w => w.currency);
  const availableCurrencies = SUPPORTED_CURRENCIES.filter(c => !existingCurrencies.includes(c) && c !== "XAF");

  const convertMutation = useMutation({
    mutationFn: async (data: { fromCurrency: string; toCurrency: string; amount: string }) => {
      const res = await apiRequest("POST", "/api/wallets/convert", data);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setConvertOpen(false);
      setPendingSuccess({
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        fromAmount: data.fromAmount,
      });
      setConvertAmount("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const openConvert = (wallet: WalletEntry) => {
    setFromCurrency(wallet.currency);
    const other = walletList.find(w => w.currency !== wallet.currency);
    setToCurrency(other?.currency || "XOF");
    setConvertAmount("");
    setPendingSuccess(null);
    setConvertOpen(true);
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
      toast({ title: "Compte créé", description: `Compte ${newWalletCurrency} créé avec succès` });
      setAddWalletOpen(false);
      setNewWalletCurrency("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const { data: setting } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/conversion_fee_percent"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/conversion_fee_percent");
      return res.json();
    },
  });

  const conversionFeePercent = setting?.value ? parseFloat(setting.value) : 6;
  const sourceBalance = walletList.find(w => w.currency === fromCurrency);
  const parsedAmount = parseFloat(convertAmount || "0");
  const sourceParsedBalance = parseFloat(sourceBalance?.balance || "0");
  const hasSufficientBalance = parsedAmount > 0 && parsedAmount <= sourceParsedBalance;

  const feeAmount = (parsedAmount * conversionFeePercent) / 100;
  const finalAmount = parsedAmount - feeAmount;

  // Internal rates for preview
  const fromRate = EXCHANGE_RATES[fromCurrency as keyof typeof EXCHANGE_RATES] || 1;
  const toRate = EXCHANGE_RATES[toCurrency as keyof typeof EXCHANGE_RATES] || 1;
  const previewAmount = finalAmount * (fromRate / toRate);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mes Comptes</h1>
            <p className="text-muted-foreground">Gérez vos portefeuilles multi-devises</p>
          </div>
          <Button variant="outline" onClick={() => setAddWalletOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Ajouter un compte
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Les dépôts sont effectués uniquement sur le compte <strong>XAF</strong> (Cameroun).
            Vous pouvez convertir vos fonds instantanément entre vos différents portefeuilles.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {walletList.map((wallet) => {
              const balance = parseFloat(wallet.balance);
              const isMain = wallet.currency === "XAF";
              return (
                <Card
                  key={wallet.currency}
                  className={`relative overflow-hidden ${isMain ? "border-primary/40 bg-gradient-to-br from-primary/10 to-transparent" : ""}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{CURRENCY_FLAGS[wallet.currency] || "🌍"}</span>
                        <div>
                          <p className="font-bold text-lg">{wallet.currency}</p>
                          <p className="text-xs text-muted-foreground">{CURRENCY_NAMES[wallet.currency] || wallet.currency}</p>
                        </div>
                      </div>
                      {isMain && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                          Principal
                        </span>
                      )}
                    </div>
                    <div className="mb-4">
                      <p className="text-muted-foreground text-sm mb-1">Solde</p>
                      <p className="text-2xl font-bold">
                        {balance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-base font-normal text-muted-foreground ml-1">{wallet.symbol || wallet.currency}</span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => openConvert(wallet)}
                      disabled={walletList.length < 2}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      Demander une conversion
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pending success banner */}
        {pendingSuccess && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-600">Conversion effectuée</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Votre conversion de{" "}
                  <strong>{pendingSuccess.fromAmount.toLocaleString("fr-FR")} {pendingSuccess.fromCurrency}</strong>{" "}
                  vers <strong>{pendingSuccess.toCurrency}</strong> a été traitée avec succès.
                  Votre compte a été mis à jour instantanément.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conversion Dialog */}
        <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                Conversion de devises
              </DialogTitle>
              <DialogDescription>
                Convertissez vos fonds instantanément. Les frais de conversion sont appliqués automatiquement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">

              <div className="space-y-2">
                <Label>Compte source (à débiter)</Label>
                <Select value={fromCurrency} onValueChange={(v) => { setFromCurrency(v); setConvertAmount(""); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {walletList.map(w => (
                      <SelectItem key={w.currency} value={w.currency}>
                        {CURRENCY_FLAGS[w.currency] || "🌍"} {w.currency} — {parseFloat(w.balance).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {w.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Compte cible (à créditer)</Label>
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {walletList.filter(w => w.currency !== fromCurrency).map(w => (
                      <SelectItem key={w.currency} value={w.currency}>
                        {CURRENCY_FLAGS[w.currency] || "🌍"} {w.currency} — {CURRENCY_NAMES[w.currency] || w.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Montant à convertir ({fromCurrency})</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  min="1"
                  max={sourceParsedBalance}
                />
                {convertAmount && parsedAmount > 0 && !hasSufficientBalance && (
                  <p className="text-xs text-red-500">
                    Solde insuffisant. Disponible : {sourceParsedBalance.toLocaleString("fr-FR")} {fromCurrency}
                  </p>
                )}
                {convertAmount && hasSufficientBalance && (
                  <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-lg space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Montant brut</span>
                      <span>{parsedAmount.toLocaleString("fr-FR")} {fromCurrency}</span>
                    </div>
                    <div className="flex justify-between text-xs text-amber-600 font-medium">
                      <span>Frais de conversion ({conversionFeePercent}%)</span>
                      <span>-{feeAmount.toLocaleString("fr-FR")} {fromCurrency}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-primary/10 pt-1 mt-1">
                      <span>Vous recevrez environ</span>
                      <span className="text-primary">{previewAmount.toLocaleString("fr-FR")} {toCurrency}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 italic text-center">
                      Le taux final peut varier légèrement.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConvertOpen(false)}>
                  Annuler
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!hasSufficientBalance || convertMutation.isPending}
                  onClick={() => convertMutation.mutate({ fromCurrency, toCurrency, amount: convertAmount })}
                >
                  {convertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Convertir maintenant
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Wallet Dialog */}
        <Dialog open={addWalletOpen} onOpenChange={setAddWalletOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Ajouter un compte
              </DialogTitle>
              <DialogDescription>
                Ouvrez un nouveau compte dans une autre devise. Le compte sera initialisé avec un solde de 0.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Devise</Label>
                <Select value={newWalletCurrency} onValueChange={setNewWalletCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une devise" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCurrencies.map(c => (
                      <SelectItem key={c} value={c}>
                        {CURRENCY_FLAGS[c] || "🌍"} {c} — {CURRENCY_NAMES[c] || c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setAddWalletOpen(false)}>Annuler</Button>
                <Button
                  className="flex-1"
                  disabled={!newWalletCurrency || addWalletMutation.isPending}
                  onClick={() => addWalletMutation.mutate()}
                >
                  {addWalletMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Créer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
