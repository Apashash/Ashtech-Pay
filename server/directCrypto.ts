export const DIRECT_CRYPTO_CURRENCIES = new Set([
  "USDT",
  "XAF",
  "XOF",
  "GNF",
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
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface DirectCryptoAmounts {
  grossUsdt: number;
  feeUsdt: number;
  creditedUsdt: number;
  feePercent: number;
}

export function parseDirectCryptoRequest(body: any):
  | { ok: true; value: DirectCryptoRequest }
  | { ok: false; error: string; message: string } {
  const rawAmount = body?.amount;
  const amount = typeof rawAmount === "number" ? rawAmount : parseFloat(String(rawAmount ?? ""));
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

  const customer = body?.customer && typeof body.customer === "object" ? body.customer : {};
  const email = String(customer.email ?? body?.email ?? "").trim() || undefined;
  const firstName = String(customer.firstName ?? customer.first_name ?? body?.first_name ?? "").trim() || undefined;
  const lastName = String(customer.lastName ?? customer.last_name ?? body?.last_name ?? "").trim() || undefined;

  return {
    ok: true,
    value: {
      amount,
      currency,
      assetCode,
      reference: body?.reference ? String(body.reference).trim() : undefined,
      notifyUrl: body?.notify_url ? String(body.notify_url).trim() : null,
      refundAddress: body?.refund_address ?? body?.refundAddress
        ? String(body.refund_address ?? body.refundAddress).trim()
        : null,
      firstName,
      lastName,
      email,
    },
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
  };
}