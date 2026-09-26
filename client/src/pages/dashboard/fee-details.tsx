import { DashboardLayout } from "@/components/dashboard-layout";
import { CryptoNetworkLogo } from "@/components/crypto-network-logo";
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
  Coins,
} from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/language";
import { useIziAssets } from "@/lib/use-crypto-assets";

interface PublicOperator {
  id: string;
  name: string;
  type: string;
  countryId: string;
  logoUrl: string | null;
}

interface CryptoWithdrawalFeeRule {
  fixedUsdt: number;
  percentage: number;
}

interface PublicCryptoFeeSettings {
  cryptoFeePercent?: number;
  cryptoWithdrawalFeeConfig?: {
    global: Record<string, CryptoWithdrawalFeeRule>;
    countries: Record<string, Record<string, CryptoWithdrawalFeeRule>>;
  };
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

function fmtCryptoWithdrawalFee(rule: CryptoWithdrawalFeeRule): string {
  const parts: string[] = [];
  if (rule.percentage > 0) parts.push(`${rule.percentage.toFixed(2)}%`);
  if (rule.fixedUsdt > 0) parts.push(`${rule.fixedUsdt.toFixed(2)} USDT`);
  return parts.length ? parts.join(" + ") : "Gratuit";
}

const CRYPTO_SECTION_ID = "__crypto-fees__";

export default function FeeDetailsPage() {
  const [openSection, setOpenSection] = useState<string | null>(null);
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

  const { data: cryptoFeeSettings } = useQuery<PublicCryptoFeeSettings>({
    queryKey: ["/api/public/fee-settings"],
  });
  const { coins: cryptoCoins } = useIziAssets();
  const usdtNetworks = cryptoCoins.USDT?.networks ?? [];

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

  const cryptoWithdrawalConfig = cryptoFeeSettings?.cryptoWithdrawalFeeConfig;
  const configuredCryptoWithdrawalNetworks = usdtNetworks.flatMap(network => {
    const assetCode = network.assetCode.toUpperCase();
    const globalRule = cryptoWithdrawalConfig?.global?.[assetCode];
    const countryRules = Object.entries(cryptoWithdrawalConfig?.countries ?? {}).flatMap(
      ([countryId, rules]) => {
        const rule = rules[assetCode];
        if (!rule) return [];
        const country = countries.find(item => item.id === countryId);
        return [{
          countryId,
          countryName: country?.name ?? countryId,
          countryFlag: country?.flag || "🏳️",
          rule,
        }];
      },
    );

    return globalRule || countryRules.length > 0
      ? [{ network, assetCode, globalRule, countryRules }]
      : [];
  });

  const hasCryptoFeeInfo = cryptoFeeSettings !== undefined && (
    typeof cryptoFeeSettings.cryptoFeePercent === "number" || usdtNetworks.length > 0
  );
  const isCryptoOpen = openSection === CRYPTO_SECTION_ID;
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

        {(countriesWithFees.length > 0 || hasCryptoFeeInfo) && (
          <div className="space-y-3">
            {countriesWithFees.length > 0 && (
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground px-1">
                {fp.byCountry}
              </h2>
            )}
            <div className="space-y-2">
              {hasCryptoFeeInfo && cryptoFeeSettings && (
                <Card
                  className="border border-border overflow-hidden"
                  data-testid="card-crypto-fees"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    aria-expanded={isCryptoOpen}
                    aria-controls="crypto-fee-details"
                    onClick={() => setOpenSection(isCryptoOpen ? null : CRYPTO_SECTION_ID)}
                    data-testid="btn-crypto-fees"
                  >
                    <div className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Coins className="w-7 h-7 text-violet-500" />
                        <p className="font-semibold text-foreground">{fp.cryptoSection}</p>
                      </div>
                      {isCryptoOpen ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
                      )}
                    </div>
                  </button>

                  {isCryptoOpen && (
                    <div id="crypto-fee-details" className="border-t border-border">
                      {typeof cryptoFeeSettings.cryptoFeePercent === "number" && (
                        <div
                          className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-violet-500/10"
                          data-testid="row-crypto-deposit-fee"
                        >
                          <span className="text-sm font-medium text-foreground">{fp.cryptoDeposit}</span>
                          <Badge variant="outline" className="text-xs font-semibold border-green-500/30 text-green-700 dark:text-green-400">
                            {cryptoFeeSettings.cryptoFeePercent.toFixed(2)}%
                          </Badge>
                        </div>
                      )}

                      {configuredCryptoWithdrawalNetworks.map(({ network, assetCode, globalRule, countryRules }) => (
                        <div key={assetCode} className="border-t border-border/60 first:border-t-0">
                          <div
                            className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-background/40"
                            data-testid={`row-crypto-withdrawal-fee-${assetCode}`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{fp.cryptoWithdrawal}</span>
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CryptoNetworkLogo networkId={network.id} />
                                {network.label} · {assetCode}
                              </span>
                              {globalRule && countryRules.length > 0 && (
                                <Badge variant="secondary" className="text-xs py-0 h-5">
                                  {fp.defaultBadge}
                                </Badge>
                              )}
                            </div>
                            {globalRule && (
                              <Badge variant="outline" className="text-xs font-semibold border-orange-500/30 text-orange-700 dark:text-orange-400">
                                {fmtCryptoWithdrawalFee(globalRule)}
                              </Badge>
                            )}
                          </div>
                          {countryRules.map(({ countryId, countryName, countryFlag, rule }) => (
                            <div
                              key={countryId}
                              className="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 border-t border-border/60"
                              data-testid={`row-crypto-withdrawal-fee-${countryId}-${assetCode}`}
                            >
                              <span className="flex items-center gap-2 text-sm text-foreground">
                                <span>{countryFlag}</span>
                                {countryName}
                              </span>
                              <Badge variant="outline" className="text-xs font-semibold border-orange-500/30 text-orange-700 dark:text-orange-400">
                                {fmtCryptoWithdrawalFee(rule)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ))}

                      {usdtNetworks.length > 0 && configuredCryptoWithdrawalNetworks.length === 0 && (
                        <div
                          className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border/60"
                          data-testid="row-crypto-withdrawal-fee-unconfigured"
                        >
                          <span className="text-sm text-foreground">{fp.cryptoWithdrawal}</span>
                          <Badge variant="secondary" className="text-xs">
                            {fp.cryptoWithdrawalUnconfigured}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {countriesWithFees.map(country => {
                const isOpen = openSection === country.id;
                const countryOperators = operators.filter(op => op.countryId === country.id);

                return (
                  <Card
                    key={country.id}
                    className="border border-border overflow-hidden"
                    data-testid={`card-country-${country.id}`}
                  >
                    <button
                      className="w-full text-left"
                       onClick={() => setOpenSection(isOpen ? null : country.id)}
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
                              <div className={`flex items-center px-5 py-3 ${bg}`}>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-white/60 dark:bg-black/20">
                                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                                  </div>
                                  <span className="text-sm font-semibold">{label}</span>
                                  {isGlobalFallback && (
                                    <Badge variant="secondary" className="text-xs py-0 h-5">{fp.defaultBadge}</Badge>
                                  )}
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
