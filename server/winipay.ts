const WINIPAY_BASE_URL = "https://api-v2.winipayer.com";
const WINIPAY_MERCHANT_APPLY = process.env.WINIPAY_MERCHANT_APPLY || "";
const WINIPAY_MERCHANT_TOKEN = process.env.WINIPAY_MERCHANT_TOKEN || "";
const WINIPAY_ENV = process.env.WINIPAY_ENV || "test";

interface WinipayCheckoutResponse {
  success: boolean;
  results: {
    uuid: string;
    crypto: string;
    env: string;
    amount: number;
    currency: string;
    operator: string | null;
    operator_process: string | null;
    operator_message: string | null;
    checkout_process: string;
    expired_at: string;
  };
  errors: { code: number; key: string; msg: string } | [];
  messages: string[];
}

interface WinipayDetailResponse {
  success: boolean;
  results: {
    invoice: {
      uuid: string;
      crypto: string;
      env: string;
      state: "pending" | "success" | "failed" | "expired";
      state_date: string;
      amount_init: number;
      amount: number;
      client_pay_fee: boolean;
      commission_amount: number;
      commission_rate: number;
      amount_available: number;
      currency: string;
      operator: string;
      operator_ref: string;
      customer_pay: {
        name: string;
        phone: string;
        email: string | null;
      };
      created_at: string;
      expired_at: string;
    };
  };
  errors: { code: number; key: string; msg: string } | [];
  messages: string[];
}

interface WinipayPayoutResponse {
  uuid: string;
  crypto: string;
  merchant: { uuid: string; name: string };
  env: string;
  operator: string;
  currency: string;
  amount: number;
  commission_rate: number;
  commission_fee: number;
  commission_amount: number;
  amount_total: number;
  description: string;
  recipients: Array<{
    uuid: string;
    name: string;
    account: string;
    amount: number;
    commission_amount: number;
    amount_total: number;
    operator_ref: string | null;
    state: "waitting" | "processing" | "success" | "failed";
    state_at: string | null;
  }>;
  valide: boolean;
  valide_at: string;
}

const WINIPAY_OPERATOR_MAP: Record<string, Record<string, string>> = {
  "SN": {
    "Orange Money": "orange-senegal",
    "Wave": "wave-senegal",
    "Free Money": "free-money-senegal",
  },
  "ML": {
    "Orange Money": "orange-mali",
    "Moov Money": "moov-mali",
  },
  "BF": {
    "Orange Money": "orange-burkina-faso",
    "Moov Money": "moov-burkina-faso",
  },
  "NE": {
    "Airtel Money": "airtel-niger",
    "Orange Money": "orange-niger",
  },
  "GW": {
    "Orange Money": "orange-guinee-bissau",
  },
  "GN": {
    "Orange Money": "orange-guinee",
    "MTN Mobile Money": "mtn-guinee",
  },
  "GA": {
    "Airtel Money": "airtel-gabon",
    "Moov Money": "moov-gabon",
  },
  "CG": {
    "MTN Mobile Money": "mtn-congo",
    "Airtel Money": "airtel-congo",
  },
  "CD": {
    "Vodacom M-Pesa": "vodacom-mpesa-rdc",
    "Airtel Money": "airtel-rdc",
    "Orange Money": "orange-rdc",
  },
  "KE": {
    "M-Pesa": "mpesa-kenya",
  },
  "RW": {
    "MTN Mobile Money": "mtn-rwanda",
    "Airtel Money": "airtel-rwanda",
  },
  "UG": {
    "MTN Mobile Money": "mtn-uganda",
    "Airtel Money": "airtel-uganda",
  },
  "TZ": {
    "M-Pesa": "mpesa-tanzania",
    "Airtel Money": "airtel-tanzania",
    "Tigo Pesa": "tigo-tanzania",
  },
  "GH": {
    "MTN Mobile Money": "mtn-ghana",
    "Vodafone Cash": "vodafone-ghana",
    "AirtelTigo Money": "airteltigo-ghana",
  },
  "NG": {
    "OPay": "opay-nigeria",
    "PalmPay": "palmpay-nigeria",
  },
};

export function getWinipayOperator(operatorName: string, countryCode: string): string | null {
  const countryOperators = WINIPAY_OPERATOR_MAP[countryCode];
  if (!countryOperators) return null;
  
  for (const [key, value] of Object.entries(countryOperators)) {
    if (operatorName.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(operatorName.toLowerCase())) {
      return value;
    }
  }
  
  return null;
}

export function isWinipayOperatorSupported(operatorName: string, countryCode: string): boolean {
  return getWinipayOperator(operatorName, countryCode) !== null;
}

export function getWinipaySupportedCountries(): string[] {
  return Object.keys(WINIPAY_OPERATOR_MAP);
}

export interface WinipayCollectParams {
  amount: number;
  description: string;
  orderId: string;
  customData?: Record<string, any>;
  operatorName?: string;
  countryCode?: string;
  phoneNumber?: string;
  cancelUrl?: string;
  returnUrl?: string;
  callbackUrl?: string;
}

