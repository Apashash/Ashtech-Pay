/**
 * Minimal PawaPay API v2 client.  This module deliberately has no route or
 * database dependency, so callers can decide how and when to persist requests.
 */

export const PAWAPAY_PRODUCTION_BASE_URL = "https://api.pawapay.io/v2";

export type PawaPayStatus = "completed" | "failed" | "pending";
export type PawaPayDirection = "deposit" | "payout";

export interface PawaPayAccount {
  provider: string;
  phoneNumber: string;
}

export interface PawaPayDepositParams {
  depositId?: string;
  amount: string | number;
  currency: string;
  payer: PawaPayAccount;
  country: string;
  customerMessage?: string;
  clientReferenceId?: string;
  metadata?: Record<string, string>;
  preAuthorisationCode?: string;
}

export interface PawaPayPayoutParams {
  payoutId?: string;
  amount: string | number;
  currency: string;
  recipient: PawaPayAccount;
  country: string;
  customerMessage?: string;
  clientReferenceId?: string;
  metadata?: Record<string, string>;
}

export interface PawaPayPaymentPageParams {
  depositId?: string;
  amount: string | number;
  currency: string;
  phoneNumber?: string;
  customerMessage?: string;
  clientReferenceId?: string;
  returnUrl: string;
  language?: string;
  country?: string;
  reason?: string;
  metadata?: Record<string, string>;
  /** Internal-only provider code used for active-conf validation; never sent. */
  provider?: string;
}

export interface PawaPayResult {
  success: boolean;
  id?: string;
  status: PawaPayStatus;
  providerMessage?: string;
  providerCode?: string;
  providerStatus?: number;
  redirectUrl?: string;
  raw?: unknown;
}

export interface PawaPayCallback {
  id?: string;
  direction?: PawaPayDirection;
  status: PawaPayStatus;
  providerMessage?: string;
  providerCode?: string;
  raw: unknown;
}

export class PawaPayConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PawaPayConfigurationError";
  }
}

const ACTIVE_CONF_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 15_000;
let activeConfCache = new Map<string, { value: unknown; expiresAt: number }>();

const PAWAPAY_COUNTRY_ALIASES: Record<string, string> = {
  BJ: "BEN", BEN: "BEN", BF: "BFA", BFA: "BFA", CD: "COD", COD: "COD",
  CI: "CIV", CIV: "CIV", CM: "CMR", CMR: "CMR", CG: "COG", COG: "COG",
  GA: "GAB", GAB: "GAB", GH: "GHA", GHA: "GHA", KE: "KEN", KEN: "KEN",
  ML: "MLI", MLI: "MLI", MW: "MWI", MWI: "MWI", MZ: "MOZ", MOZ: "MOZ",
  NG: "NGA", NGA: "NGA", RW: "RWA", RWA: "RWA", SN: "SEN", SEN: "SEN",
  TZ: "TZA", TZA: "TZA", UG: "UGA", UGA: "UGA", ZM: "ZMB", ZMB: "ZMB",
  ET: "ETH", ETH: "ETH", LS: "LSO", LSO: "LSO", SL: "SLE", SLE: "SLE",
};

function normalizePawaPayCountry(value: unknown): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  return PAWAPAY_COUNTRY_ALIASES[normalized] ?? normalized;
}

function activeConfigurationCountry(item: any): unknown {
  return item?.country ?? item?.countryCode ?? item?.country_code ?? item?.alpha2 ?? item?.alpha3;
}

function providerConfigurationCode(provider: any): unknown {
  return provider?.provider ?? provider?.providerCode ?? provider?.provider_code ?? provider?.code ?? provider?.name;
}

function providerOperationTypes(provider: any): unknown[] {
  const values = provider?.operationTypes ?? provider?.operation_types ?? provider?.operations ??
    provider?.transactionTypes ?? provider?.transaction_types ?? provider?.operationType ?? provider?.operation_type;
  return Array.isArray(values) ? values : values === undefined ? [] : [values];
}

export interface PawaPayActiveConfigurationOptions {
  country?: string;
  operationType?: string;
  forceRefresh?: boolean;
}

function configuredBaseUrl(): string {
  return PAWAPAY_PRODUCTION_BASE_URL;
}

async function apiToken(): Promise<string> {
  const { getPawaPayApiToken } = await import("./pawapayConfig");
  const token = await getPawaPayApiToken();
  if (token) return token;

  // The environment fallback is intentionally limited to non-production local
  // development. A value saved through the admin page always takes priority.
  if (process.env.NODE_ENV !== "production") {
    const developmentToken = process.env.PAWAPAY_API_TOKEN?.trim();
    if (developmentToken) return developmentToken;
  }
  throw new PawaPayConfigurationError("PawaPay production API token is not configured");
}

