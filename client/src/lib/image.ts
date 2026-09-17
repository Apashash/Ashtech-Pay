import { getAuthHeaders } from "./queryClient";

export function getImageSrc(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (pathOrUrl.startsWith("/uploads/") || pathOrUrl.startsWith("/imagepro/")) return pathOrUrl;
  if (pathOrUrl.startsWith("private-kyc/") || pathOrUrl.startsWith("kyc/")) {
    return `/api/image-proxy?path=${encodeURIComponent(pathOrUrl)}`;
  }

  // For Supabase storage paths (e.g. "payment-links/xxx.jpg")
  // Use /api/img (no auth required) — redirects to Supabase public CDN URL.
  return `/api/img?path=${encodeURIComponent(pathOrUrl)}`;
}

/**
 * Load a protected image/PDF through fetch so the Bearer token from
 * localStorage is sent. An <img> or <a> opened in a new tab cannot add that
 * Authorization header by itself.
 */
export async function fetchImageBlobUrl(pathOrUrl: string): Promise<string> {
  const source = getImageSrc(pathOrUrl);
  const response = await fetch(source, {
    credentials: "include",
    headers: source.startsWith("/") ? getAuthHeaders() : undefined,
  });
  if (!response.ok) {
    throw new Error(`DOCUMENT_FETCH_FAILED_${response.status}`);
  }
  return URL.createObjectURL(await response.blob());
}
