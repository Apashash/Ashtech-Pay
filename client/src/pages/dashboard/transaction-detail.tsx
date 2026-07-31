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

interface TransactionDetails extends Transaction {
  paymentLink?: { title: string; slug: string } | null;
  paymentIntent?: { payerCountry: string; payerPhone: string } | null;
  recipient?: { fullName: string; username: string } | null;
  metadata?: Record<string, any> | null;
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
      <span className="text-sm font-semibold text-foreground text-right max-w-[55%]">{value}</span>
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
  const amountColor = isConversion
    ? "text-blue-500"
    : tx.status === "completed"
      ? (isIncoming ? "text-green-500" : "text-red-500")
      : tx.status === "pending" || tx.status === "pending_manual"
        ? "text-amber-500"
        : "text-muted-foreground";

  const headerBg = isConversion
    ? "from-blue-500/10 to-blue-500/5"
    : isIncoming
      ? "from-green-500/10 to-green-500/5"
      : "from-red-500/10 to-red-500/5";

  const iconBg = isConversion ? "bg-blue-500/20" : isIncoming ? "bg-green-500/20" : "bg-red-500/20";
  const TxIcon = isConversion ? ArrowLeftRight : isPaymentLink ? Link2 : isIncoming ? TrendingUp : TrendingDown;
  const iconColor = isConversion ? "text-blue-500" : isIncoming ? "text-green-500" : "text-red-500";

  const statusBadge = () => {
    switch (tx.status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">{td.detailStatusCompleted}</Badge>;
      case "pending":
      case "pending_manual":
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">{td.detailStatusPending}</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">{td.detailStatusFailed}</Badge>;
      case "cancelled":
        return <Badge className="bg-muted text-muted-foreground">{td.detailStatusCancelled}</Badge>;
      default:
        return <Badge variant="secondary">{tx.status}</Badge>;
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

  const txCurrency = (tx.currency || user?.preferredCurrency || "XAF") as SupportedCurrency;
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
      }
    : null;

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto">
        <div className={`relative rounded-2xl bg-gradient-to-b ${headerBg} p-5 mb-4`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
                <TxIcon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <span className="font-semibold text-foreground text-sm">{typeLabels[tx.type] || tx.type}</span>
            </div>
            <button
              onClick={() => setLocation("/dashboard/transactions")}
              className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
              data-testid="button-close-detail"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="text-center">
            {statusBadge()}
            <p className={`text-4xl font-bold mt-2 ${amountColor}`}>
              {amountPrefix}{formatCurrency(headerAmount, txCurrency)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(tx.createdAt)}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl px-4 pb-4">
          {tx.reference && (
            <>
              <SectionLabel>{td.detailSectionRefs}</SectionLabel>
              <div className="flex items-center justify-between py-3 border-b border-border">
                <span className="text-sm text-muted-foreground">{td.detailRefAshtech}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold font-mono text-foreground">{tx.reference}</span>
                  <button
                    onClick={() => copy(tx.reference!, td.detailRefCopied)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
                    data-testid="button-copy-reference"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </>
          )}

          {(tx.totalAmount || tx.feeAmount) && (
            <>
              <SectionLabel>{td.detailSectionFinance}</SectionLabel>
              {isConversion ? (
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
              {cryptoFeeDetails && (
                <>
                  <Row
                    label="Frais fournisseur"
                    value={<span className="text-amber-500">{cryptoFeeDetails.providerAmount.toFixed(4)} USDT ({cryptoFeeDetails.providerPercent}%)</span>}
                  />
                  <Row
                    label="Frais AshTechPay"
                    value={<span className="text-amber-500">{cryptoFeeDetails.ashtechAmount.toFixed(4)} USDT ({cryptoFeeDetails.ashtechPercent}%)</span>}
                  />
                  <Row
                    label="Total des frais"
                    value={<span className="text-amber-500">{cryptoFeeDetails.totalAmount.toFixed(4)} USDT ({cryptoFeeDetails.totalPercent}%)</span>}
                  />
                  <Row
                    label="Montant net crédité"
                    value={<span className="text-green-500">{cryptoFeeDetails.credited.toFixed(4)} USDT</span>}
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

          <Row label={td.detailTxId} value={`#${tx.id.slice(-8).toUpperCase()}`} />
          <Row label={td.detailCreatedAt} value={formatDate(tx.createdAt)} />
          {tx.confirmedAt && (
            <Row label={td.detailUpdatedAt} value={formatDate(tx.confirmedAt)} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