export async function isPawaPayConfigured(): Promise<boolean> {
  try {
    await apiToken();
    configuredBaseUrl();
    return true;
  } catch {
    return false;
  }
}

/** Merchant-generated IDs must be UUID version 4, per the PawaPay v2 contract. */
export function createPawaPayId(): string {
  return crypto.randomUUID();
}

export function isPawaPayUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function classifyPawaPayControlledTransaction(
  type: string,
  externalReference: unknown,
): "incoming" | "payout" | null {
  if (typeof externalReference !== "string" || !isPawaPayUuidV4(externalReference)) return null;
  if (type === "deposit" || type === "payment_link") return "incoming";
  if (type === "withdrawal" || type === "transfer_out") return "payout";
  return null;
}

export function validatePawaPayMsisdn(phoneNumber: string): string {
  if (!/^[1-9]\d{5,14}$/.test(phoneNumber)) {
    throw new Error("PawaPay phoneNumber must contain 6–15 digits, without '+' or a leading zero");
  }
  return phoneNumber;
}

export function validatePawaPayCurrency(currency: string): string {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("PawaPay currency must be a three-letter uppercase ISO 4217 code");
  }
  return currency;
}

/**
 * PawaPay amounts follow the v2 decimal expression. Exponents, signs and
 * grouping separators are deliberately rejected.
 */
export function validatePawaPayAmount(amount: string | number): string {
  const value = typeof amount === "number" ? String(amount) : amount;
  if (!/^([0]|([1-9][0-9]{0,17}))([.][0-9]{0,3}[1-9])?$/.test(value) || Number(value) <= 0) {
    throw new Error("PawaPay amount must match ^([0]|([1-9][0-9]{0,17}))([.][0-9]{0,3}[1-9])?$");
  }
  return value;
}

export function normalizePawaPayStatus(status: unknown): PawaPayStatus {
  const value = typeof status === "string" ? status.toUpperCase() : "";
  if (["COMPLETED", "SUCCESSFUL", "SUCCEEDED"].includes(value)) return "completed";
  if (["FAILED", "REJECTED", "CANCELLED", "EXPIRED", "ERROR"].includes(value)) return "failed";
  return "pending";
}

function responseDetails(raw: any, httpStatus?: number) {
  const root = raw && typeof raw === "object" ? raw : {};
  const error = root.error && typeof root.error === "object" ? root.error : {};
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : {};
  const nestedError = data.error && typeof data.error === "object" ? data.error : {};
  const providerMessage = [
    root.providerMessage,
    root.message,
    root.errorMessage,
    root.failureReason,
    root.failureCause,
    root.reason,
    root.description,
    root.detail,
    typeof root.error === "string" ? root.error : undefined,
    data.providerMessage,
    data.message,
    data.errorMessage,
    data.failureReason,
    data.failureCause,
    data.reason,
    data.description,
    data.detail,
    typeof data.error === "string" ? data.error : undefined,
    error.message,
    nestedError.message,
  ]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  const providerCode = [
    root.providerCode,
    root.code,
    root.errorCode,
    root.error_code,
    typeof root.error === "string" && /^[A-Za-z0-9_.-]{2,80}$/.test(root.error) ? root.error : undefined,
    data.providerCode,
    data.code,
    data.errorCode,
    data.error_code,
    typeof data.error === "string" && /^[A-Za-z0-9_.-]{2,80}$/.test(data.error) ? data.error : undefined,
    error.code,
    nestedError.code,
  ]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  return { providerMessage, providerCode, providerStatus: httpStatus };
}

function accountBody(account: PawaPayAccount) {
  if (!account || typeof account.provider !== "string" || !account.provider.trim()) {
    throw new Error("PawaPay provider is required");
  }
  return {
    type: "MMO",
    accountDetails: {
      provider: account.provider,
      phoneNumber: validatePawaPayMsisdn(account.phoneNumber),
    },
  };
}

function metadataBody(metadata: Record<string, string> | undefined): Array<Record<string, string>> | undefined {
  if (!metadata) return undefined;
  return Object.entries(metadata).map(([key, value]) => ({ [key]: value }));
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: "PawaPay returned a non-JSON response" }; }
}

