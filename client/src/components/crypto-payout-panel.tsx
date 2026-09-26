import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Save, ShieldCheck, Trash2, Wallet } from "lucide-react";
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
import { networkLogoUrl } from "@/lib/use-crypto-assets";

type CryptoPayoutFlow = "withdrawal" | "send";

interface CryptoNetwork {
  id: string;
  label: string;
  assetCode: string;
  memoRequired: boolean;
  memoType: string | null;
}

export interface CryptoPayoutConfig {
  enabled: boolean;
  countryCode: string;
  networks: CryptoNetwork[];
  fees: Record<string, { fixedUsdt: number; percentage: number }>;
  withdrawalLimits?: {
    minUsdt: number | null;
    maxUsdt: number | null;
    configured: boolean;
  };
}

interface WalletBalance {
  currency: string;
  balance: string | number;
}

interface UserWallet {
  preferredCurrency?: string;
  balance?: string | number;
}

interface SavedCryptoWithdrawalAddress {
  id: string;
  label: string;
  assetCode: string;
  address: string;
  memo: string | null;
}

interface Props {
  flow: CryptoPayoutFlow;
  onBack?: () => void;
  embedded?: boolean;
  amount?: string;
  onAmountChange?: (value: string) => void;
  onSuccess?: () => void;
}

function money(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

const NETWORK_SYMBOLS: Record<string, string> = {
  TRC20: "TRX",
  TRX: "TRX",
  BEP20: "BNB",
  BSC: "BNB",
  ERC20: "ETH",
  ETH: "ETH",
  TON: "TON",
  POLYGON: "POL",
  POL: "POL",
  MATIC: "POL",
  SOL: "SOL",
};

function networkIdForAssetCode(assetCode: string, networks: CryptoNetwork[]): string {
  const match = networks.find(
    item => item.assetCode.toUpperCase() === assetCode.toUpperCase(),
  );
  if (match) return match.id;
  return assetCode.split(".").slice(1).join(".") || assetCode;
}

function CryptoNetworkLogo({ networkId }: { networkId: string }) {
  const [hasError, setHasError] = useState(false);
  const normalizedNetworkId = networkId.trim().toUpperCase();
  const symbol = NETWORK_SYMBOLS[normalizedNetworkId]
    || normalizedNetworkId.replace(/[^A-Z0-9]/g, "").slice(0, 2)
    || "CR";

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[9px] font-bold">
      {hasError ? (
        <span aria-hidden="true">{symbol.slice(0, 2)}</span>
      ) : (
        <img
          src={networkLogoUrl(networkId)}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setHasError(true)}
        />
      )}
    </span>
  );
}

