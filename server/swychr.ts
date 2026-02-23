import fs from "fs";
import path from "path";

const SWYCHR_BASE_URL = "https://api.accountpe.com/api";
const SWYCHR_EMAIL = process.env.SWYCHR_EMAIL || "";
const SWYCHR_PASSWORD = process.env.SWYCHR_PASSWORD || "";
const SWYCHR_HOSTED_BASE = "https://app.swychrconnect.com";
const TOKEN_FILE = path.join(process.cwd(), ".local", "swychr_token.json");

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

function parseJwtExp(token: string): Date | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (payload.exp) {
      return new Date(payload.exp * 1000);
    }
  } catch {}
  return null;
}

function loadPersistedToken(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
      if (data.token && data.expiry) {
        const expiry = new Date(data.expiry);
        if (expiry > new Date()) {
          cachedToken = data.token;
          tokenExpiry = expiry;
          console.log("[Swychr] Loaded persisted token, valid until:", expiry.toISOString());
        }
      }
    }
  } catch (e) {
    console.warn("[Swychr] Could not load persisted token:", e);
  }
}

function persistToken(token: string, expiry: Date): void {
  try {
    const dir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, expiry: expiry.toISOString() }), "utf8");
  } catch (e) {
    console.warn("[Swychr] Could not persist token:", e);
  }
}

loadPersistedToken();

export async function getSwychrToken(): Promise<string> {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }
  const res = await fetch(`${SWYCHR_BASE_URL}/swychpay/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SWYCHR_EMAIL, password: SWYCHR_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Swychr auth failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  const token = json.data?.token || json.token;
  if (!token) {
    throw new Error(`Swychr auth: no token in response: ${JSON.stringify(json)}`);
  }
  const jwtExpiry = parseJwtExp(token);
  const expiry = jwtExpiry || new Date(Date.now() + 47 * 60 * 60 * 1000);
  cachedToken = token;
  tokenExpiry = expiry;
  persistToken(token, expiry);
  console.log("[Swychr] New token obtained, valid until:", expiry.toISOString());
  return cachedToken!;
}

export interface SwychrCreateLinkParams {
  country_code: string;
  name: string;
  email: string;
  mobile?: string;
  amount: number;
  currency: string;
  transaction_id: string;
  description?: string;
  pass_digital_charge: boolean;
  callback_url?: string;
}

export interface SwychrCreateLinkResponse {
  success: boolean;
  data?: {
    id: number;
    payment_link: string;
    transaction_id: string;
  };
  message?: string;
}

export async function createSwychrPaymentLink(params: SwychrCreateLinkParams): Promise<SwychrCreateLinkResponse> {
  try {
    const token = await getSwychrToken();
    const res = await fetch(`${SWYCHR_BASE_URL}/swychpay/create_payment_links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Idempotency-Key": params.transaction_id,
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (res.ok && data.data?.id) {
      const id = data.data.id;
      const payment_link = data.data.payment_link || `${SWYCHR_HOSTED_BASE}/payment/${id}`;
      return {
        success: true,
        data: { id, payment_link, transaction_id: params.transaction_id },
        message: data.message,
      };
    }
    return { success: false, message: data.message || data.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export interface SwychrStatusResponse {
  success: boolean;
  status?: "pending" | "completed" | "failed";
  rawStatus?: number;
  data?: any;
  message?: string;
}

export async function checkSwychrPaymentStatus(transaction_id: string): Promise<SwychrStatusResponse> {
  try {
    const token = await getSwychrToken();
    const res = await fetch(`${SWYCHR_BASE_URL}/swychpay/payment_link_status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ transaction_id }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || data.error || `HTTP ${res.status}` };
    }
    const inner = data.data?.data || data.data || {};
    const rawStatus = inner.status ?? inner.attributes?.status ?? null;
    let status: "pending" | "completed" | "failed" = "pending";
    if (rawStatus === 1 || rawStatus === "success" || rawStatus === "completed") {
      status = "completed";
    } else if (rawStatus === 2 || rawStatus === "failed" || rawStatus === "cancelled") {
      status = "failed";
    }
    return { success: true, status, rawStatus, data: inner };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