async function request(path: string, method: "GET" | "POST", body?: unknown): Promise<PawaPayResult> {
  const controller = new AbortController();
  const configuredTimeout = Number(process.env.PAWAPAY_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    const token = await apiToken();
    response = await fetch(`${configuredBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const raw: any = await readJson(response);
  const data = raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : raw;
  const status = normalizePawaPayStatus(data?.status);
  // Successful GETs keep transaction data under `data`; errors are commonly
  // top-level, so inspect both without dropping upstream diagnostics.
  const nestedDetails = responseDetails(data);
  const rootDetails = responseDetails(raw, response.status);
  const details = {
    providerMessage: nestedDetails.providerMessage ?? rootDetails.providerMessage,
    providerCode: nestedDetails.providerCode ?? rootDetails.providerCode,
    providerStatus: rootDetails.providerStatus,
  };
  const id = data?.depositId ?? data?.payoutId;
  const found = String(raw?.status ?? "").toUpperCase() !== "NOT_FOUND";
  return {
    success: response.ok && found && status !== "failed",
    id, status, ...details,
    redirectUrl: data?.redirectUrl ?? data?.redirectURL ?? data?.paymentPageUrl,
    raw,
  };
}

function checkedId(id: string | undefined): string {
  const result = id ?? createPawaPayId();
  if (!isPawaPayUuidV4(result)) throw new Error("PawaPay request ID must be a UUID version 4");
  return result;
}

export async function createPawaPayDeposit(params: PawaPayDepositParams): Promise<PawaPayResult> {
  const depositId = checkedId(params.depositId);
  await assertPawaPayProviderActive(params.payer.provider, "DEPOSIT", params.country);
  return request("/deposits", "POST", {
    depositId, amount: validatePawaPayAmount(params.amount), currency: validatePawaPayCurrency(params.currency),
    payer: accountBody(params.payer), customerMessage: params.customerMessage,
    clientReferenceId: params.clientReferenceId, metadata: metadataBody(params.metadata),
    preAuthorisationCode: params.preAuthorisationCode,
  });
}

export async function getPawaPayDeposit(depositId: string): Promise<PawaPayResult> {
  return request(`/deposits/${encodeURIComponent(checkedId(depositId))}`, "GET");
}

export async function createPawaPayPayout(params: PawaPayPayoutParams): Promise<PawaPayResult> {
  const payoutId = checkedId(params.payoutId);
  await assertPawaPayProviderActive(params.recipient.provider, "PAYOUT", params.country);
  return request("/payouts", "POST", {
    payoutId, amount: validatePawaPayAmount(params.amount), currency: validatePawaPayCurrency(params.currency),
    recipient: accountBody(params.recipient), customerMessage: params.customerMessage,
    clientReferenceId: params.clientReferenceId, metadata: metadataBody(params.metadata),
  });
}

export async function getPawaPayPayout(payoutId: string): Promise<PawaPayResult> {
  return request(`/payouts/${encodeURIComponent(checkedId(payoutId))}`, "GET");
}

export async function createPawaPayPaymentPage(params: PawaPayPaymentPageParams): Promise<PawaPayResult> {
  const depositId = checkedId(params.depositId);
  if (!params.returnUrl) throw new Error("PawaPay payment page returnUrl is required");
  if (!params.provider) throw new Error("PawaPay payment page provider is required for active configuration validation");
  await assertPawaPayProviderActive(params.provider, "DEPOSIT", params.country);
  return request("/paymentpage", "POST", {
    depositId, amountDetails: { amount: validatePawaPayAmount(params.amount), currency: validatePawaPayCurrency(params.currency) },
    ...(params.phoneNumber ? { phoneNumber: validatePawaPayMsisdn(params.phoneNumber) } : {}),
    customerMessage: params.customerMessage, clientReferenceId: params.clientReferenceId,
    returnUrl: params.returnUrl, language: params.language, country: params.country, reason: params.reason,
    metadata: metadataBody(params.metadata),
  });
}

function activeConfKey(options: PawaPayActiveConfigurationOptions): string {
  return `${options.country?.toUpperCase() ?? ""}|${options.operationType?.toUpperCase() ?? ""}`;
}

export async function getPawaPayActiveConfiguration(options: PawaPayActiveConfigurationOptions = {}): Promise<unknown> {
  const key = activeConfKey(options);
  const cached = activeConfCache.get(key);
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) return cached.value;
  const result = await request("/active-conf", "GET");
  if (!result.success) throw new Error(result.providerMessage || `PawaPay active-conf failed (HTTP ${result.providerStatus})`);
  const raw: any = result.raw;
  const countries = raw?.countries ?? raw?.data?.countries ?? [];
  const filtered = Array.isArray(countries) ? {
    ...raw,
    countries: countries
      .filter((item: any) => !options.country ||
        normalizePawaPayCountry(activeConfigurationCountry(item)) === normalizePawaPayCountry(options.country))
      .map((item: any) => ({
        ...item,
        providers: Array.isArray(item?.providers) ? item.providers.filter((provider: any) =>
          !options.operationType ||
          providerOperationTypes(provider).some((type: unknown) =>
            String(type).toUpperCase() === options.operationType!.toUpperCase()),
        ) : [],
      })),
  } : result.raw;
  activeConfCache.set(key, { value: filtered, expiresAt: Date.now() + ACTIVE_CONF_TTL_MS });
  return filtered;
}

export function clearPawaPayActiveConfigurationCache(): void {
  activeConfCache.clear();
}

/** Finds a configured provider by its documented provider code (case-insensitive). */
export async function resolvePawaPayProvider(provider: string, options: PawaPayActiveConfigurationOptions = {}): Promise<unknown | undefined> {
  const providers = await listPawaPayProviders(options);
  return providers.find((item: any) => String(providerConfigurationCode(item)).toLowerCase() === provider.toLowerCase());
}

/** Returns the currently active provider records supplied by PawaPay. */
export async function listPawaPayProviders(options: PawaPayActiveConfigurationOptions = {}): Promise<unknown[]> {
  const configuration: any = await getPawaPayActiveConfiguration(options);
  const countries = configuration?.countries ?? configuration?.data?.countries ?? [];
  const rootProviders = configuration?.providers ?? configuration?.data?.providers ?? [];
  return [
    ...(Array.isArray(rootProviders) ? rootProviders : []),
    ...(Array.isArray(countries) ? countries.flatMap((country: any) =>
      Array.isArray(country?.providers) ? country.providers.map((provider: any) => ({
        ...provider,
        country: provider?.country ?? provider?.countryCode ?? provider?.country_code ?? activeConfigurationCountry(country),
      })) : []) : []),
  ];
}

export async function isPawaPayProviderActive(provider: string, options: PawaPayActiveConfigurationOptions = {}): Promise<boolean> {
  return (await resolvePawaPayProvider(provider, options)) !== undefined;
}

export async function assertPawaPayProviderActive(provider: string, operationType: "DEPOSIT" | "PAYOUT", country?: string): Promise<void> {
  const resolved: any = await resolvePawaPayProvider(provider, { country, operationType });
  if (!resolved) {
    throw new Error(`Configured mobile money provider ${provider} is not active for ${operationType}${country ? ` in ${country}` : ""}`);
  }
  const resolvedCountry = resolved.country ?? resolved.countryCode ?? resolved.country_code;
  if (country && resolvedCountry && normalizePawaPayCountry(resolvedCountry) !== normalizePawaPayCountry(country)) {
    throw new Error(`Configured mobile money provider ${provider} is not active for this country (${country})`);
  }
  const operationTypes = providerOperationTypes(resolved);
  if (operationTypes.some(Boolean) && !operationTypes.some((value: unknown) => String(value).toUpperCase() === operationType)) {
    throw new Error(`Configured mobile money provider ${provider} is not active for ${operationType}`);
  }
}

export function parsePawaPayCallback(payload: unknown): PawaPayCallback {
  const raw: any = payload && typeof payload === "object" ? payload : {};
  const data: any = raw.data && typeof raw.data === "object" ? raw.data : raw;
  const details = responseDetails(data);
  const id = data.depositId ?? data.payoutId ?? data.paymentPageId;
  return {
    id,
    direction: data.depositId ? "deposit" : data.payoutId ? "payout" : undefined,
    status: normalizePawaPayStatus(data.status),
    providerMessage: details.providerMessage,
    providerCode: details.providerCode,
    raw: payload,
  };
}

/**
 * RFC 9421 needs the provider's precise Signature-Input component list and
 * algorithm/key-id contract.  PawaPay does not document that contract in v2
 * public API docs, so accepting a signature here would be unsafe.  Callers that
 * opt into verification fail closed until a complete verifier is configured.
 */
export function verifyPawaPayCallbackSignature(_rawBody: string | Buffer, _headers: Record<string, string | string[] | undefined>, enabled = false): boolean {
  if (!enabled) return true;
  throw new PawaPayConfigurationError(
    "PawaPay callback signature verification is enabled but no RFC 9421 verifier is configured; reject this callback",
  );
}