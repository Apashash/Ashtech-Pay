export interface CryptoPayoutFeeRule {
  fixedUsdt: number;
  percentage: number;
}

export interface CryptoPayoutFeeConfig {
  global: Record<string, CryptoPayoutFeeRule>;
  countries: Record<string, Record<string, CryptoPayoutFeeRule>>;
}

export interface CryptoPayoutCalculation {
  enteredAmount: string;
  ashtechFee: string;
  payoutAmount: string;
  totalDebit: string;
}

const ZERO_FEE: CryptoPayoutFeeRule = { fixedUsdt: 0, percentage: 0 };

function parseRule(value: unknown): CryptoPayoutFeeRule | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const fixedUsdt = Number(source.fixedUsdt ?? 0);
  const percentage = Number(source.percentage ?? 0);
  if (!Number.isFinite(fixedUsdt) || !Number.isFinite(percentage) || fixedUsdt < 0 || percentage < 0 || percentage > 100) {
    return undefined;
  }
  return { fixedUsdt, percentage };
}

export function parseCryptoPayoutFeeConfig(value: unknown): CryptoPayoutFeeConfig {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== "object") return { global: {}, countries: {} };
  const source = raw as Record<string, unknown>;
  const global: Record<string, CryptoPayoutFeeRule> = {};
  const countries: Record<string, Record<string, CryptoPayoutFeeRule>> = {};

  if (source.global && typeof source.global === "object" && !Array.isArray(source.global)) {
    for (const [assetCode, rawRule] of Object.entries(source.global as Record<string, unknown>)) {
      const rule = parseRule(rawRule);
      if (rule) global[assetCode.toUpperCase()] = rule;
    }
  }
  if (source.countries && typeof source.countries === "object" && !Array.isArray(source.countries)) {
    for (const [countryId, rawRules] of Object.entries(source.countries as Record<string, unknown>)) {
      if (!rawRules || typeof rawRules !== "object" || Array.isArray(rawRules)) continue;
      const rules: Record<string, CryptoPayoutFeeRule> = {};
      for (const [assetCode, rawRule] of Object.entries(rawRules as Record<string, unknown>)) {
        const rule = parseRule(rawRule);
        if (rule) rules[assetCode.toUpperCase()] = rule;
      }
      countries[countryId] = rules;
    }
  }
  return { global, countries };
}

export function resolveCryptoPayoutFee(
  config: CryptoPayoutFeeConfig,
  countryId: string | undefined,
  assetCode: string,
): CryptoPayoutFeeRule {
  const normalizedAsset = assetCode.trim().toUpperCase();
  return config.countries[countryId || ""]?.[normalizedAsset]
    || config.global[normalizedAsset]
    || ZERO_FEE;
}

export function calculateCryptoPayout(
  amountValue: number,
  rule: CryptoPayoutFeeRule,
  feeBearer: "sender" | "recipient",
): CryptoPayoutCalculation {
  if (!Number.isFinite(amountValue) || amountValue <= 0 || Math.abs(Math.round(amountValue * 100) / 100 - amountValue) > 1e-9) {
    throw new Error("INVALID_CRYPTO_PAYOUT_AMOUNT");
  }
  const enteredCents = Math.round(amountValue * 100);
  const feeCents = Math.round(
    (rule.fixedUsdt + amountValue * rule.percentage / 100) * 100,
  );
  const payoutCents = feeBearer === "recipient" ? enteredCents - feeCents : enteredCents;
  const debitCents = feeBearer === "sender" ? enteredCents + feeCents : enteredCents;
  if (payoutCents <= 0 || debitCents <= 0) throw new Error("CRYPTO_PAYOUT_FEE_EXCEEDS_AMOUNT");
  const format = (cents: number) => (cents / 100).toFixed(2);
  return {
    enteredAmount: format(enteredCents),
    ashtechFee: format(feeCents),
    payoutAmount: format(payoutCents),
    totalDebit: format(debitCents),
  };
}

export function isDefinitiveIziPayoutRejection(error: unknown): boolean {
  const candidate = error as { status?: unknown; code?: unknown } | null;
  const status = Number(candidate?.status);
  const code = String(candidate?.code || "").toUpperCase();
  if (status !== 400 && status !== 422) return false;
  return new Set([
    "INVALID_ADDRESS",
    "INVALID_DESTINATION",
    "ADDRESS_INVALID",
    "MEMO_REQUIRED",
    "INVALID_MEMO",
    "AMOUNT_TOO_SMALL",
    "ASSET_UNSUPPORTED",
    "ASSET_NOT_SUPPORTED",
    "ASSET_DISABLED",
  ]).has(code);
}