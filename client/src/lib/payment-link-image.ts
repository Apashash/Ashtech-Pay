const MAX_PROXY_SAFE_IMAGE_BYTES = Math.floor(1.5 * 1024 * 1024);
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function preparePaymentLinkImage(file: File): Promise<File> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Format image non supporté. Utilisez une image JPG, PNG ou WEBP.");
  }

  if (file.size <= MAX_PROXY_SAFE_IMAGE_BYTES) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossible de lire cette image sur le téléphone."));
      image.src = objectUrl;
    });

    const maxDimension = 2400;
    const initialScale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
    let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
    const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];

    for (const quality of qualities) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Impossible de préparer cette image.");

      context.drawImage(image, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", quality);
      });

      if (blob && blob.size <= MAX_PROXY_SAFE_IMAGE_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "payment-link-image";
        return new File([blob], `${baseName}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }

      width = Math.max(900, Math.round(width * 0.82));
      height = Math.max(900, Math.round(height * 0.82));
    }

    throw new Error("Cette image est trop volumineuse pour être envoyée. Choisissez une image plus légère.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function getUploadErrorMessage(response: Response, fallback: string): Promise<string> {
  if (response.status === 413) {
    return "Image trop volumineuse. Choisissez une image plus légère.";
  }

  try {
    const body = await response.json() as { error?: string; message?: string };
    return body.error || body.message || fallback;
  } catch {
    return fallback;
  }
}