export async function createWinipayCheckout(params: WinipayCollectParams): Promise<WinipayCheckoutResponse> {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://localhost:5000";

  const formData = new FormData();
  formData.append("env", WINIPAY_ENV);
  formData.append("amount", params.amount.toString());
  formData.append("description", params.description);
  formData.append("custom_data", JSON.stringify({ order_id: params.orderId, ...params.customData }));
  formData.append("client_pay_fee", "false");
  formData.append("cancel_url", params.cancelUrl || `${baseUrl}/dashboard`);
  formData.append("return_url", params.returnUrl || `${baseUrl}/dashboard`);
  formData.append("callback_url", params.callbackUrl || `${baseUrl}/api/winipay/callback`);

  if (params.operatorName && params.countryCode) {
    const operator = getWinipayOperator(params.operatorName, params.countryCode);
    if (operator) {
      formData.append("operator", operator);
      if (params.phoneNumber) {
        formData.append("operator_input", JSON.stringify({ phone: params.phoneNumber }));
      }
    }
  }

  console.log("[WiniPay] Creating checkout:", { 
    orderId: params.orderId, 
    amount: params.amount,
    operator: params.operatorName,
    country: params.countryCode
  });

  try {
    const response = await fetch(`${WINIPAY_BASE_URL}/checkout/standard/create`, {
      method: "POST",
      headers: {
        "X-Merchant-Apply": WINIPAY_MERCHANT_APPLY,
        "X-Merchant-Token": WINIPAY_MERCHANT_TOKEN,
      },
      body: formData,
    });

    const data: WinipayCheckoutResponse = await response.json();
    
    console.log("[WiniPay] Checkout response:", { 
      success: data.success, 
      uuid: data.results?.uuid,
      checkout_url: data.results?.checkout_process,
      errors: data.errors
    });
    
    return data;
  } catch (error) {
    console.error("[WiniPay] Checkout error:", error);
    return {
      success: false,
      results: {
        uuid: "",
        crypto: "",
        env: WINIPAY_ENV,
        amount: params.amount,
        currency: "xof",
        operator: null,
        operator_process: null,
        operator_message: null,
        checkout_process: "",
        expired_at: "",
      },
      errors: { code: 5000, key: "network", msg: "Erreur de connexion à WiniPay" },
      messages: [],
    };
  }
}

export async function getWinipayInvoiceDetail(uuid: string): Promise<WinipayDetailResponse> {
  console.log("[WiniPay] Getting invoice detail:", uuid);

  try {
    const formData = new FormData();
    formData.append("env", WINIPAY_ENV);

    const response = await fetch(`${WINIPAY_BASE_URL}/checkout/standard/detail/${uuid}`, {
      method: "POST",
      headers: {
        "X-Merchant-Apply": WINIPAY_MERCHANT_APPLY,
        "X-Merchant-Token": WINIPAY_MERCHANT_TOKEN,
      },
      body: formData,
    });

    const data: WinipayDetailResponse = await response.json();
    
    console.log("[WiniPay] Invoice detail:", { 
      success: data.success, 
      state: data.results?.invoice?.state 
    });
    
    return data;
  } catch (error) {
    console.error("[WiniPay] Get invoice error:", error);
    throw error;
  }
}

export interface WinipayPayoutParams {
  operatorName: string;
  countryCode: string;
  recipientName: string;
  recipientPhone: string;
  amount: number;
  description?: string;
  customData?: Record<string, any>;
  callbackUrl?: string;
}

export async function createWinipayPayout(params: WinipayPayoutParams): Promise<WinipayPayoutResponse | { success: false; error: string }> {
  const operator = getWinipayOperator(params.operatorName, params.countryCode);
  
  if (!operator) {
    console.log("[WiniPay] Payout operator not supported:", params.operatorName, params.countryCode);
    return { success: false, error: `Opérateur ${params.operatorName} non supporté pour WiniPay` };
  }

  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://localhost:5000";

  const formData = new FormData();
  formData.append("env", WINIPAY_ENV);
  formData.append("operator", operator);
  formData.append("description", params.description || "Retrait Ashtech Pay");
  
  if (params.customData) {
    formData.append("custom_data", JSON.stringify(params.customData));
  }
  
  if (params.callbackUrl) {
    formData.append("callback_url", params.callbackUrl);
  } else {
    formData.append("callback_url", `${baseUrl}/api/winipay/payout/callback`);
  }

  const recipients = [{
    name: params.recipientName,
    account: params.recipientPhone,
    amount: params.amount,
  }];
  formData.append("recipients", JSON.stringify(recipients));

  console.log("[WiniPay] Creating payout:", { 
    operator,
    recipient: params.recipientPhone,
    amount: params.amount
  });

  try {
    const response = await fetch(`${WINIPAY_BASE_URL}/payout/standard/create`, {
      method: "POST",
      headers: {
        "X-Merchant-Apply": WINIPAY_MERCHANT_APPLY,
        "X-Merchant-Token": WINIPAY_MERCHANT_TOKEN,
      },
      body: formData,
    });

    const data = await response.json();
    
    console.log("[WiniPay] Payout response:", { 
      uuid: data.uuid,
      valide: data.valide,
      recipients: data.recipients?.length
    });
    
    return data;
  } catch (error) {
    console.error("[WiniPay] Payout error:", error);
    return { success: false, error: "Erreur de connexion à WiniPay" };
  }
}

export interface WinipayCallbackPayload {
  uuid: string;
  crypto: string;
  env: string;
  state: "pending" | "success" | "failed" | "expired";
  amount: number;
  currency: string;
  operator: string;
  operator_ref: string;
  custom_data: Record<string, any>;
}

export function validateWinipayCallback(payload: WinipayCallbackPayload): boolean {
  return !!(payload.uuid && payload.state && payload.amount);
}
