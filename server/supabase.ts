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
      console.log("Supabase client initialized successfully (using service role key)");
    } catch (error) {
      console.warn("[Supabase] Failed to initialize client:", error);
    }
  }
} else {
  console.warn("[Supabase] Credentials not configured or invalid. File uploads will use local storage.");
}

export { supabase };

export const STORAGE_BUCKET = "uploads";

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
  if (!supabase) return null;

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
    console.error("[Supabase] Download error:", error, "path:", cleanPath);
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
