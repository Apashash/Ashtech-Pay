import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Wallet, ArrowLeftRight, RefreshCw, Info, Plus, Loader2 } from "lucide-react";
import { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@shared/schema";
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
  XAF: "🇨🇲",
  XOF: "🇸🇳",
  GHS: "🇬🇭",
  NGN: "🇳🇬",
  KES: "🇰🇪",
  RWF: "🇷🇼",
  TZS: "🇹🇿",
  UGX: "🇺🇬",
  CDF: "🇨🇩",
  GNF: "🇬🇳",
  USD: "🇺🇸",
};

export default function WalletsPage() {
  const { toast } = useToast();
  const [convertOpen, setConvertOpen] = useState(false);
  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletEntry | null>(null);

  const [fromCurrency, setFromCurrency] = useState("XAF");
  const [toCurrency, setToCurrency] = useState("XOF");
  const [convertAmount, setConvertAmount] = useState("");
  const [previewResult, setPreviewResult] = useState<{ toAmount: number; rate: number } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

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
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Conversion réussie",
        description: `${data.fromAmount.toFixed(2)} ${data.fromCurrency} → ${data.toAmount.toFixed(2)} ${data.toCurrency}`,
      });
      setConvertOpen(false);
      setConvertAmount("");
      setPreviewResult(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handlePreview = async () => {
    const amount = parseFloat(convertAmount);
    if (!amount || amount <= 0) return;
    setIsPreviewLoading(true);
    try {
      const res = await apiRequest("POST", "/api/wallets/convert-preview", {
        fromCurrency,
        toCurrency,
        amount: convertAmount,
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewResult({ toAmount: data.toAmount, rate: data.rate });
      } else {
        toast({ title: "Erreur de taux", description: data.message, variant: "destructive" });
        setPreviewResult(null);
      }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const openConvert = (wallet: WalletEntry) => {
    setSelectedWallet(wallet);
    setFromCurrency(wallet.currency);
    setToCurrency(walletList.find(w => w.currency !== wallet.currency)?.currency || "XAF");
    setConvertAmount("");
    setPreviewResult(null);
    setConvertOpen(true);
  };

  const addWalletMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wallets/create", { currency: newWalletCurrency });
      return res.json();
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mes Comptes</h1>
            <p className="text-muted-foreground">Gérez vos portefeuilles multi-devises</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setAddWalletOpen(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter un compte
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Les dépôts sont effectués uniquement sur le compte <strong>XAF</strong> (Cameroun). 
            Vous pouvez ensuite convertir vers d'autres devises pour effectuer des transferts et retraits internationaux.
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
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      Convertir
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Conversion Dialog */}
        <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                Convertir des devises
              </DialogTitle>
              <DialogDescription>
                La conversion utilise le pont PUSD de Swychr pour obtenir le taux en temps réel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Devise source</Label>
                <Select value={fromCurrency} onValueChange={(v) => { setFromCurrency(v); setPreviewResult(null); }}>
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
                <Label>Devise cible</Label>
                <Select value={toCurrency} onValueChange={(v) => { setToCurrency(v); setPreviewResult(null); }}>
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
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0"
                    value={convertAmount}
                    onChange={(e) => { setConvertAmount(e.target.value); setPreviewResult(null); }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={!convertAmount || parseFloat(convertAmount) <= 0 || isPreviewLoading}
                  >
                    {isPreviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {previewResult && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vous envoyez</span>
                    <span className="font-medium">{parseFloat(convertAmount).toLocaleString("fr-FR")} {fromCurrency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vous recevez</span>
                    <span className="font-bold text-primary">{previewResult.toAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {toCurrency}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
                    <span>Taux</span>
                    <span>1 {fromCurrency} ≈ {previewResult.rate.toFixed(4)} {toCurrency}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConvertOpen(false)}>
                  Annuler
                </Button>
                <Button
                  className="flex-1"
                  disabled={!previewResult || convertMutation.isPending}
                  onClick={() => convertMutation.mutate({ fromCurrency, toCurrency, amount: convertAmount })}
                >
                  {convertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Convertir
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
