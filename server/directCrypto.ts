export const DIRECT_CRYPTO_CURRENCIES = new Set([
  "USDT",
  "XAF",
  "XOF",
  "CDF",
  "USD",
]);

/** Minimum gross amount accepted by all crypto Pay-In entry points. */
export const MIN_DIRECT_CRYPTO_USDT = 1;

export interface DirectCryptoRequest {
  amount: number;
  currency: string;
  assetCode: string;
  reference?: string;
  notifyUrl?: string | null;
  refundAddress?: string | null;
  firstName: string;
  lastName: string;
  email: string;
}

export interface DirectCryptoAmounts {
  grossUsdt: number;
  feeUsdt: number;
  creditedUsdt: number;
  feePercent: number;
  providerFeePercent: number;
  providerFeeUsdt: number;
  ashtechFeePercent: number;
  ashtechFeeUsdt: number;
  totalFeePercent: number;
}

export interface DirectCryptoCustomer {
  firstName: string;
  lastName: string;
  email: string;
  refundAddress?: string;
}

export function parseDirectCryptoRequest(body: any):
  | { ok: true; value: DirectCryptoRequest }
  | { ok: false; error: string; message: string } {
  const rawAmount = body?.amount;
  const amountText = typeof rawAmount === "number" ? String(rawAmount) : String(rawAmount ?? "").trim();
  const amount = amountText !== "" && /^[+]?(?:\d+\.?\d*|\.\d+)$/.test(amountText)
    ? Number(amountText)
    : Number.NaN;
  const currency = String(body?.currency || "").trim().toUpperCase();
  const assetCode = String(body?.asset_code ?? body?.assetCode ?? "").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalid_amount", message: "amount doit être un nombre positif." };
  }
  if (!currency) {
    return { ok: false, error: "missing_fields", message: "Champs requis : amount, currency, asset_code" };
  }
  if (!DIRECT_CRYPTO_CURRENCIES.has(currency)) {
    return {
      ok: false,
      error: "invalid_currency",
      message: `currency doit être l'une des valeurs suivantes : ${Array.from(DIRECT_CRYPTO_CURRENCIES).join(", ")}.`,
    };
  }
  if (!assetCode) {
    return { ok: false, error: "missing_fields", message: "Champs requis : amount, currency, asset_code" };
  }

  if (
    body?.customer !== undefined &&
    (body.customer === null ||
      typeof body.customer !== "object" ||
      Array.isArray(body.customer))
  ) {
    return {
      ok: false,
      error: "invalid_customer",
      message: "customer doit être un objet JSON contenant email, firstName et lastName.",
    };
  }

  const customer = body?.customer && typeof body.customer === "object" ? body.customer : {};
  const email = String(customer.email ?? body?.email ?? "").trim() || undefined;
  const firstName = String(customer.firstName ?? customer.first_name ?? body?.first_name ?? "").trim() || undefined;
  const lastName = String(customer.lastName ?? customer.last_name ?? body?.last_name ?? "").trim() || undefined;
  const notifyUrl = body?.notify_url ? String(body.notify_url).trim() : "";
  const refundAddress = body?.refund_address ?? body?.refundAddress
    ? String(body.refund_address ?? body.refundAddress).trim()
    : "";

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid_email", message: "customer.email doit être une adresse email valide." };
  }
  if (!email) {
    return {
      ok: false,
      error: "missing_customer_email",
      message: "customer.email est obligatoire pour un paiement crypto.",
    };
  }
  if (!firstName) {
    return {
      ok: false,
      error: "missing_customer_first_name",
      message: "customer.firstName est obligatoire pour un paiement crypto.",
    };
  }
  if (!lastName) {
    return {
      ok: false,
      error: "missing_customer_last_name",
      message: "customer.lastName est obligatoire pour un paiement crypto.",
    };
  }
  if (notifyUrl) {
    try {
      const url = new URL(notifyUrl);
      if (url.protocol !== "https:") throw new Error("protocol");
    } catch {
      return { ok: false, error: "invalid_notify_url", message: "notify_url doit être une URL HTTPS valide." };
    }
  }

  return {
    ok: true,
    value: {
      amount,
      currency,
      assetCode,
      reference: body?.reference ? String(body.reference).trim() : undefined,
      notifyUrl: notifyUrl || null,
      refundAddress: refundAddress || null,
      firstName,
      lastName,
      email,
    },
  };
}

/**
 * The upstream crypto charge endpoint requires an email-bearing customer
 * object. Parsing rejects requests without that email before this helper runs.
 */
export function buildDirectCryptoCustomer(
  request: DirectCryptoRequest,
): DirectCryptoCustomer {
  return {
    firstName: request.firstName,
    lastName: request.lastName,
    email: request.email,
    refundAddress: request.refundAddress || undefined,
  };
}

export function computeDirectCryptoAmounts(grossUsdt: number, feePercent: number): DirectCryptoAmounts {
  const safeGross = Number(grossUsdt);
  const safeFeePercent = Number(feePercent);
  const feeUsdt = safeGross * (safeFeePercent / 100);
  return {
    grossUsdt: Number(safeGross.toFixed(6)),
    feeUsdt: Number(feeUsdt.toFixed(6)),
    creditedUsdt: Number((safeGross - feeUsdt).toFixed(6)),
    feePercent: Number(safeFeePercent.toFixed(4)),
    providerFeePercent: 0,
    providerFeeUsdt: 0,
    ashtechFeePercent: Number(safeFeePercent.toFixed(4)),
    ashtechFeeUsdt: Number(feeUsdt.toFixed(6)),
    totalFeePercent: Number(safeFeePercent.toFixed(4)),
  };
}

/**
 * Calculate the complete crypto Pay-In fee split. The provider and AshTechPay
 * components are deliberately calculated from the same gross amount so that
 * the displayed breakdown, persisted transaction and wallet credit agree.
 */
export function computeDirectCryptoFeeBreakdown(
  grossUsdt: number,
  providerFeePercent: number,
  ashtechFeePercent: number,
): DirectCryptoAmounts {
  const safeGross = Number(grossUsdt);
  const safeProviderPercent = Number(providerFeePercent) || 0;
  const safeAshtechPercent = Number(ashtechFeePercent) || 0;
  const totalFeePercent = safeProviderPercent + safeAshtechPercent;
  const providerFeeUsdt = safeGross * (safeProviderPercent / 100);
  const ashtechFeeUsdt = safeGross * (safeAshtechPercent / 100);
  const feeUsdt = providerFeeUsdt + ashtechFeeUsdt;

  return {
    grossUsdt: Number(safeGross.toFixed(6)),
    feeUsdt: Number(feeUsdt.toFixed(6)),
    creditedUsdt: Number((safeGross - feeUsdt).toFixed(6)),
    feePercent: Number(totalFeePercent.toFixed(4)),
    providerFeePercent: Number(safeProviderPercent.toFixed(4)),
    providerFeeUsdt: Number(providerFeeUsdt.toFixed(6)),
    ashtechFeePercent: Number(safeAshtechPercent.toFixed(4)),
    ashtechFeeUsdt: Number(ashtechFeeUsdt.toFixed(6)),
    totalFeePercent: Number(totalFeePercent.toFixed(4)),
  };
}