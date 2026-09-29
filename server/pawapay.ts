/**
 * Minimal PawaPay API v2 client.  This module deliberately has no route or
 * database dependency, so callers can decide how and when to persist requests.
 */

import { createAsyncTtlCache } from "./providerStatusPolicy";

export const PAWAPAY_PRODUCTION_BASE_URL = "https://api.pawapay.io/v2";
/** PawaPay customer-facing transaction narration. */
export const PAWAPAY_CUSTOMER_MESSAGE = "AshTech sarl";

export type PawaPayStatus = "completed" | "failed" | "pending";
export type PawaPayDirection = "deposit" | "payout";
export type PawaPayAuthType = "PROVIDER_AUTH" | "PREAUTH" | "REDIRECT_AUTH";

export interface PawaPayInstructionChannel {
  type?: "USSD" | "APP" | string;
  displayName?: { en?: string; fr?: string };
  quickLink?: string;
  variables?: Record<string, string>;
  instructions?: {
    en?: Array<{ text?: string; template?: string; variables?: Record<string, string> }>;
    fr?: Array<{ text?: string; template?: string; variables?: Record<string, string> }>;
  };
}

export interface PawaPayInstructions {
  channels?: PawaPayInstructionChannel[];
}

export interface PawaPayOperationConfiguration {
  provider: string;
  country?: string;
  currency?: string;
  operationType: string;
  status?: string;
  authType?: PawaPayAuthType;
  pinPrompt?: "AUTOMATIC" | "MANUAL" | string;
  pinPromptRevivable?: boolean;
  pinPromptInstructions?: PawaPayInstructions;
  authTokenInstructions?: PawaPayInstructions;
}

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
  /** Reuse a route-level active-conf result instead of fetching it again. */
  operationConfiguration?: PawaPayOperationConfiguration;
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
  authorizationUrl?: string;
  nextStep?: string;
  authType?: PawaPayAuthType;
  pinPrompt?: string;
  pinPromptRevivable?: boolean;
  pinPromptInstructions?: PawaPayInstructions;
  authTokenInstructions?: PawaPayInstructions;
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
const STATUS_READ_CACHE_TTL_MS = 15_000;
let activeConfCache = new Map<string, { value: unknown; expiresAt: number }>();
const depositStatusReadCache = createAsyncTtlCache<string, PawaPayResult>(
  STATUS_READ_CACHE_TTL_MS,
  Date.now,
);
const payoutStatusReadCache = createAsyncTtlCache<string, PawaPayResult>(
  STATUS_READ_CACHE_TTL_MS,
  Date.now,
);

const PAWAPAY_COUNTRY_ALIASES: Record<string, string> = {
  BJ: "BEN", BEN: "BEN", BF: "BFA", BFA: "BFA", CD: "COD", COD: "COD",
  CI: "CIV", CIV: "CIV", CM: "CMR", CMR: "CMR", CG: "COG", COG: "COG",
  GA: "GAB", GAB: "GAB", GH: "GHA", GHA: "GHA", KE: "KEN", KEN: "KEN",
  ML: "MLI", MLI: "MLI", MW: "MWI", MWI: "MWI", MZ: "MOZ", MOZ: "MOZ",
  NG: "NGA", NGA: "NGA", RW: "RWA", RWA: "RWA", SN: "SEN", SEN: "SEN",
  TZ: "TZA", TZA: "TZA", UG: "UGA", UGA: "UGA", ZM: "ZMB", ZMB: "ZMB",
  ET: "ETH", ETH: "ETH", LS: "LSO", LSO: "LSO", SL: "SLE", SLE: "SLE",
};

