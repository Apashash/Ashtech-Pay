import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Token storage for authentication (workaround for blocked cookies in iframes)
const AUTH_TOKEN_KEY = 'ashtech_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    try {
      const json = JSON.parse(text);
      if (json.vpnDetected && res.status === 403) {
        removeAuthToken();
        window.dispatchEvent(new CustomEvent("vpn-disconnect", { detail: { message: json.message } }));
      }
      if (json.sessionRevoked && res.status === 401) {
        removeAuthToken();
        window.dispatchEvent(new CustomEvent("force-logout", { detail: { retryAfter: json.retryAfter } }));
      }
      if (json.ipBlocked && res.status === 403) {
        removeAuthToken();
        window.dispatchEvent(new CustomEvent("admin-ip-blocked", { detail: { message: json.message } }));
        window.location.href = "/login?kicked=ip";
      }
      throw Object.assign(new Error(json.message || text), json);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(text);
      }
      throw e;
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (res.status === 401) {
      try {
        const body = await res.clone().json();
        if (body.sessionRevoked) {
          removeAuthToken();
          window.dispatchEvent(new CustomEvent("force-logout", { detail: { retryAfter: body.retryAfter } }));
        }
      } catch {}
      if (unauthorizedBehavior === "returnNull") return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
