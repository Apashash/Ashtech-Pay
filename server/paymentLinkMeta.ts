import type { Request } from "express";
import { storage } from "./storage";

type PaymentLinkMeta = {
  title: string;
  description?: string | null;
  imagePath?: string | null;
  slug: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPublicBaseUrl(req: Request): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const protocol = forwardedProto || req.protocol || "https";
  return `${protocol}://${req.get("host") || "ashtechpay.top"}`;
}

function getPublicImageUrl(imagePath: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  if (imagePath.startsWith("/")) return `${baseUrl}${imagePath}`;
  return `${baseUrl}/api/img?path=${encodeURIComponent(imagePath)}`;
}

function getImageMimeType(imagePath: string): string {
  const cleanPath = imagePath.split("?")[0].toLowerCase();
  if (cleanPath.endsWith(".png")) return "image/png";
  if (cleanPath.endsWith(".webp")) return "image/webp";
  if (cleanPath.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function renderPaymentLinkMeta(
  req: Request,
  html: string,
  slug: string,
): Promise<string> {
  const link = await storage.getPaymentLinkBySlug(slug) as PaymentLinkMeta | undefined;
  if (!link || !link.title) return html;

  const baseUrl = getPublicBaseUrl(req);
  const pageUrl = `${baseUrl}/pay/${encodeURIComponent(link.slug)}`;
  const title = link.title.trim();
  const shareTitle = `Achetez ${title} en toute sécurité — AshTech Pay`;
  const description = "AshTech Pay, la meilleure passerelle de paiement pour vendre vos produits partout en toute sécurité.";
  const escapedTitle = escapeHtml(shareTitle);
  const escapedDescription = escapeHtml(description);
  const escapedPageUrl = escapeHtml(pageUrl);

  let result = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapedTitle}</title>`)
    .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapedDescription}" />`)
    .replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapedTitle}" />`)
    .replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapedDescription}" />`)
    .replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${escapedPageUrl}" />`)
    .replace(/<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapedTitle}" />`)
    .replace(/<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapedDescription}" />`);

  if (link.imagePath) {
    const imageUrl = escapeHtml(getPublicImageUrl(link.imagePath, baseUrl));
    result = result
      .replace(/<meta property="og:image"[^>]*>/i, `<meta property="og:image" content="${imageUrl}" />`)
      .replace(/<meta property="og:image:secure_url"[^>]*>/i, `<meta property="og:image:secure_url" content="${imageUrl}" />`)
      .replace(/<meta property="og:image:type"[^>]*>/i, `<meta property="og:image:type" content="${getImageMimeType(link.imagePath)}" />`)
      .replace(/<meta property="og:image:width"[^>]*>/i, `<meta property="og:image:width" content="1200" />`)
      .replace(/<meta property="og:image:height"[^>]*>/i, `<meta property="og:image:height" content="630" />`)
      .replace(/<meta property="og:image:alt"[^>]*>/i, `<meta property="og:image:alt" content="${escapedTitle}" />`)
      .replace(/<meta name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${imageUrl}" />`)
      .replace(/<meta name="twitter:image:alt"[^>]*>/i, `<meta name="twitter:image:alt" content="${escapedTitle}" />`)
      .replace(/<meta name="twitter:card"[^>]*>/i, '<meta name="twitter:card" content="summary_large_image" />');
  }

  return result;
}