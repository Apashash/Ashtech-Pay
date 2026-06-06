import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

if (supabaseUrl && isValidUrl(supabaseUrl)) {
  if (!supabaseServiceRoleKey) {
    console.warn(
      "[Supabase] SUPABASE_SERVICE_ROLE_KEY not set. File uploads will fall back to local storage. " +
      "Do NOT use the anon key for server-side operations."
    );
  } else {
    try {
      supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      console.log("[Supabase] Client initialized successfully (service role key)");
      console.log(`[Supabase] URL: ${supabaseUrl}`);
      console.log(`[Supabase] Storage bucket: ${process.env.SUPABASE_STORAGE_BUCKET || "uploads"}`);
    } catch (error) {
      console.warn("[Supabase] Failed to initialize client:", error);
    }
  }
} else {
  if (!supabaseUrl) {
    console.warn("[Supabase] SUPABASE_URL not set. File uploads will use local storage.");
  } else {
    console.warn(`[Supabase] SUPABASE_URL invalid: "${supabaseUrl}". Must be https://xxx.supabase.co`);
  }
}

export { supabase };

// Bucket name: override with SUPABASE_STORAGE_BUCKET env var if your bucket has a different name
export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";

export async function uploadToSupabase(
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  folder: string = "payment-links"
): Promise<{ url: string; path: string } | null> {
  if (!supabase) return null;

  const filePath = `${folder}/${Date.now()}-${filename}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
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
  if (!supabase) {
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

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(cleanPath);

  if (error || !data) {
    console.error(`[Supabase] Download error — bucket="${STORAGE_BUCKET}" path="${cleanPath}":`, error?.message || "no data");
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
  if (!supabase) return null;

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

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
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
  if (!supabase) return null;
  const { data, error } = await supabase.storage.listBuckets();
  if (error || !data) return null;
  return data.map(b => ({ name: b.name, public: b.public }));
}

/**
 * Test-download a single file from a given bucket+path — used by admin debug endpoint.
 */
export async function testDownload(bucket: string, filePath: string): Promise<{ ok: boolean; error?: string; size?: number }> {
  if (!supabase) return { ok: false, error: "Supabase client not initialized" };
  const { data, error } = await supabase.storage.from(bucket).download(filePath);
  if (error || !data) return { ok: false, error: error?.message || "no data" };
  const buf = await data.arrayBuffer();
  return { ok: true, size: buf.byteLength };
}
