import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Fee, Country } from "@shared/schema";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Link2,
  RefreshCw,
  Info,
  Loader2,
} from "lucide-react";

interface FeeSettings {
  conversionFeePercent: number;
  depositFeePercent: number;
  paymentLinkFeePercent: number;
}

function formatFeeValue(fee: Fee, currency?: string): string {
  if (fee.feeType === "percentage") {
    return `${parseFloat(fee.feeValue).toFixed(2)}%`;
  }
  return `${parseFloat(fee.feeValue).toFixed(0)} ${currency || ""}`.trim();
}

function minFeeLabel(fee: Fee, currency?: string): string | null {
  if (!fee.minFee || parseFloat(fee.minFee) === 0) return null;
  return `min. ${parseFloat(fee.minFee).toLocaleString()} ${currency || ""}`.trim();
}

const SECTION_CONFIG = [
  {
    key: "deposit",
    label: "Dépôt",
    description: "Frais appliqués lorsque vous rechargez votre portefeuille.",
    icon: ArrowDownCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  {
    key: "withdrawal",
    label: "Retrait",
    description: "Frais appliqués lorsque vous retirez des fonds vers votre mobile money.",
    icon: ArrowUpCircle,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    key: "transfer",
    label: "Transfert",
    description: "Frais appliqués lorsque vous envoyez de l'argent vers un autre utilisateur ou un autre pays.",
    icon: ArrowLeftRight,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
];

export default function FeeDetailsPage() {
  const { data: fees = [], isLoading: feesLoading } = useQuery<Fee[]>({
    queryKey: ["/api/public/fees"],
  });

  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ["/api/public/countries"],
  });

  const { data: feeSettings } = useQuery<FeeSettings>({
    queryKey: ["/api/public/fee-settings"],
  });

  const getCountryName = (id: string | null | undefined) =>
    countries.find((c) => c.id === id)?.name || null;

  const getCountryCurrency = (id: string | null | undefined) =>
    countries.find((c) => c.id === id)?.currency || "";

  const getFeesForType = (type: string) =>
    fees.filter((f) => f.transactionType === type);

  if (feesLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-fees-title">Grille des frais</h1>
          <p className="text-muted-foreground mt-2">
            Tous les frais appliqués sur la plateforme, mis à jour en temps réel.
          </p>
        </div>

        {SECTION_CONFIG.map(({ key, label, description, icon: Icon, color, bg, border }) => {
          const sectionFees = getFeesForType(key);
          const globalFee = sectionFees.find((f) => !f.countryId && !f.operatorId);
          const countryFees = sectionFees.filter((f) => f.countryId);

          const depositOverride =
            key === "deposit" && feeSettings?.depositFeePercent !== undefined
              ? feeSettings.depositFeePercent
              : null;

          return (
            <Card key={key} className={`border ${border}`} data-testid={`card-fees-${key}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  {label}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {key === "deposit" ? (
                  <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium">Frais de dépôt</span>
                    <Badge
                      variant="secondary"
                      className="text-sm font-semibold"
                      data-testid="badge-deposit-fee"
                    >
                      {depositOverride !== null && depositOverride !== undefined
                        ? depositOverride === 0
                          ? "Gratuit"
                          : `${depositOverride.toFixed(2)}%`
                        : globalFee
                        ? formatFeeValue(globalFee)
                        : "Gratuit"}
                    </Badge>
                  </div>
                ) : globalFee ? (
                  <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium">Tarif général</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm font-semibold">
                        {formatFeeValue(globalFee)}
                      </Badge>
                      {minFeeLabel(globalFee) && (
                        <span className="text-xs text-muted-foreground">
                          {minFeeLabel(globalFee)}
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}

                {countryFees.length > 0 && (
                  <div className="space-y-2">
                    {globalFee || key === "deposit" ? (
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                        Par pays
                      </p>
                    ) : null}
                    <div className="divide-y divide-border rounded-lg border overflow-hidden">
                      {countryFees
                        .sort((a, b) =>
                          (getCountryName(a.countryId) || "").localeCompare(
                            getCountryName(b.countryId) || ""
                          )
                        )
                        .map((fee) => {
                          const cName = getCountryName(fee.countryId) || "Pays inconnu";
                          const cCurrency = getCountryCurrency(fee.countryId);
                          const min = minFeeLabel(fee, cCurrency);
                          return (
                            <div
                              key={fee.id}
                              className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
                              data-testid={`row-fee-${key}-${fee.id}`}
                            >
                              <span className="text-sm">{cName}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs font-semibold">
                                  {formatFeeValue(fee, cCurrency)}
                                </Badge>
                                {min && (
                                  <span className="text-xs text-muted-foreground hidden sm:inline">
                                    {min}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {!globalFee && countryFees.length === 0 && key !== "deposit" && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun frais configuré pour cette opération.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card className="border border-purple-500/20" data-testid="card-fees-payment-link">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-purple-500" />
              </div>
              Lien de paiement
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Frais déduits automatiquement de chaque paiement reçu via vos liens.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3">
              <span className="text-sm font-medium">Commission par transaction</span>
              <Badge variant="secondary" className="text-sm font-semibold" data-testid="badge-link-fee">
                {feeSettings?.paymentLinkFeePercent !== undefined
                  ? feeSettings.paymentLinkFeePercent === 0
                    ? "Gratuit"
                    : `${feeSettings.paymentLinkFeePercent.toFixed(2)}%`
                  : "2.00%"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-yellow-500/20" data-testid="card-fees-conversion">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-yellow-500" />
              </div>
              Conversion de devises
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Frais appliqués lorsque vous convertissez entre deux devises différentes.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3">
              <span className="text-sm font-medium">Frais de conversion</span>
              <Badge variant="secondary" className="text-sm font-semibold" data-testid="badge-conversion-fee">
                {feeSettings?.conversionFeePercent !== undefined
                  ? `${feeSettings.conversionFeePercent.toFixed(2)}%`
                  : "6.00%"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-xl p-4">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les frais sont calculés automatiquement au moment de chaque opération et déduits du montant
            traité. Les frais minimums s'appliquent lorsque le pourcentage calculé est inférieur au seuil défini.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
