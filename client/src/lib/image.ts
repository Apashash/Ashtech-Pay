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
    let finalPath = cleanPath;
    while (finalPath.startsWith('/')) {
      finalPath = finalPath.substring(1);
    }
    
    // The bucket is 'uploads', and the path already includes 'payment-links/' as seen in the database
    return `${supabaseUrl}/storage/v1/object/public/uploads/${finalPath}`;
  }

  return pathOrUrl;
}
