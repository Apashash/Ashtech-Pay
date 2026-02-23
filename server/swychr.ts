const SWYCHR_BASE_URL = process.env.SWYCHR_API_URL || "https://app.swychrconnect.com";
const SWYCHR_EMAIL = process.env.SWYCHR_EMAIL || "";
const SWYCHR_PASSWORD = process.env.SWYCHR_PASSWORD || "";

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

export async function getSwychrToken(): Promise<string> {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }
  const res = await fetch(`${SWYCHR_BASE_URL}/admin/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SWYCHR_EMAIL, password: SWYCHR_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Swychr auth failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  cachedToken = data.token;
  tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
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
    const res = await fetch(`${SWYCHR_BASE_URL}/create_payment_links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Idempotency-Key": params.transaction_id,
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (res.ok && data.data?.payment_link) {
      return { success: true, data: data.data, message: data.message };
    }
    return { success: false, message: data.message || `HTTP ${res.status}` };
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
    const res = await fetch(`${SWYCHR_BASE_URL}/payment_link_status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ transaction_id }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || `HTTP ${res.status}` };
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
