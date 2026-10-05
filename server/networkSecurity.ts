import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import ipaddr from "ipaddr.js";

const PRIVATE_IPV4_RANGES = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
].map((range) => ipaddr.IPv4.parseCIDR(range));

const PRIVATE_IPV6_RANGES = [
  "::/128",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
  "2001:db8::/32",
  "2001:10::/28",
].map((range) => ipaddr.IPv6.parseCIDR(range));

export function isPrivateOrReservedIp(value: string): boolean {
  const ip = value.trim().replace(/^\[|\]$/g, "");
  const family = net.isIP(ip);
  if (family === 4) {
    const address = ipaddr.IPv4.parse(ip);
    return PRIVATE_IPV4_RANGES.some((range) => address.match(range));
  }
  if (family === 6) {
    const address = ipaddr.IPv6.parse(ip);
    if (PRIVATE_IPV6_RANGES.some((range) => address.match(range))) return true;
    if (address.isIPv4MappedAddress()) return isPrivateOrReservedIp(address.toIPv4Address().toString());
  }
  return false;
}

function isSafeWebhookUrlShape(rawUrl: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !parsed.hostname ||
    parsed.hostname.endsWith(".") ||
    parsed.hostname === "localhost" ||
    parsed.hostname.endsWith(".localhost")
  ) {
    return null;
  }
  return parsed;
}

async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: 4 | 6 } | null> {
  if (net.isIP(hostname)) {
    const family = net.isIP(hostname) as 4 | 6;
    return isPrivateOrReservedIp(hostname) ? null : { address: hostname, family };
  }

  // Single-label names are commonly internal service names, not public webhook
  // destinations. Requiring a dotted hostname also avoids ambiguous resolver
  // behavior for deployment-local names.
  if (!hostname.includes(".")) return null;

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  // Reject mixed public/private answers instead of choosing only a public
  // address. Otherwise a hostname could still target an internal address for
  // consumers that resolve it differently.
  if (!records.length || records.some((record) => isPrivateOrReservedIp(record.address))) return null;
  const publicRecord = records[0];
  return {
    address: publicRecord.address,
    family: publicRecord.family as 4 | 6,
  };
}

export async function isSafeWebhookDestination(rawUrl: unknown): Promise<boolean> {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return false;
  const parsed = isSafeWebhookUrlShape(rawUrl.trim());
  if (!parsed) return false;
  try {
    return (await resolvePublicAddress(parsed.hostname)) !== null;
  } catch {
    return false;
  }
}

export async function postJsonToSafeWebhook(
  rawUrl: string,
  headers: Record<string, string>,
  body: string,
  signal: AbortSignal,
): Promise<{ status: number; ok: boolean }> {
  const parsed = isSafeWebhookUrlShape(rawUrl);
  if (!parsed) throw new Error("unsafe webhook URL");

  const resolved = await resolvePublicAddress(parsed.hostname);
  if (!resolved) throw new Error("webhook hostname resolves to a private or reserved address");

  return new Promise((resolve, reject) => {
    const request = https.request(parsed, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(body).toString(),
      },
      // Pin the validated DNS answer for this request to prevent a DNS
      // rebinding between validation and socket creation.
      lookup: (_hostname, _options, callback) => {
        callback(null, resolved.address, resolved.family);
      },
      servername: parsed.hostname,
    }, (response) => {
      response.resume();
      resolve({
        status: response.statusCode ?? 0,
        ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
      });
    });

    const abort = () => request.destroy(new Error("webhook request aborted"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    request.once("error", reject);
    request.once("close", () => signal.removeEventListener("abort", abort));
    request.end(body);
  });
}
