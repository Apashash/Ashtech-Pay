const SOLEASPAY_BASE_URL = "https://soleaspay.com";
const SOLEASPAY_API_KEY = process.env.SOLEASPAY_API_KEY || "";
const SOLEASPAY_SECRET_KEY = process.env.SOLEASPAY_SECRET_KEY || "";

interface SoleaspayAuthResponse {
  token: string;
  data: {
    expireAt: string;
  };
}

interface SoleaspayPaymentResponse {
  success: boolean;
  code?: number;
  status: string;
  created_at: string;
  data: {
    operation: string;
    reference: string;
    external_reference: string;
    transaction_reference: string | null;
    transaction_category?: string;
    transaction_channel?: string;
    amount: string;
    currency: string;
  };
  message: string;
}

interface SoleaspayVerifyResponse {
  success: boolean;
  code?: number;
  status: string;
  created_at: string;
  data: {
    operation: string;
    reference: string;
    external_reference: string;
    transaction_reference: string;
    amount: number;
    currency: string;
  };
  message: string;
}

const OPERATOR_SERVICE_MAP: Record<string, number> = {
  "MTN Mobile Money": 1,
  "MTN Money": 1,
  "Orange Money": 2,
  "Moov Money": 3,
  "Wave": 4,
  "Free Money": 5,
  "T-Money": 6,
  "Airtel Money": 7,
  "Vodacom M-Pesa": 8,
  "M-Pesa": 9,
};

let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

export async function getAuthToken(): Promise<string> {
  if (cachedToken && tokenExpiry && tokenExpiry > new Date()) {
    return cachedToken;
  }

  const response = await fetch(`${SOLEASPAY_BASE_URL}/api/action/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      public_apikey: SOLEASPAY_API_KEY,
      private_secretkey: SOLEASPAY_SECRET_KEY,
    }),
  });

  if (!response.ok) {
    throw new Error(`SoleAsPay auth failed: ${response.status}`);
  }

  const data: SoleaspayAuthResponse = await response.json();
  cachedToken = data.token;
  tokenExpiry = new Date(data.data.expireAt);
  
  return cachedToken;
}

export function getOperatorServiceId(operatorName: string): number {
  for (const [key, value] of Object.entries(OPERATOR_SERVICE_MAP)) {
    if (operatorName.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(operatorName.toLowerCase())) {
      return value;
    }
  }
  return 1;
}

export interface CollectPaymentParams {
  wallet: string;
  amount: number;
  currency: string;
  orderId: string;
  description: string;
  payerName: string;
  payerEmail: string;
  operatorName: string;
  successUrl?: string;
  failureUrl?: string;
  otp?: string;
}

export async function collectPayment(params: CollectPaymentParams): Promise<SoleaspayPaymentResponse> {
  const serviceId = getOperatorServiceId(params.operatorName);
  
  const headers: Record<string, string> = {
    "x-api-key": SOLEASPAY_API_KEY,
    "operation": "2",
    "service": serviceId.toString(),
    "Content-Type": "application/json",
  };

  if (params.otp) {
    headers["otp"] = params.otp;
  }

  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://localhost:5000";

  const body = {
    wallet: params.wallet,
    amount: params.amount,
    currency: params.currency,
    order_id: params.orderId,
    description: params.description,
    payer: params.payerName,
    payerEmail: params.payerEmail,
    successUrl: params.successUrl || `${baseUrl}/api/soleaspay/callback/success`,
    failureUrl: params.failureUrl || `${baseUrl}/api/soleaspay/callback/failure`,
  };

  console.log("[SoleAsPay] Initiating payment:", { orderId: params.orderId, amount: params.amount, service: serviceId });

  const response = await fetch(`${SOLEASPAY_BASE_URL}/api/agent/bills/v3`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data: SoleaspayPaymentResponse = await response.json();
  
  console.log("[SoleAsPay] Payment response:", { 
    success: data.success, 
    status: data.status, 
    reference: data.data?.reference,
    message: data.message,
    code: data.code,
    fullResponse: JSON.stringify(data)
  });
  
  return data;
}

export async function verifyPayment(orderId: string, payId: string): Promise<SoleaspayVerifyResponse> {
  const response = await fetch(
    `${SOLEASPAY_BASE_URL}/api/agent/verif-pay?orderId=${orderId}&payId=${payId}`,
    {
      method: "GET",
      headers: {
        "x-api-key": SOLEASPAY_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  const data: SoleaspayVerifyResponse = await response.json();
  
  console.log("[SoleAsPay] Verification response:", { success: data.success, status: data.status });
  
  return data;
}

export async function getTransactionDetails(reference: string): Promise<any> {
  const token = await getAuthToken();
  
  const response = await fetch(
    `${SOLEASPAY_BASE_URL}/api/user/history/${reference}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  );

  return response.json();
}

export function validateCallback(xPrivateKey: string): boolean {
  const crypto = require("crypto");
  const expectedHash = crypto
    .createHash("sha512")
    .update(SOLEASPAY_SECRET_KEY)
    .digest("hex");
  
  return xPrivateKey === expectedHash;
}

export interface CallbackPayload {
  success: boolean;
  status: "SUCCESS" | "RECEIVED" | "REFUND" | "FAILURE";
  created_at: string;
  data: {
    operation: string;
    reference: string;
    external_reference: string;
    transaction_reference: string;
    amount: string;
    currency: string;
  };
}