const PAWAPAY_COUNTRY_DIAL_CODES: Record<string, string> = {
  BEN: "229", BFA: "226", COD: "243", CIV: "225", CMR: "237",
  COG: "242", GAB: "241", GHA: "233", KEN: "254", MLI: "223",
  MWI: "265", MOZ: "258", NGA: "234", RWA: "250", SEN: "221",
  TZA: "255", UGA: "256", ZMB: "260", ETH: "251", LSO: "266",
  SLE: "232",
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
  const directTypes = Array.isArray(values)
    ? values
    : values && typeof values === "object"
      ? Object.keys(values)
      : values === undefined ? [] : [values];
  const currencyTypes = Array.isArray(provider?.currencies)
    ? provider.currencies.flatMap((currency: any) => {
        const nested = currency?.operationTypes ?? currency?.operation_types;
        return Array.isArray(nested)
          ? nested
          : nested && typeof nested === "object"
            ? Object.keys(nested)
            : nested === undefined ? [] : [nested];
      })
    : [];
  return [...directTypes, ...currencyTypes];
}

function providerCountry(provider: any): string | undefined {
  const value = provider?.country ?? provider?.countryCode ?? provider?.country_code;
  return value === undefined ? undefined : normalizePawaPayCountry(value);
}

function currencyCode(currency: any): string | undefined {
  const value = currency?.currency ?? currency?.currencyCode ?? currency?.currency_code;
  return value === undefined ? undefined : String(value).trim().toUpperCase();
}

function operationConfiguration(provider: any, operationType: string, currency?: string): any | undefined {
  const requested = operationType.toUpperCase();
  const currencies = Array.isArray(provider?.currencies) ? provider.currencies : [];
  const matchingCurrencies = currency
    ? currencies.filter((item: any) => currencyCode(item) === currency.toUpperCase())
    : currencies;

  for (const currencyConfig of matchingCurrencies) {
    const operations = currencyConfig?.operationTypes ?? currencyConfig?.operation_types;
    if (operations && typeof operations === "object" && !Array.isArray(operations)) {
      const key = Object.keys(operations).find(item => item.toUpperCase() === requested);
      if (key) return { ...operations[key], currency: currencyCode(currencyConfig) };
    }
  }

  const direct = provider?.operationTypes ?? provider?.operation_types ?? provider?.operations;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    const key = Object.keys(direct).find(item => item.toUpperCase() === requested);
    if (key) return direct[key];
  }

  // Older/simplified active-conf responses expose operation names as an array.
  // Keep those responses usable, but do not invent auth details.
  if (!currencies.length && Array.isArray(direct) &&
      direct.some((item: unknown) => String(item).toUpperCase() === requested)) {
    return {};
  }
  return undefined;
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

/**
 * PawaPay expects an international MSISDN that starts with the selected
 * country's dial code. The public form accepts local digits, so add the
 * country prefix at the PawaPay boundary instead of changing stored phones.
 */
