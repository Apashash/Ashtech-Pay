import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CryptoPayoutFlow = "withdrawal" | "send";

interface CryptoNetwork {
  id: string;
  label: string;
  assetCode: string;
  memoRequired: boolean;
  memoType: string | null;
}

interface CryptoPayoutConfig {
  enabled: boolean;
  countryCode: string;
  networks: CryptoNetwork[];
  fees: Record<string, { fixedUsdt: number; percentage: number }>;
}

interface WalletBalance {
  currency: string;
  balance: string | number;
}

interface UserWallet {
  preferredCurrency?: string;
  balance?: string | number;
}

interface Props {
  flow: CryptoPayoutFlow;
  onBack?: () => void;
}

function money(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

export function CryptoPayoutPanel({ flow, onBack }: Props) {
  const { toast } = useToast();
  const [assetCode, setAssetCode] = useState("USDT.TRC20");
  const [amount, setAmount] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationMemo, setDestinationMemo] = useState("");
  const [feeBearer, setFeeBearer] = useState<"sender" | "recipient">("sender");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpRef, setOtpRef] = useState("");
  const [otp, setOtp] = useState("");

  const { data: config, isLoading: configLoading } = useQuery<CryptoPayoutConfig>({
    queryKey: ["/api/crypto/payout/config"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/crypto/payout/config");
      if (!response.ok) throw new Error("Impossible de charger les réseaux crypto.");
      return response.json();
    },
  });
  const { data: user } = useQuery<UserWallet>({ queryKey: ["/api/user"] });
  const { data: wallets = [] } = useQuery<WalletBalance[]>({ queryKey: ["/api/wallets"] });

  const network = useMemo(
    () => config?.networks.find(item => item.assetCode.toUpperCase() === assetCode.toUpperCase()),
    [config?.networks, assetCode],
  );
  const feeRule = config?.fees?.[assetCode] || { fixedUsdt: 0, percentage: 0 };
  const amountValue = Number(amount);
  const enteredCents = Number.isFinite(amountValue) ? Math.round(amountValue * 100) : 0;
  const feeCents = Math.round(
    (Number(feeRule.fixedUsdt || 0) + amountValue * Number(feeRule.percentage || 0) / 100) * 100,
  );
  const payoutCents = feeBearer === "recipient" ? enteredCents - feeCents : enteredCents;
  const debitCents = feeBearer === "sender" ? enteredCents + feeCents : enteredCents;
  const payoutAmount = payoutCents > 0 ? payoutCents / 100 : 0;
  const feeAmount = feeCents > 0 ? feeCents / 100 : 0;
  const totalDebit = debitCents > 0 ? debitCents / 100 : 0;
  const primaryBalance = user?.preferredCurrency === "USDT" ? Number(user.balance || 0) : undefined;
  const secondaryBalance = Number(wallets.find(wallet => wallet.currency === "USDT")?.balance || 0);
  const usdtBalance = primaryBalance ?? secondaryBalance;
  const amountHasAtMostTwoDecimals = /^\d{1,12}(?:\.\d{1,2})?$/.test(amount.trim());

  const submitMutation = useMutation({
    mutationFn: async (otpCode?: string) => {
      const response = await apiRequest("POST", "/api/crypto/payouts", {
        flow,
        assetCode,
        amount: amount.trim(),
        destinationAddress: destinationAddress.trim(),
        destinationMemo: destinationMemo.trim() || undefined,
        feeBearer,
        otpRef: otpRef || undefined,
        otp: otpCode || undefined,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Impossible de traiter cet envoi crypto.");
      return body;
    },
    onSuccess: result => {
      setConfirmOpen(false);
      setOtpOpen(false);
      setOtpRef("");
      setOtp("");
      setAmount("");
      setDestinationAddress("");
      setDestinationMemo("");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: result.status === "completed"
          ? "Envoi confirmé"
          : result.status === "failed"
            ? "Envoi refusé"
            : "Envoi en cours",
        description: result.message || (
          result.status === "failed"
            ? "Le montant a été recrédité."
            : `Référence : ${result.reference || "enregistrée"}. Le solde reste réservé pendant la confirmation.`
        ),
      });
    },
    onError: (error: Error) => toast({ title: "Échec de l’envoi", description: error.message, variant: "destructive" }),
  });

  const requestOtp = async () => {
    const isWithdrawal = flow === "withdrawal";
    const endpoint = isWithdrawal ? "/api/withdrawals/request-otp" : "/api/transfers/request-otp";
    const requestBody = isWithdrawal
      ? {
          method: "crypto",
          country: config?.countryCode || "",
          operator: assetCode,
          phone: destinationAddress.trim(),
          amount: money(enteredCents / 100),
          fee: money(feeAmount),
          net: money(payoutAmount),
          currency: "USDT",
        }
      : {
          type: "external",
          recipient: destinationAddress.trim(),
          phone: destinationAddress.trim(),
          countryOperator: assetCode,
          feeBearer,
          amount: money(enteredCents / 100),
          fee: money(feeAmount),
          net: money(payoutAmount),
          currency: "USDT",
        };
    const response = await apiRequest("POST", endpoint, requestBody);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Impossible d’envoyer le code de vérification.");
    if (body.disabled || body.ref === "OTP_DISABLED") {
      submitMutation.mutate();
      return;
    }
    if (!body.ref) throw new Error("La demande de code n’a pas pu être confirmée.");
    setOtpRef(body.ref);
    setOtp("");
    setConfirmOpen(false);
    setOtpOpen(true);
  };

  const beginSubmission = async () => {
    try {
      await requestOtp();
    } catch (error: any) {
      toast({ title: "Vérification impossible", description: error.message, variant: "destructive" });
    }
  };

  const canContinue =
    !!config?.enabled &&
    !!network &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    amountHasAtMostTwoDecimals &&
    payoutAmount > 0 &&
    totalDebit <= usdtBalance &&
    destinationAddress.trim().length >= 8 &&
    destinationAddress.trim().length <= 256 &&
    destinationMemo.trim().length <= 128 &&
    (!network.memoRequired || !!destinationMemo.trim());

  return (
    <section
      className="mx-auto w-full max-w-xl space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"
      onKeyDown={event => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
      }}
    >
      <div className="flex items-start gap-3">
        {onBack && (
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{flow === "withdrawal" ? "Retrait crypto" : "Envoyer des USDT"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envoyez des USDT vers une adresse externe depuis votre portefeuille USDT.
          </p>
        </div>
      </div>

      {!configLoading && !config?.enabled && (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">
          Les retraits crypto ne sont pas disponibles pour le moment.
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4" /> Solde USDT
        </span>
        <span className="font-semibold tabular-nums">{money(usdtBalance)} USDT</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="crypto-payout-network">Réseau</Label>
        <Select value={assetCode} onValueChange={setAssetCode} disabled={configLoading || !config?.networks?.length}>
          <SelectTrigger id="crypto-payout-network">
            <SelectValue placeholder={configLoading ? "Chargement..." : "Choisir un réseau"} />
          </SelectTrigger>
          <SelectContent>
            {config?.networks.map(item => (
              <SelectItem key={item.assetCode} value={item.assetCode}>{item.label} — {item.assetCode}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!network && Boolean(config?.networks?.length) && (
          <p className="text-xs text-amber-600">Le réseau USDT.TRC20 par défaut est indisponible. Choisissez un réseau manuellement.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="crypto-payout-address">Adresse de destination</Label>
        <Input
          id="crypto-payout-address"
          autoComplete="off"
          spellCheck={false}
          value={destinationAddress}
          onChange={event => setDestinationAddress(event.target.value)}
          placeholder="Collez l’adresse du portefeuille"
          maxLength={256}
        />
      </div>

      {network?.memoRequired && (
        <div className="space-y-2">
          <Label htmlFor="crypto-payout-memo">Memo / tag ({network.memoType || "requis"})</Label>
          <Input
            id="crypto-payout-memo"
            autoComplete="off"
            value={destinationMemo}
            onChange={event => setDestinationMemo(event.target.value)}
            maxLength={128}
            placeholder="Memo ou tag du destinataire"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="crypto-payout-amount">Montant (USDT)</Label>
        <Input
          id="crypto-payout-amount"
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={event => setAmount(event.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="space-y-2">
        <Label>Qui paie les frais AshTechPay ?</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={feeBearer === "sender" ? "default" : "outline"} onClick={() => setFeeBearer("sender")}>
            Vous payez
          </Button>
          <Button type="button" variant={feeBearer === "recipient" ? "default" : "outline"} onClick={() => setFeeBearer("recipient")}>
            Le destinataire paie
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border p-4 text-sm">
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Frais AshTechPay</span><span>{money(feeAmount)} USDT</span></div>
        <div className="flex justify-between gap-3 font-semibold">
          <span>{feeBearer === "sender" ? "Débité de votre portefeuille" : "Envoyé au destinataire"}</span>
          <span>{money(feeBearer === "sender" ? totalDebit : payoutAmount)} USDT</span>
        </div>
        {feeBearer === "recipient" && (
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Débité de votre portefeuille</span><span>{money(totalDebit)} USDT</span></div>
        )}
        <p className="border-t pt-2 text-xs text-muted-foreground">
          Les frais de service IziChange sont réglés séparément par AshTechPay. Vérifiez soigneusement le réseau et l’adresse.
        </p>
      </div>

      <Button type="button" className="w-full gap-2" disabled={!canContinue || submitMutation.isPending} onClick={() => setConfirmOpen(true)}>
        <ArrowRight className="h-4 w-4" />
        Continuer
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l’envoi crypto</DialogTitle>
            <DialogDescription>Vérifiez le réseau, l’adresse et le montant avant de continuer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Réseau</span><span className="text-right">{assetCode}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Adresse</span><span className="max-w-[65%] break-all text-right">{destinationAddress}</span></div>
            {destinationMemo && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Memo / tag</span><span className="break-all text-right">{destinationMemo}</span></div>}
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Montant envoyé</span><span>{money(payoutAmount)} USDT</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Frais AshTechPay</span><span>{money(feeAmount)} USDT</span></div>
            <div className="flex justify-between gap-3 font-semibold"><span>Total débité</span><span>{money(totalDebit)} USDT</span></div>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Un code de vérification peut être envoyé à votre adresse e-mail. Les envois confirmés sur la blockchain ne peuvent pas être annulés.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Retour</Button>
            <Button type="button" onClick={beginSubmission} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmer et vérifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vérification par e-mail</DialogTitle>
            <DialogDescription>Saisissez le code à six chiffres envoyé à votre adresse e-mail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="crypto-payout-otp">Code de vérification</Label>
            <Input
              id="crypto-payout-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOtpOpen(false)}>Annuler</Button>
            <Button type="button" disabled={otp.length !== 6 || submitMutation.isPending} onClick={() => submitMutation.mutate(otp)}>
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Vérifier et envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}