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
  contentType: string
): Promise<{ url: string; path: string } | null> {
  if (!supabase) {
    return null;
  }

  const filePath = `payment-links/${Date.now()}-${filename}`;

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

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path,
  };
}
