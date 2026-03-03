import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

if (supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl)) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("Supabase client initialized successfully");
  } catch (error) {
    console.warn("Failed to initialize Supabase client:", error);
  }
} else {
  console.warn("Supabase credentials not configured or invalid. File uploads will use local storage.");
}

export { supabase };

export const STORAGE_BUCKET = "uploads";

export async function uploadToSupabase(
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  folder: string = "payment-links"
): Promise<{ url: string; path: string } | null> {
  if (!supabase) {
    return null;
  }

  const filePath = `${folder}/${Date.now()}-${filename}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    return null;
  }

  return {
    url: data.path,
    path: data.path,
  };
}

export async function getSignedImageUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  if (!supabase) return null;

  let cleanPath = storagePath;
  if (storagePath.includes("/storage/v1/object/")) {
    const match = storagePath.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
    if (match) cleanPath = decodeURIComponent(match[1]);
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(cleanPath, expiresIn);

  if (error || !data) {
    console.error("Supabase signed URL error:", error);
    return null;
  }
  return data.signedUrl;
}
