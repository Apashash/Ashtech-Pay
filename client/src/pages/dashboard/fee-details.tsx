import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Fee, Country } from "@shared/schema";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Loader2,
  ChevronDown,
  ChevronRight,
  Smartphone,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/language";

interface PublicOperator {
  id: string;
  name: string;
  type: string;
  countryId: string;
  logoUrl: string | null;
}

function fmtFee(fee: Fee | null | undefined, currency?: string): string {
  if (!fee) return "—";
  if (fee.feeType === "percentage") return `${parseFloat(fee.feeValue).toFixed(2)}%`;
  return `${parseFloat(fee.feeValue).toLocaleString()} ${currency || ""}`.trim();
}

function fmtMin(fee: Fee | null | undefined, currency?: string): string | null {
  if (!fee || !fee.minFee || parseFloat(fee.minFee) === 0) return null;
  return `min ${parseFloat(fee.minFee).toLocaleString()} ${currency || ""}`.trim();
}

export default function FeeDetailsPage() {
  const [openCountry, setOpenCountry] = useState<string | null>(null);
  const { t } = useLanguage();
  const fp = t.feePage;

  const TX_TYPES = [
    {
      key: "deposit",
      label: fp.typeDeposit,
      icon: ArrowDownCircle,
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      badgeCls: "border-green-500/30 text-green-700 dark:text-green-400",
    },
    {
      key: "withdrawal",
      label: fp.typeWithdrawal,
      icon: ArrowUpCircle,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      badgeCls: "border-orange-500/30 text-orange-700 dark:text-orange-400",
    },
    {
      key: "transfer",
      label: fp.typeTransfer,
      icon: ArrowLeftRight,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      badgeCls: "border-blue-500/30 text-blue-700 dark:text-blue-400",
    },
  ] as const;

  const { data: fees = [], isLoading } = useQuery<Fee[]>({
    queryKey: ["/api/public/fees"],
  });

  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ["/api/public/countries"],
  });

  const { data: operators = [] } = useQuery<PublicOperator[]>({
    queryKey: ["/api/public/operators"],
  });

  const activeFees = fees.filter(f => f.isActive);

  function getGlobalFee(type: string): Fee | null {
    return activeFees.find(f => f.transactionType === type && !f.countryId && !f.operatorId) ?? null;
  }

  function getCountryFee(type: string, countryId: string): Fee | null {
    return activeFees.find(f => f.transactionType === type && f.countryId === countryId && !f.operatorId) ?? null;
  }

  function getOperatorFee(type: string, operatorId: string): Fee | null {
    return activeFees.find(f => f.transactionType === type && f.operatorId === operatorId) ?? null;
  }

  function resolvedFee(type: string, countryId: string): Fee | null {
    return getCountryFee(type, countryId) ?? getGlobalFee(type);
  }

  const countriesWithFees = countries.filter(c =>
    TX_TYPES.some(t => resolvedFee(t.key, c.id) !== null)
  );

  if (isLoading) {
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
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-fees-title">
            {fp.title}
          </h1>
        </div>

        {countriesWithFees.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground px-1">
              {fp.byCountry}
            </h2>
            <div className="space-y-2">
              {countriesWithFees.map(country => {
                const isOpen = openCountry === country.id;
                const countryOperators = operators.filter(op => op.countryId === country.id);

                return (
                  <Card
                    key={country.id}
                    className="border border-border overflow-hidden"
                    data-testid={`card-country-${country.id}`}
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => setOpenCountry(isOpen ? null : country.id)}
                      data-testid={`btn-country-${country.id}`}
                    >
                      <div className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{country.flag || "🏳️"}</span>
                          <div>
                            <p className="font-semibold text-foreground">{country.name}</p>
                            <p className="text-xs text-muted-foreground">{country.currency}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="hidden sm:flex items-center gap-1.5">
                            {TX_TYPES.map(({ key, label, badgeCls }) => {
                              const fee = resolvedFee(key, country.id);
                              if (!fee) return null;
                              return (
                                <Badge
                                  key={key}
                                  variant="outline"
                                  className={`text-xs ${badgeCls}`}
                                  title={label}
                                >
                                  {fmtFee(fee, country.currency)}
                                </Badge>
                              );
                            })}
                          </div>
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
                          )}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border">
                        {TX_TYPES.map(({ key, label, icon: Icon, color, bg, border, badgeCls }) => {
                          const countryFee = getCountryFee(key, country.id);
                          const globalFee = getGlobalFee(key);
                          const baseFee = countryFee ?? globalFee;
                          if (!baseFee) return null;

                          const isGlobalFallback = !countryFee && !!globalFee;

                          const opsWithFee = countryOperators.filter(
                            op => getOperatorFee(key, op.id) !== null
                          );
                          const opsDefault = countryOperators.filter(
                            op => getOperatorFee(key, op.id) === null
                          );

                          return (
                            <div key={key} className="border-b border-border last:border-0">
                              <div className={`flex items-center justify-between px-5 py-3 ${bg}`}>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-white/60 dark:bg-black/20">
                                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                                  </div>
                                  <span className="text-sm font-semibold">{label}</span>
                                  {isGlobalFallback && (
                                    <Badge variant="secondary" className="text-xs py-0 h-5">{fp.defaultBadge}</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {fmtMin(baseFee, country.currency) && (
                                    <span className="text-xs text-muted-foreground hidden sm:inline">
                                      {fmtMin(baseFee, country.currency)}
                                    </span>
                                  )}
                                  <Badge variant="outline" className={`font-semibold text-sm ${badgeCls}`}>
                                    {fmtFee(baseFee, country.currency)}
                                  </Badge>
                                </div>
                              </div>

                              {countryOperators.length > 0 && (
                                <div className="divide-y divide-border/60">
                                  {opsWithFee.map(op => {
                                    const opFee = getOperatorFee(key, op.id)!;
                                    return (
                                      <div
                                        key={op.id}
                                        className="flex items-center justify-between px-6 py-2.5 bg-background/60"
                                        data-testid={`row-op-fee-${key}-${op.id}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {op.type === "mobile_money" ? (
                                            <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                                          ) : (
                                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                          )}
                                          <span className="text-sm text-foreground">{op.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {fmtMin(opFee, country.currency) && (
                                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                              {fmtMin(opFee, country.currency)}
                                            </span>
                                          )}
                                          <Badge variant="outline" className={`text-xs font-semibold ${badgeCls}`}>
                                            {fmtFee(opFee, country.currency)}
                                          </Badge>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {opsDefault.map(op => (
                                    <div
                                      key={op.id}
                                      className="flex items-center justify-between px-6 py-2.5 bg-background/40"
                                      data-testid={`row-op-default-${key}-${op.id}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        {op.type === "mobile_money" ? (
                                          <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                                        ) : (
                                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                        )}
                                        <span className="text-sm text-muted-foreground">{op.name}</span>
                                      </div>
                                      <Badge variant="secondary" className="text-xs">
                                        {fmtFee(baseFee, country.currency)}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
