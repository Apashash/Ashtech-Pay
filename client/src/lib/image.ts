export function getImageSrc(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  
  let cleanPath = pathOrUrl;
  if (pathOrUrl.startsWith("/uploads/")) {
    cleanPath = pathOrUrl.replace("/uploads/", "");
  }
  
  // Solution 2: Direct Public URL from Supabase
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    // We assume the bucket 'uploads' is set to public in Supabase dashboard
    return `${supabaseUrl}/storage/v1/object/public/uploads/${cleanPath}`;
  }

  return pathOrUrl;
}