export function CryptoPayoutPanel({ flow, onBack, embedded = false, amount: controlledAmount, onAmountChange, onSuccess }: Props) {
  const { toast } = useToast();
  const [assetCode, setAssetCode] = useState("USDT.TRC20");
  const [localAmount, setLocalAmount] = useState("");
  const amount = controlledAmount ?? localAmount;
  const setAmount = (value: string) => {
    if (controlledAmount === undefined) setLocalAmount(value);
    onAmountChange?.(value);
  };
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationMemo, setDestinationMemo] = useState("");
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState("");
  const [addressLabel, setAddressLabel] = useState("");
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
  const { data: savedAddresses = [] } = useQuery<SavedCryptoWithdrawalAddress[]>({
    queryKey: ["/api/crypto/withdrawal-addresses"],
    enabled: flow === "withdrawal",
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/crypto/withdrawal-addresses");
      if (!response.ok) throw new Error("Impossible de charger les adresses crypto enregistrées.");
      return response.json();
    },
  });

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
  const addressCanBeSaved =
    flow === "withdrawal" &&
    !!network &&
    addressLabel.trim().length > 0 &&
    addressLabel.trim().length <= 40 &&
    destinationAddress.trim().length >= 8 &&
    destinationAddress.trim().length <= 256 &&
    destinationMemo.trim().length <= 128 &&
    (!network.memoRequired || !!destinationMemo.trim());

  const saveAddressMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/crypto/withdrawal-addresses", {
        label: addressLabel.trim(),
        assetCode,
        address: destinationAddress.trim(),
        memo: destinationMemo.trim() || undefined,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Impossible d’enregistrer cette adresse.");
      return body as SavedCryptoWithdrawalAddress & { alreadySaved?: boolean };
    },
    onSuccess: saved => {
      setSelectedSavedAddressId(saved.id);
      setAddressLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/withdrawal-addresses"] });
      toast({
        title: saved.alreadySaved ? "Adresse déjà enregistrée" : "Adresse enregistrée",
        description: saved.alreadySaved
          ? "Cette adresse figurait déjà dans vos adresses de retrait."
          : "Vous pourrez la sélectionner lors de vos prochains retraits crypto.",
      });
    },
    onError: (error: Error) => toast({ title: "Enregistrement impossible", description: error.message, variant: "destructive" }),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/crypto/withdrawal-addresses/${encodeURIComponent(id)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Impossible de supprimer cette adresse.");
      return id;
    },
    onSuccess: id => {
      if (selectedSavedAddressId === id) setSelectedSavedAddressId("");
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/withdrawal-addresses"] });
      toast({ title: "Adresse supprimée", description: "L’adresse a été retirée de vos adresses enregistrées." });
    },
    onError: (error: Error) => toast({ title: "Suppression impossible", description: error.message, variant: "destructive" }),
  });

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
        onSuccess?.();
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
    (flow !== "withdrawal" || (
      config.withdrawalLimits?.configured === true &&
      amountValue >= Number(config.withdrawalLimits.minUsdt) &&
      amountValue <= Number(config.withdrawalLimits.maxUsdt)
    )) &&
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
      className={embedded ? "space-y-4" : "mx-auto w-full max-w-xl space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"}
      onKeyDown={event => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
      }}
    >
      {!embedded && (
        <div className="flex items-start gap-3">
          {onBack && (
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Retour">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{flow === "withdrawal" ? "Retrait crypto" : "Envoyer des USDT"}</h2>
          </div>
        </div>
      )}

      {!configLoading && !config?.enabled && (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">
          Les retraits crypto ne sont pas disponibles pour le moment.
        </div>
      )}

      {!embedded && (
        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" /> Solde USDT
          </span>
          <span className="font-semibold tabular-nums">{money(usdtBalance)} USDT</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="crypto-payout-network">Réseau</Label>
        <Select value={assetCode} onValueChange={value => {
          if (selectedSavedAddressId) {
            setDestinationAddress("");
            setDestinationMemo("");
          }
          setAssetCode(value);
          setSelectedSavedAddressId("");
        }} disabled={configLoading || !config?.networks?.length}>
          <SelectTrigger id="crypto-payout-network" className="gap-2">
            <SelectValue placeholder={configLoading ? "Chargement..." : "Choisir un réseau"} />
          </SelectTrigger>
          <SelectContent>
            {config?.networks.map(item => (
              <SelectItem key={item.assetCode} value={item.assetCode}>
                <span className="flex items-center gap-2">
                    <CryptoNetworkLogo networkId={item.id} />
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.assetCode}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!network && selectedSavedAddressId && (
          <p className="text-xs text-amber-600">Le réseau de cette adresse enregistrée n’est pas disponible. Choisissez un autre réseau.</p>
        )}
        {!network && !selectedSavedAddressId && Boolean(config?.networks?.length) && (
          <p className="text-xs text-amber-600">Le réseau USDT.TRC20 par défaut est indisponible. Choisissez un réseau manuellement.</p>
        )}
      </div>

      {flow === "withdrawal" && savedAddresses.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="crypto-payout-saved-address">Adresse enregistrée</Label>
          <Select
            value={selectedSavedAddressId}
            onValueChange={id => {
              const saved = savedAddresses.find(item => item.id === id);
              if (!saved) return;
              setAssetCode(saved.assetCode);
              setDestinationAddress(saved.address);
              setDestinationMemo(saved.memo || "");
              setSelectedSavedAddressId(saved.id);
            }}
          >
            <SelectTrigger id="crypto-payout-saved-address">
              <SelectValue placeholder="Choisir une adresse enregistrée" />
            </SelectTrigger>
            <SelectContent>
              {savedAddresses.map(item => (
                <SelectItem key={item.id} value={item.id}>
                  <span className="flex min-w-0 items-center gap-2">
                    <CryptoNetworkLogo networkId={networkIdForAssetCode(item.assetCode, config?.networks || [])} />
                    <span className="truncate">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.assetCode}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.address.length > 18 ? `${item.address.slice(0, 8)}…${item.address.slice(-6)}` : item.address}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSavedAddressId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={deleteAddressMutation.isPending}
              onClick={() => {
                const selected = savedAddresses.find(item => item.id === selectedSavedAddressId);
                if (selected && window.confirm(`Supprimer l’adresse « ${selected.label} » des adresses enregistrées ?`)) {
                  deleteAddressMutation.mutate(selected.id);
                }
              }}
            >
              {deleteAddressMutation.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Trash2 className="mr-2 h-4 w-4" />}
              Supprimer cette adresse
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="crypto-payout-address">Adresse de destination</Label>
        <Input
          id="crypto-payout-address"
          autoComplete="off"
          spellCheck={false}
          value={destinationAddress}
          onChange={event => {
            setDestinationAddress(event.target.value);
            setSelectedSavedAddressId("");
          }}
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
            onChange={event => {
              setDestinationMemo(event.target.value);
              setSelectedSavedAddressId("");
            }}
            maxLength={128}
            placeholder="Memo ou tag du destinataire"
          />
        </div>
      )}

      {flow === "withdrawal" && !selectedSavedAddressId && (
        <div className="space-y-2 rounded-xl border p-3">
          <Label htmlFor="crypto-payout-address-label">Enregistrer pour les prochains retraits</Label>
          <div className="flex gap-2">
            <Input
              id="crypto-payout-address-label"
              value={addressLabel}
              onChange={event => setAddressLabel(event.target.value)}
              placeholder="Nom, par exemple « Mon portefeuille »"
              maxLength={40}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-2"
              disabled={!addressCanBeSaved || saveAddressMutation.isPending}
              onClick={() => saveAddressMutation.mutate()}
            >
              {saveAddressMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {!embedded && (
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
      )}

      <div className="space-y-2">
        <Label>Qui paie les frais AshTechPay ?</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={feeBearer === "sender" ? "default" : "outline"} onClick={() => setFeeBearer("sender")}>
            Vous
          </Button>
          <Button type="button" variant={feeBearer === "recipient" ? "default" : "outline"} onClick={() => setFeeBearer("recipient")}>
            Destinataire
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