import { createClient, SupabaseClient } from "@supabase/supabase-js";

export let supabase: SupabaseClient | null = null;

export type SupabaseConfigurationIssue =
  | "SUPABASE_URL_MISSING"
  | "SUPABASE_URL_INVALID"
  | "SUPABASE_SERVICE_ROLE_KEY_MISSING";

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getSupabaseConfigurationIssue(): SupabaseConfigurationIssue | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) return "SUPABASE_URL_MISSING";
  if (!isValidUrl(supabaseUrl)) return "SUPABASE_URL_INVALID";
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY_MISSING";
  }
  return null;
}

export function getSupabaseClient(): SupabaseClient | null {
  // Only cache a successfully initialized client. Passenger/Plesk can expose
  // environment variables after the first request during a cold bootstrap;
  // caching a missing/invalid configuration would make that first transient
  // failure permanent until the process is restarted.
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const configurationIssue = getSupabaseConfigurationIssue();

  if (configurationIssue === "SUPABASE_URL_MISSING") {
    console.warn("[Supabase] SUPABASE_URL is missing.");
    return null;
  }
  if (configurationIssue === "SUPABASE_URL_INVALID") {
    console.warn(`[Supabase] SUPABASE_URL is invalid: "${supabaseUrl}". Expected https://xxx.supabase.co`);
    return null;
  }
  if (configurationIssue === "SUPABASE_SERVICE_ROLE_KEY_MISSING") {
    console.warn("[Supabase] SUPABASE_SERVICE_ROLE_KEY is missing. Do not use the anon key for server-side uploads.");
    return null;
  }
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  try {
    supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("[Supabase] Client initialized successfully (service role key)");
    console.log(`[Supabase] URL: ${supabaseUrl}`);
    console.log(`[Supabase] Storage bucket: ${getStorageBucket()}`);
  } catch (error) {
    console.warn("[Supabase] Failed to initialize client:", error);
  }
  return supabase;
}

// Bucket name: override with SUPABASE_STORAGE_BUCKET env var if your bucket has a different name
export function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || "uploads";
}

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(getSupabaseClient());
}

export async function uploadToSupabase(
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  folder: string = "payment-links"
): Promise<{ url: string; path: string } | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const filePath = `${folder}/${Date.now()}-${filename}`;

  const { data, error } = await client.storage
    .from(getStorageBucket())
    .upload(filePath, fileBuffer, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    console.error("[Supabase] Upload error:", error);
    return null;
  }

  return {
    url: data.path,
    path: data.path,
  };
}

export async function downloadFromSupabase(
  storagePath: string
): Promise<{ data: Blob; contentType: string } | null> {
  const client = getSupabaseClient();
  if (!client) {
    console.error("[Supabase] downloadFromSupabase called but client is null (check SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
    return null;
  }

  let cleanPath = storagePath;

  if (storagePath.startsWith("http")) {
    const match = storagePath.match(
      /\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/
    );
    if (match) {
      cleanPath = decodeURIComponent(match[1]);
    } else {
      return null;
    }
  }

  const { data, error } = await client.storage
    .from(getStorageBucket())
    .download(cleanPath);

  if (error || !data) {
    console.error(`[Supabase] Download error — bucket="${getStorageBucket()}" path="${cleanPath}":`, error?.message || "no data");
    return null;
  }

  const ext = cleanPath.split(".").pop()?.toLowerCase() ?? "";
  const contentTypeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
  };
  const contentType = contentTypeMap[ext] ?? data.type ?? "application/octet-stream";

  return { data, contentType };
}

export async function getSignedImageUrl(
  storagePath: string,
  expiresIn = 86400
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  let cleanPath = storagePath;

  if (storagePath.startsWith("http")) {
    const match = storagePath.match(
      /\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/
    );
    if (match) {
      cleanPath = decodeURIComponent(match[1]);
    } else {
      return storagePath;
    }
  }

  const { data, error } = await client.storage
    .from(getStorageBucket())
    .createSignedUrl(cleanPath, expiresIn);

  if (error || !data) {
    console.error("[Supabase] Signed URL error:", error, "path:", cleanPath);
    return null;
  }
  return data.signedUrl;
}

/**
 * Lists all available buckets — used by the admin debug endpoint.
 */
export async function listSupabaseBuckets(): Promise<{ name: string; public: boolean }[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.storage.listBuckets();
  if (error || !data) return null;
  return data.map(b => ({ name: b.name, public: b.public }));
}

/**
 * Test-download a single file from a given bucket+path — used by admin debug endpoint.
 */
export async function testDownload(bucket: string, filePath: string): Promise<{ ok: boolean; error?: string; size?: number }> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Supabase client not initialized" };
  const { data, error } = await client.storage.from(bucket).download(filePath);
  if (error || !data) return { ok: false, error: error?.message || "no data" };
  const buf = await data.arrayBuffer();
  return { ok: true, size: buf.byteLength };
}
