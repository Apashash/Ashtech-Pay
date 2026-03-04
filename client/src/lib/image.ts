export function getImageSrc(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (pathOrUrl.startsWith("/uploads/")) return pathOrUrl;
  
  // Solution 2: Direct Public URL from Supabase
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl && !pathOrUrl.startsWith("/")) {
    // We assume the bucket 'uploads' is set to public in Supabase dashboard
    return `${supabaseUrl}/storage/v1/object/public/uploads/${pathOrUrl}`;
  }

  return pathOrUrl;
}
