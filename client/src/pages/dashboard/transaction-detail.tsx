import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Transaction, User, SupportedCurrency } from "@shared/schema";
import { TrendingUp, TrendingDown, ArrowLeftRight, Link2, Copy, X, Loader2, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { useMemo } from "react";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/language";
import { getTransactionStatusCategory } from "@shared/transaction-status";

interface TransactionDetails extends Transaction {
  paymentLink?: { title: string; slug: string } | null;
  paymentIntent?: { payerCountry: string; payerPhone: string } | null;
  recipient?: { fullName: string; username: string } | null;
  metadata: Record<string, any> | null;
  balanceCurrency?: string;
  balanceBefore?: string;
  balanceAfter?: string;
  targetBalanceCurrency?: string;
  targetBalanceBefore?: string;
  targetBalanceAfter?: string;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
  } catch { return "—"; }
}

interface RowProps {
  label: string;
  value: React.ReactNode;
}
function Row({ label, value }: RowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right max-w-[55%] min-w-0 break-all">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pt-5 pb-1">
      {children}
    </p>
  );
}

export default function TransactionDetailPage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const td = t.transactions;

  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: depositConfig } = useQuery<any>({ queryKey: ["/api/public/deposit-config"] });

  const { data: tx, isLoading } = useQuery<TransactionDetails>({
    queryKey: [`/api/transactions/${params.id}`],
    enabled: !!params.id,
  });

  const depositLabel = tx?.paymentMethod === "crypto" ? td.typeDepositCrypto : td.typeDeposit;
  const typeLabels: Record<string, string> = {
    deposit: depositLabel,
    withdrawal: td.typeWithdrawal,
    transfer_in: td.typeTransferIn,
    transfer_out: td.typeTransferOut,
    payment_link: td.typePaymentLink,
    conversion: td.typeConversion,
  };

  const operatorMap = useMemo<Record<string, { name: string; country: string; countryCode: string }>>(() => {
    const map: Record<string, { name: string; country: string; countryCode: string }> = {};
    for (const country of depositConfig?.countries || []) {
      for (const op of country.operators || []) {
        map[op.id] = { name: op.name, country: country.name, countryCode: country.id };
      }
    }
    return map;
  }, [depositConfig]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!tx) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">{td.detailNotFound}</p>
          <Button variant="ghost" className="mt-4" onClick={() => setLocation("/dashboard/transactions")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> {td.detailBack}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isIncoming = ["deposit", "transfer_in", "payment_link"].includes(tx.type);
  const isConversion = tx.type === "conversion";
  const isPaymentLink = tx.type === "payment_link";

  const amountPrefix = isConversion ? "⇄ " : (isIncoming ? "+" : "-");
  const statusCategory = getTransactionStatusCategory(tx.status);
  const isSuccessful = statusCategory === "completed";
  const isPending = statusCategory === "pending";
  const isFailed = statusCategory === "failed" || statusCategory === "cancelled";
  const statusTone = isSuccessful ? "success" : isPending ? "pending" : isFailed ? "failed" : statusCategory === "processing" ? "processing" : null;

  const headerBg = statusTone === "success"
    ? "bg-green-600"
      : statusTone === "pending"
      ? "bg-amber-500"
        : statusTone === "processing"
          ? "bg-blue-500"
      : statusTone === "failed"
        ? "bg-red-600"
        : isConversion
          ? "bg-blue-500"
          : isIncoming
            ? "bg-green-600"
            : "bg-red-600";

  const iconBg = statusTone === "success"
    ? "bg-white/20"
    : statusTone === "pending"
      ? "bg-white/20"
      : statusTone === "failed"
        ? "bg-white/20"
        : isConversion
          ? "bg-white/20"
          : isIncoming
            ? "bg-white/20"
            : "bg-white/20";
  const TxIcon = isConversion ? ArrowLeftRight : isPaymentLink ? Link2 : isIncoming ? TrendingUp : TrendingDown;
  const iconColor = "text-white";

  const statusBadge = () => {
    switch (statusCategory) {
      case "completed":
        return <Badge className="bg-white/20 text-white border-white/30 font-semibold">{td.detailStatusCompleted}</Badge>;
      case "pending":
        return <Badge className="bg-white/20 text-white border-white/30 font-semibold">{td.detailStatusPending}</Badge>;
      case "processing":
        return <Badge className="bg-white/20 text-white border-white/30 font-semibold">{td.statusProcessing}</Badge>;
      case "failed":
        return <Badge className="bg-white/20 text-white border-white/30 font-semibold">{td.detailStatusFailed}</Badge>;
      case "cancelled":
        return <Badge className="bg-white/20 text-white border-white/30 font-semibold">{td.detailStatusCancelled}</Badge>;
      default:
        return <Badge className="bg-white/20 text-white border-white/30 font-semibold">{td.statusUnknown}</Badge>;
    }
  };

  const operatorInfo = tx.operatorId ? operatorMap[tx.operatorId] : null;
  const isOutgoing = ["transfer_out", "withdrawal"].includes(tx.type);

  // For conversions: amount = gross debited (e.g. 2000 XAF), totalAmount = received in target currency (e.g. 1880 XAFG)
  // For outgoing: amount = net to recipient, totalAmount = gross debited from sender
  const realTotalAmount = tx.totalAmount ? parseFloat(tx.totalAmount) : 0;
  const realNetAmount = parseFloat(tx.amount);

  // Fee: for conversions feeAmount stores the real total fee directly; for others derive from gross - net
  const realFee = isConversion
    ? (tx.feeAmount ? parseFloat(tx.feeAmount) : 0)
    : (realTotalAmount > realNetAmount) ? (realTotalAmount - realNetAmount) : (tx.feeAmount ? parseFloat(tx.feeAmount) : 0);

  // Fee base: for conversions use the gross debited (tx.amount); for others use the gross total
  const feeBase = isConversion ? realNetAmount : (realTotalAmount > 0 ? realTotalAmount : realNetAmount);
  const feePercent = (realFee > 0 && feeBase > 0)
    ? ((realFee / feeBase) * 100).toFixed(2)
    : null;

  // For outgoing transactions, show the gross debited amount in the header
  const headerAmount = (isOutgoing && realTotalAmount > 0) ? tx.totalAmount! : tx.amount;

  // Conversion target currency (stored in recipientCountry for conversion transactions)
  const toCurrency = (isConversion && tx.recipientCountry) ? tx.recipientCountry as SupportedCurrency : null;

  const payerPhone = tx.paymentIntent?.payerPhone;
  const payerCountry = tx.paymentIntent?.payerCountry || operatorInfo?.country;
  const merchantReference = typeof tx.metadata?.merchantReference === "string"
    ? tx.metadata.merchantReference
    : typeof tx.metadata?.merchant_reference === "string"
      ? tx.metadata.merchant_reference
      : null;

  const txCurrency = (tx.currency || user?.preferredCurrency || "XAF") as SupportedCurrency;
  const cryptoAssetCode = tx.paymentMethod === "crypto"
    ? (tx.metadata?.assetCode || tx.description?.match(/crypto ([A-Z0-9.]+) —/)?.[1] || "")
    : "";
  const cryptoCoinName = cryptoAssetCode ? cryptoAssetCode.split(".")[0] : "USDT";
  const cryptoFeeDetails = tx.paymentMethod === "crypto" && tx.metadata
    ? {
        gross: Number(tx.metadata.grossAmountUsdt ?? tx.totalAmount ?? tx.amount),
        providerPercent: Number(tx.metadata.providerFeePercent ?? 0),
        providerAmount: Number(tx.metadata.providerFeeAmountUsdt ?? 0),
        ashtechPercent: Number(tx.metadata.ashtechFeePercent ?? 0),
        ashtechAmount: Number(tx.metadata.ashtechFeeAmountUsdt ?? tx.ashtechFeeAmount ?? 0),
        totalPercent: Number(tx.metadata.totalFeePercent ?? feePercent ?? 0),
        totalAmount: Number(tx.metadata.totalFeeAmountUsdt ?? tx.feeAmount ?? realFee),
        credited: Number(tx.metadata.creditedAmountUsdt ?? tx.amount),
        grossCoin: tx.metadata.grossAmountCoin != null ? Number(tx.metadata.grossAmountCoin) : null,
        creditedCoin: tx.metadata.creditedAmountCoin != null ? Number(tx.metadata.creditedAmountCoin) : null,
        coinPriceUsdt: tx.metadata.coinPriceUsdt != null ? Number(tx.metadata.coinPriceUsdt) : null,
      }
    : null;
  const headerAmountText = cryptoFeeDetails
    ? `${amountPrefix}${cryptoFeeDetails.credited.toFixed(4)} USDT`
    : `${amountPrefix}${formatCurrency(headerAmount, txCurrency)}`;
  const headerAmountLength = headerAmountText.replace(/\s/g, "").length;
  const headerAmountSize = headerAmountLength > 14 ? "text-2xl" : headerAmountLength > 11 ? "text-3xl" : "text-4xl";

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto">
        <div className={`relative rounded-2xl ${headerBg} p-6 mb-4`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
                <TxIcon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <span className="text-white/75 text-sm font-semibold">{typeLabels[tx.type] || tx.type}</span>
            </div>
            <button
              onClick={() => setLocation("/dashboard/transactions")}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
              data-testid="button-close-detail"
            >
              <X className="w-4 h-4 text-white/80" />
            </button>
          </div>

          <div className="text-center">
            {statusBadge()}
            <p className={`${headerAmountSize} font-bold leading-tight tracking-tight text-white whitespace-nowrap mt-2`}>
              {headerAmountText}
            </p>
            {cryptoFeeDetails && cryptoAssetCode && (
              <p className="text-xs text-white/75 font-mono mt-0.5">{cryptoAssetCode}</p>
            )}
            <p className="text-sm text-white/75 mt-1">
              {formatDate(tx.createdAt)}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl px-4 pb-4">
          {(tx.reference || merchantReference) && (
            <>
              <SectionLabel>{td.detailSectionRefs}</SectionLabel>
              {tx.reference && (
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">{td.detailRefAshtech}</span>
                  <div className="flex items-center gap-2 max-w-[65%]">
                    <span className="text-sm font-semibold font-mono text-foreground break-all text-right">{tx.reference}</span>
                    <button
                      onClick={() => copy(tx.reference!, td.detailRefCopied)}
                      className="w-6 h-6 shrink-0 flex items-center justify-center rounded hover:bg-muted transition-colors"
                      aria-label={td.detailRefAshtech}
                      data-testid="button-copy-reference"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}
              {merchantReference && (
                <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">{td.detailRefMerchant}</span>
                  <div className="flex items-center gap-2 max-w-[65%]">
                    <span className="text-sm font-semibold font-mono text-foreground break-all text-right">{merchantReference}</span>
                    <button
                      onClick={() => copy(merchantReference, td.detailMerchantRefCopied)}
                      className="w-6 h-6 shrink-0 flex items-center justify-center rounded hover:bg-muted transition-colors"
                      aria-label={td.detailRefMerchant}
                      data-testid="button-copy-merchant-reference"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {(tx.totalAmount || tx.feeAmount || cryptoFeeDetails) && (
            <>
              <SectionLabel>{td.detailSectionFinance}</SectionLabel>
              {cryptoFeeDetails ? (
                <>
                  <Row
                    label="Montant débité"
                    value={
                      <span className="flex flex-col items-end">
                        <span>{cryptoFeeDetails.gross.toFixed(4)} USDT</span>
                        {cryptoFeeDetails.grossCoin !== null && cryptoAssetCode && cryptoCoinName !== "USDT" && (
                          <span className="text-xs text-amber-500 font-mono">≈ {cryptoFeeDetails.grossCoin.toFixed(6)} {cryptoCoinName}</span>
                        )}
                      </span>
                    }
                  />
                  <Row
                    label={`Frais${cryptoFeeDetails.totalPercent ? ` (${cryptoFeeDetails.totalPercent}%)` : ""}`}
                    value={<span className="text-amber-500">{cryptoFeeDetails.totalAmount.toFixed(4)} USDT</span>}
                  />
                  <Row
                    label="Montant reçu"
                    value={
                      <span className="flex flex-col items-end">
                        <span className="text-green-500">{cryptoFeeDetails.credited.toFixed(4)} USDT</span>
                        {cryptoFeeDetails.creditedCoin !== null && cryptoAssetCode && cryptoCoinName !== "USDT" && (
                          <span className="text-xs text-amber-500 font-mono">≈ {cryptoFeeDetails.creditedCoin.toFixed(6)} {cryptoCoinName}</span>
                        )}
                      </span>
                    }
                  />
                  <Row
                    label="Total des frais"
                    value={<span className="text-amber-500">{cryptoFeeDetails.totalAmount.toFixed(4)} USDT ({cryptoFeeDetails.totalPercent}%)</span>}
                  />
                  <Row
                    label="Montant net crédité"
                    value={
                      <span className="flex flex-col items-end">
                        <span className="text-green-500">{cryptoFeeDetails.credited.toFixed(4)} USDT</span>
                        {cryptoFeeDetails.creditedCoin !== null && cryptoAssetCode && cryptoCoinName !== "USDT" && (
                          <span className="text-xs text-amber-500 font-mono">≈ {cryptoFeeDetails.creditedCoin.toFixed(6)} {cryptoCoinName}</span>
                        )}
                      </span>
                    }
                  />
                  <Row
                    label={td.detailCurrency}
                    value={<span className="font-mono text-amber-500">{cryptoAssetCode || "USDT"}</span>}
                  />
                </>
              ) : isConversion ? (
                <>
                  {/* Conversion: amount = gross debited, feeAmount = total fee, totalAmount = received in target currency */}
                  <Row
                    label={td.detailGross}
                    value={<span>{formatCurrency(tx.amount, txCurrency)}</span>}
                  />
                  {realFee > 0 && (
                    <Row
                      label={`${td.detailFee}${feePercent ? ` (${feePercent}%)` : ""}`}
                      value={<span className="text-amber-500">{formatCurrency(realFee.toFixed(2), txCurrency)}</span>}
                    />
                  )}
                  {realTotalAmount > 0 && (
                    <Row
                      label={td.detailConverted}
                      value={
                        <span className="text-green-500">
                          {formatCurrency(tx.totalAmount!, toCurrency || txCurrency)}
                        </span>
                      }
                    />
                  )}
                </>
              ) : (
                <>
                  {realTotalAmount > 0 && (
                    <Row
                      label={td.detailGross}
                      value={<span>{formatCurrency(tx.totalAmount!, txCurrency)}</span>}
                    />
                  )}
                  {realFee > 0 && (
                    <Row
                      label={`${td.detailFee}${feePercent ? ` (${feePercent}%)` : ""}`}
                      value={<span className="text-amber-500">{formatCurrency(realFee.toFixed(2), txCurrency)}</span>}
                    />
                  )}
                  <Row
                    label={isOutgoing ? td.detailSentToRecipient : td.detailReceived}
                    value={<span className="text-green-500">{formatCurrency(tx.amount, txCurrency)}</span>}
                  />
                </>
              )}
            </>
          )}

          <SectionLabel>{td.detailSectionInfo}</SectionLabel>
          <Row label={td.detailType} value={typeLabels[tx.type] || tx.type} />
          <Row
            label={td.detailCurrency}
            value={isConversion && toCurrency ? `${tx.currency || "XAF"} → ${toCurrency}` : (tx.currency || "XAF")}
          />

          {payerPhone && (
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">{td.detailPhone}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{payerPhone}</span>
                <button
                  onClick={() => copy(payerPhone, td.detailPhoneCopied)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
                  data-testid="button-copy-phone"
                >
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}

          {operatorInfo && (
            <Row label={td.detailOperator} value={operatorInfo.name.toUpperCase()} />
          )}

          {payerCountry && (
            <Row label={td.detailCountry} value={payerCountry} />
          )}

          {tx.recipientName && (
            <Row label={td.detailRecipient} value={tx.recipientName} />
          )}
          {tx.recipientPhone && (
            <Row label={td.detailRecipientPhone} value={tx.recipientPhone} />
          )}
          {tx.payerName && (
            <Row label={td.detailPayer} value={tx.payerName} />
          )}

          {tx.balanceBefore !== undefined && tx.balanceAfter !== undefined && (
            <>
              <SectionLabel>ÉVOLUTION DU SOLDE</SectionLabel>
              <Row
                label={`Solde avant (${tx.balanceCurrency || tx.currency || "XAF"})`}
                value={formatCurrency(tx.balanceBefore, (tx.balanceCurrency || tx.currency || "XAF") as SupportedCurrency)}
              />
              <Row
                label={`Solde après (${tx.balanceCurrency || tx.currency || "XAF"})`}
                value={formatCurrency(tx.balanceAfter, (tx.balanceCurrency || tx.currency || "XAF") as SupportedCurrency)}
              />
              {tx.targetBalanceCurrency && tx.targetBalanceBefore !== undefined && tx.targetBalanceAfter !== undefined && (
                <>
                  <Row
                    label={`Solde cible avant (${tx.targetBalanceCurrency})`}
                    value={formatCurrency(tx.targetBalanceBefore, tx.targetBalanceCurrency as SupportedCurrency)}
                  />
                  <Row
                    label={`Solde cible après (${tx.targetBalanceCurrency})`}
                    value={formatCurrency(tx.targetBalanceAfter, tx.targetBalanceCurrency as SupportedCurrency)}
                  />
                </>
              )}
            </>
          )}
          <Row label={td.detailCreatedAt} value={formatDate(tx.createdAt)} />
          {tx.confirmedAt && (
            <Row label={td.detailUpdatedAt} value={formatDate(tx.confirmedAt)} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
