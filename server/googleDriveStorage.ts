import crypto from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

type GoogleDriveUploadResult = {
  id: string;
  path: string;
  url: string;
};

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  const encodedJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const rawJson = encodedJson
    ? Buffer.from(encodedJson, "base64").toString("utf8").trim()
    : process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Partial<ServiceAccountCredentials>;
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch (error) {
      console.error("[GoogleDrive] GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is invalid:", error);
      return null;
    }
  }

  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim();
  if (!clientEmail || !privateKey) return null;
  return {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, "\n"),
  };
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() &&
    getServiceAccountCredentials(),
  );
}

export class GoogleDriveStorageError extends Error {
  constructor(
    public readonly code:
      | "GOOGLE_DRIVE_NOT_CONFIGURED"
      | "GOOGLE_DRIVE_TOKEN_FAILED"
      | "GOOGLE_DRIVE_UPLOAD_FAILED"
      | "GOOGLE_DRIVE_PERMISSION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "GoogleDriveStorageError";
  }
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    throw new GoogleDriveStorageError(
      "GOOGLE_DRIVE_NOT_CONFIGURED",
      "Google Drive n'est pas configuré sur ce serveur.",
    );
  }

  const issuedAt = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: DRIVE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsignedToken = `${header}.${payload}`;
  const signature = crypto.sign(
    "RSA-SHA256",
    Buffer.from(unsignedToken),
    credentials.private_key,
  );

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedToken}.${base64Url(signature)}`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("[GoogleDrive] Token request failed:", response.status, detail);
    throw new GoogleDriveStorageError(
      "GOOGLE_DRIVE_TOKEN_FAILED",
      "Google Drive n'a pas accepté l'authentification du serveur.",
    );
  }

  const token = await response.json() as { access_token?: string; expires_in?: number };
  if (!token.access_token) {
    throw new GoogleDriveStorageError(
      "GOOGLE_DRIVE_TOKEN_FAILED",
      "Google Drive n'a pas renvoyé de jeton d'accès.",
    );
  }
  tokenCache = {
    accessToken: token.access_token,
    expiresAt: now + Math.max(60, Number(token.expires_in || 3600)) * 1000,
  };
  return token.access_token;
}

function safeDriveFileName(filename: string): string {
  const clean = filename
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "payment-link-image.jpg";
}

export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<GoogleDriveUploadResult | null> {
  if (!isGoogleDriveConfigured()) return null;

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!.trim();
  const accessToken = await getAccessToken();
  const boundary = `ashtechpay_${crypto.randomBytes(12).toString("hex")}`;
  const metadata = JSON.stringify({
    name: `${Date.now()}-${safeDriveFileName(originalName)}`,
    parents: [folderId],
  });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadResponse = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    },
  );
  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text();
    console.error("[GoogleDrive] File upload failed:", uploadResponse.status, detail);
    throw new GoogleDriveStorageError(
      "GOOGLE_DRIVE_UPLOAD_FAILED",
      "Google Drive n'a pas pu enregistrer cette image.",
    );
  }

  const uploaded = await uploadResponse.json() as { id?: string };
  if (!uploaded.id) {
    throw new GoogleDriveStorageError(
      "GOOGLE_DRIVE_UPLOAD_FAILED",
      "Google Drive n'a pas renvoyé l'identifiant de l'image.",
    );
  }

  const permissionResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
  if (!permissionResponse.ok) {
    const detail = await permissionResponse.text();
    console.error("[GoogleDrive] Public permission failed:", permissionResponse.status, detail);
    throw new GoogleDriveStorageError(
      "GOOGLE_DRIVE_PERMISSION_FAILED",
      "Google Drive n'a pas pu rendre cette image publique.",
    );
  }

  const url = `https://drive.google.com/uc?export=view&id=${encodeURIComponent(uploaded.id)}`;
  return { id: uploaded.id, path: uploaded.id, url };
}