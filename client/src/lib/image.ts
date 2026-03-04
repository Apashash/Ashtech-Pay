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
    
    // The user has a bucket named 'payment-links' as seen in the screenshot
    // We'll use that as the default public access point
    return `${supabaseUrl}/storage/v1/object/public/payment-links/${finalPath}`;
  }

  return pathOrUrl;
}