export function formatPawaPayMsisdn(phoneNumber: string, country?: string): string {
  const digits = String(phoneNumber ?? "").replace(/\D/g, "");
  if (!digits) throw new Error("PawaPay phoneNumber is required");

  const countryCode = normalizePawaPayCountry(country);
  const dialCode = PAWAPAY_COUNTRY_DIAL_CODES[countryCode];
  if (!dialCode || digits.startsWith(dialCode)) return validatePawaPayMsisdn(digits);

  // Preserve an already-international number for a mismatched country so
  // PawaPay can return its precise country/provider validation error rather
  // than corrupting the number by prepending a second country code.
  const startsWithKnownDialCode = Object.values(PAWAPAY_COUNTRY_DIAL_CODES)
    .some(candidate => digits.startsWith(candidate));
  if (startsWithKnownDialCode) return validatePawaPayMsisdn(digits);

  const localDigits = digits.startsWith("0") ? digits.slice(1) : digits;
  return validatePawaPayMsisdn(`${dialCode}${localDigits}`);
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

/** Canonicalizes internal fixed-point amounts before applying PawaPay's format. */
export function formatPawaPayAmount(amount: string | number): string {
  const value = typeof amount === "number" ? String(amount) : amount;
  const canonical = value.includes(".")
    ? value.replace(/0+$/, "").replace(/\.$/, "")
    : value;
  return validatePawaPayAmount(canonical);
}

export function normalizePawaPayStatus(status: unknown): PawaPayStatus {
  const value = typeof status === "string" ? status.toUpperCase() : "";
  if (["COMPLETED", "SUCCESSFUL", "SUCCEEDED"].includes(value)) return "completed";
  if (["FAILED", "REJECTED", "CANCELLED", "EXPIRED"].includes(value)) return "failed";
  return "pending";
}

function responseDetails(raw: any, httpStatus?: number) {
  const root = raw && typeof raw === "object" ? raw : {};
  const error = root.error && typeof root.error === "object" ? root.error : {};
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : {};
  const nestedError = data.error && typeof data.error === "object" ? data.error : {};
  const failureReason = root.failureReason && typeof root.failureReason === "object" ? root.failureReason : {};
  const nestedFailureReason = data.failureReason && typeof data.failureReason === "object" ? data.failureReason : {};
  const providerMessage = [
    failureReason.failureMessage,
    failureReason.message,
    failureReason.description,
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
    nestedFailureReason.failureMessage,
    nestedFailureReason.message,
    nestedFailureReason.description,
    error.message,
    nestedError.message,
  ]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  const providerCode = [
    failureReason.failureCode,
    failureReason.code,
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
    nestedFailureReason.failureCode,
    nestedFailureReason.code,
    error.code,
    nestedError.code,
  ]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  return { providerMessage, providerCode, providerStatus: httpStatus };
}

function resultAuthorizationFields(data: any): Partial<PawaPayResult> {
  const authType = data?.authType;
  return {
    redirectUrl: data?.redirectUrl ?? data?.redirectURL ?? data?.paymentPageUrl,
    authorizationUrl: data?.authorizationUrl,
    nextStep: typeof data?.nextStep === "string" ? data.nextStep : undefined,
    ...(authType === "PROVIDER_AUTH" || authType === "PREAUTH" || authType === "REDIRECT_AUTH"
      ? { authType }
      : {}),
  };
}

function accountBody(account: PawaPayAccount, country?: string) {
  if (!account || typeof account.provider !== "string" || !account.provider.trim()) {
    throw new Error("PawaPay provider is required");
  }
  return {
    type: "MMO",
    accountDetails: {
      provider: account.provider,
      phoneNumber: formatPawaPayMsisdn(account.phoneNumber, country),
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
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let fetchTimeout: ReturnType<typeof setTimeout> | undefined;
  let stage: "credentials" | "headers" | "body" = "credentials";
  let response: Response;
  let raw: unknown;

  console.info(`[PawaPay] ${method} ${path} started (timeout=${timeoutMs}ms)`);
  try {
    // The AbortController cannot cancel a database lookup performed by
    // apiToken(). Bound that lookup separately so a cold Plesk/pgBouncer
    // connection cannot leave a public checkout request pending forever.
    let credentialTimeout: ReturnType<typeof setTimeout> | undefined;
    const token = await Promise.race([
      apiToken(),
      new Promise<never>((_, reject) => {
        credentialTimeout = setTimeout(() => {
          reject(new Error(`PawaPay credential lookup timed out after ${timeoutMs}ms`));
        }, Math.max(1, deadline - Date.now()));
      }),
    ]).finally(() => {
      if (credentialTimeout) clearTimeout(credentialTimeout);
    });

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error(`PawaPay ${method} ${path} timed out before the provider request`);
    }

    stage = "headers";
    fetchTimeout = setTimeout(() => controller.abort(), remainingMs);
    response = await fetch(`${configuredBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    console.info(`[PawaPay] ${method} ${path} headers received (status=${response.status}, elapsed=${Date.now() - startedAt}ms)`);

    // Keep the abort timer active while consuming the response body. Some
    // upstream/proxy failures return headers but never finish the payload.
    stage = "body";
    raw = await readJson(response);
    console.info(`[PawaPay] ${method} ${path} completed (status=${response.status}, elapsed=${Date.now() - startedAt}ms)`);
  } catch (error: any) {
    const elapsed = Date.now() - startedAt;
    if (error?.name === "AbortError") {
      throw new Error(`PawaPay ${method} ${path} timed out while reading the ${stage} response after ${elapsed}ms`);
    }
    console.error(`[PawaPay] ${method} ${path} failed during ${stage} after ${elapsed}ms: ${error?.message || "unknown error"}`);
    throw error;
  } finally {
    if (fetchTimeout) clearTimeout(fetchTimeout);
  }
  const parsedRaw: any = raw;
  const data = parsedRaw?.data && typeof parsedRaw.data === "object" && !Array.isArray(parsedRaw.data) ? parsedRaw.data : parsedRaw;
  const status = normalizePawaPayStatus(data?.status);
  // Successful GETs keep transaction data under `data`; errors are commonly
  // top-level, so inspect both without dropping upstream diagnostics.
  const nestedDetails = responseDetails(data);
  const rootDetails = responseDetails(parsedRaw, response.status);
  const details = {
    providerMessage: nestedDetails.providerMessage ?? rootDetails.providerMessage,
    providerCode: nestedDetails.providerCode ?? rootDetails.providerCode,
    // PawaPay can return HTTP 200 with an application-level REJECTED status.
    // Do not show "Status: 200" as if it were the reason for that rejection.
    providerStatus: response.ok ? undefined : rootDetails.providerStatus,
  };
  const id = data?.depositId ?? data?.payoutId;
  const found = String(parsedRaw?.status ?? "").toUpperCase() !== "NOT_FOUND";
  return {
    success: response.ok && found && status !== "failed",
    id, status, ...details,
    ...resultAuthorizationFields(data),
    raw: parsedRaw,
  };
}

function checkedId(id: string | undefined): string {
  const result = id ?? createPawaPayId();
  if (!isPawaPayUuidV4(result)) throw new Error("PawaPay request ID must be a UUID version 4");
  return result;
}

export async function createPawaPayDeposit(params: PawaPayDepositParams): Promise<PawaPayResult> {
  const depositId = checkedId(params.depositId);
  const operation = params.operationConfiguration ??
    await resolvePawaPayOperationConfiguration(
      params.payer.provider, "DEPOSIT", params.country, params.currency,
    );
  await assertPawaPayProviderActive(
    params.payer.provider, "DEPOSIT", params.country, params.currency, operation,
  );
  const result = await request("/deposits", "POST", {
    depositId, amount: formatPawaPayAmount(params.amount), currency: validatePawaPayCurrency(params.currency),
    payer: accountBody(params.payer, params.country),
    customerMessage: params.customerMessage ?? PAWAPAY_CUSTOMER_MESSAGE,
    clientReferenceId: params.clientReferenceId, metadata: metadataBody(params.metadata),
    preAuthorisationCode: params.preAuthorisationCode,
  });
  return {
    ...result,
    authType: result.authType ?? operation?.authType,
    pinPrompt: operation?.pinPrompt,
    pinPromptRevivable: operation?.pinPromptRevivable,
    pinPromptInstructions: operation?.pinPromptInstructions,
    authTokenInstructions: operation?.authTokenInstructions,
  };
}

export async function getPawaPayDeposit(depositId: string): Promise<PawaPayResult> {
  const id = checkedId(depositId);
  return depositStatusReadCache.get(id, async () => {
    const result = await request(`/deposits/${encodeURIComponent(id)}`, "GET");
    // HTTP errors and not-found lookups remain non-terminal. A GET failure is
    // not proof that the original deposit was rejected.
    if (result.providerStatus !== undefined) return { ...result, status: "pending" };
    return result;
  });
}

export async function createPawaPayPayout(params: PawaPayPayoutParams): Promise<PawaPayResult> {
  const payoutId = checkedId(params.payoutId);
  await assertPawaPayProviderActive(params.recipient.provider, "PAYOUT", params.country, params.currency);
  return request("/payouts", "POST", {
    payoutId, amount: formatPawaPayAmount(params.amount), currency: validatePawaPayCurrency(params.currency),
    recipient: accountBody(params.recipient, params.country),
    customerMessage: params.customerMessage ?? PAWAPAY_CUSTOMER_MESSAGE,
    clientReferenceId: params.clientReferenceId, metadata: metadataBody(params.metadata),
  });
}

export async function getPawaPayPayout(payoutId: string): Promise<PawaPayResult> {
  const id = checkedId(payoutId);
  return payoutStatusReadCache.get(id, async () => {
    const result = await request(`/payouts/${encodeURIComponent(id)}`, "GET");
    if (result.providerStatus !== undefined) return { ...result, status: "pending" };
    return result;
  });
}

export async function createPawaPayPaymentPage(params: PawaPayPaymentPageParams): Promise<PawaPayResult> {
  const depositId = checkedId(params.depositId);
  if (!params.returnUrl) throw new Error("PawaPay payment page returnUrl is required");
  if (!params.provider) throw new Error("PawaPay payment page provider is required for active configuration validation");
  await assertPawaPayProviderActive(params.provider, "DEPOSIT", params.country, params.currency);
  return request("/paymentpage", "POST", {
    depositId, amountDetails: { amount: formatPawaPayAmount(params.amount), currency: validatePawaPayCurrency(params.currency) },
    ...(params.phoneNumber ? { phoneNumber: formatPawaPayMsisdn(params.phoneNumber, params.country) } : {}),
    customerMessage: params.customerMessage ?? PAWAPAY_CUSTOMER_MESSAGE,
    clientReferenceId: params.clientReferenceId,
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

/**
 * Resolves the exact country/provider/currency/operation record from active-conf.
 * PawaPay nests operationTypes under each provider currency, so callers must not
 * infer authorisation behavior from the provider name or from PixPay catalogs.
 */
export async function resolvePawaPayOperationConfiguration(
  provider: string,
  operationType: "DEPOSIT" | "PAYOUT",
  country?: string,
  currency?: string,
): Promise<PawaPayOperationConfiguration | undefined> {
  const providers = await listPawaPayProviders({ country, operationType });
  const expectedCountry = country ? normalizePawaPayCountry(country) : undefined;
  const expectedCurrency = currency?.toUpperCase();
  for (const item of providers as any[]) {
    if (String(providerConfigurationCode(item) ?? "").toLowerCase() !== provider.toLowerCase()) continue;
    if (expectedCountry && providerCountry(item) && providerCountry(item) !== expectedCountry) continue;

    const operation = operationConfiguration(item, operationType, expectedCurrency);
    if (!operation) continue;
    return {
      provider,
      country: providerCountry(item),
      currency: operation.currency ?? expectedCurrency,
      operationType,
      status: operation.status,
      authType: ["PROVIDER_AUTH", "PREAUTH", "REDIRECT_AUTH"].includes(String(operation.authType).toUpperCase())
        ? String(operation.authType).toUpperCase() as PawaPayAuthType
        : undefined,
      pinPrompt: operation.pinPrompt,
      pinPromptRevivable: operation.pinPromptRevivable,
      pinPromptInstructions: operation.pinPromptInstructions,
      authTokenInstructions: operation.authTokenInstructions,
    };
  }
  return undefined;
}

export async function assertPawaPayProviderActive(
  provider: string,
  operationType: "DEPOSIT" | "PAYOUT",
  country?: string,
  currency?: string,
  resolvedOperation?: PawaPayOperationConfiguration,
): Promise<void> {
  const operationResolved = resolvedOperation ??
    await resolvePawaPayOperationConfiguration(provider, operationType, country, currency);
  const resolved: any = operationResolved ?? await resolvePawaPayProvider(provider, { country, operationType });
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
  const operation = operationConfiguration(resolved, operationType, currency);
  if (currency && Array.isArray(resolved.currencies) && resolved.currencies.length > 0 && !operation) {
    throw new Error(`Configured mobile money provider ${provider} is not active for ${operationType} in ${currency}`);
  }
  const resolvedStatus = operationResolved?.status ?? operation?.status;
  if (resolvedStatus && String(resolvedStatus).toUpperCase() === "CLOSED") {
    throw new Error(`Configured mobile money provider ${provider} is currently unavailable for ${operationType}`);
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