import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { jsPDF } from "jspdf";
import sharp from "sharp";
import { eq, like } from "drizzle-orm";
import { appPath } from "./appPaths";
import { db } from "./db";
import { kycDocuments } from "@shared/schema-runtime";
import { decryptField, encryptField, isFieldEncryptionConfigured } from "./fieldEncryption";
import { ensureMysqlKycDocumentsSchema } from "./mysqlBootstrap";
import { downloadFromSupabase } from "./supabase";

const PRIVATE_PREFIX = "private-kyc/";
const TEMP_PREFIX = `${PRIVATE_PREFIX}inbox/`;
const DATABASE_PREFIX = `${PRIVATE_PREFIX}db/`;
const DATABASE_TEMP_PREFIX = `${DATABASE_PREFIX}inbox/`;

type SourceFile = {
  path: string;
  fallbackExtension: string;
};

export type PrivateKycDocumentBundle = {
  folderPath: string;
  frontPath: string;
  backPath: string;
  selfiePath: string;
  summaryPdfPath: string;
};

export type KycDocumentBundleInput = {
  userId: string;
  fullName: string;
  email: string;
  documentType: string;
  documentNumber: string;
  country?: string | null;
  city?: string | null;
  postalCode?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  businessType: string;
  businessCategory: string;
  businessDescription: string;
  documentFrontPath: string;
  documentBackPath: string;
  selfiePath: string;
};

function getPrivateDocumentsRoot(): string {
  const configured = process.env.PRIVATE_DOCUMENTS_ROOT?.trim();
  // Plesk installations differ: the app may live directly in the domain
  // directory or inside its httpdocs webroot. In both cases keep documents
  // outside the actual public directory.
  const applicationRoot = appPath();
  const isHttpdocsRoot = path.basename(applicationRoot).toLowerCase() === "httpdocs";
  const defaultRoot = process.env.NODE_ENV === "production" && isHttpdocsRoot
    ? path.resolve(applicationRoot, "..", "private-documents")
    : path.resolve(applicationRoot, "private-documents");
  return path.resolve(configured || defaultRoot);
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeSegment(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return normalized || fallback;
}

function safePrivateRelativePath(storagePath: string): string {
  if (!storagePath.startsWith(PRIVATE_PREFIX) || storagePath.includes("..") || storagePath.includes("\0")) {
    throw new Error("INVALID_PRIVATE_DOCUMENT_PATH");
  }
  const relative = storagePath.slice(PRIVATE_PREFIX.length);
  if (!relative || path.isAbsolute(relative)) throw new Error("INVALID_PRIVATE_DOCUMENT_PATH");
  const absolute = path.resolve(getPrivateDocumentsRoot(), relative);
  if (!isInside(getPrivateDocumentsRoot(), absolute)) throw new Error("INVALID_PRIVATE_DOCUMENT_PATH");
  return relative;
}

export function getPrivateDocumentAbsolutePath(storagePath: string): string {
  return path.join(getPrivateDocumentsRoot(), safePrivateRelativePath(storagePath));
}

export async function readPrivateKycDocument(storagePath: string): Promise<Buffer> {
  const document = await readPrivateDocumentRecord(storagePath);
  return document.buffer;
}

async function readPrivateDocumentRecord(storagePath: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (storagePath.startsWith(DATABASE_PREFIX)) {
    if (!isFieldEncryptionConfigured()) {
      throw new Error("KYC_ENCRYPTION_NOT_CONFIGURED");
    }
    const [row] = await db
      .select({
        encryptedData: kycDocuments.encryptedData,
        contentType: kycDocuments.contentType,
      })
      .from(kycDocuments)
      .where(eq(kycDocuments.storagePath, storagePath))
      .limit(1);
    if (!row) throw new Error("KYC_DOCUMENT_NOT_FOUND");
    const base64 = decryptField(row.encryptedData);
    if (!base64) throw new Error("KYC_DOCUMENT_DECRYPT_FAILED");
    return { buffer: Buffer.from(base64, "base64"), contentType: row.contentType };
  }

  return {
    buffer: await fs.readFile(getPrivateDocumentAbsolutePath(storagePath)),
    contentType: contentTypeFromPath(storagePath),
  };
}

async function readUploadedSource(storagePath: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (storagePath.startsWith(PRIVATE_PREFIX)) {
    return readPrivateDocumentRecord(storagePath);
  }

  if (storagePath.startsWith("/uploads/")) {
    const absolute = path.resolve(appPath(storagePath.slice(1)));
    if (!isInside(appPath("uploads"), absolute)) throw new Error("INVALID_UPLOAD_PATH");
    return {
      buffer: await fs.readFile(absolute),
      contentType: contentTypeFromPath(storagePath),
    };
  }

  const remote = await downloadFromSupabase(storagePath);
  if (!remote) throw new Error("KYC_SOURCE_FILE_NOT_FOUND");
  return {
    buffer: Buffer.from(await remote.data.arrayBuffer()),
    contentType: remote.contentType,
  };
}

function contentTypeFromPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

function extensionFromContentType(contentType: string, sourcePath: string): string {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/jpeg") return ".jpg";
  const sourceExtension = path.extname(sourcePath).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(sourceExtension) ? sourceExtension : ".jpg";
}

function imageDataUri(buffer: Buffer, contentType: string): string {
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function addPdfField(pdf: jsPDF, label: string, value: unknown, y: number): number {
  const safeValue = String(value ?? "").trim() || "Non renseigné";
  pdf.setFont("helvetica", "bold");
  pdf.text(`${label} :`, 18, y);
  pdf.setFont("helvetica", "normal");
  const lines = pdf.splitTextToSize(safeValue, 136) as string[];
  pdf.text(lines, 55, y);
  return y + Math.max(7, lines.length * 5);
}

function addPdfImage(pdf: jsPDF, title: string, buffer: Buffer, contentType: string): void {
  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(title, 18, 20);

  const dataUri = imageDataUri(buffer, contentType);
  const format = contentType === "image/png" ? "PNG" : "JPEG";
  const properties = pdf.getImageProperties(dataUri);
  const maxWidth = 174;
  const maxHeight = 245;
  const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height);
  const width = properties.width * ratio;
  const height = properties.height * ratio;
  pdf.addImage(dataUri, format, (210 - width) / 2, 30, width, height, undefined, "MEDIUM");
}

async function preparePdfImage(file: { buffer: Buffer; contentType: string }): Promise<{ buffer: Buffer; contentType: string }> {
  if (file.contentType === "image/jpeg" || file.contentType === "image/png") {
    return file;
  }
  return {
    buffer: await sharp(file.buffer).jpeg({ quality: 90 }).toBuffer(),
    contentType: "image/jpeg",
  };
}

async function createSummaryPdf(
  input: KycDocumentBundleInput,
  files: { front: { buffer: Buffer; contentType: string }; back: { buffer: Buffer; contentType: string }; selfie: { buffer: Buffer; contentType: string } },
): Promise<Buffer> {
  const pdfFiles = {
    front: await preparePdfImage(files.front),
    back: await preparePdfImage(files.back),
    selfie: await preparePdfImage(files.selfie),
  };
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Dossier de vérification KYC", 18, 22);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Généré le ${new Date().toISOString()}`, 18, 29);

  let y = 44;
  y = addPdfField(pdf, "Nom complet", input.fullName, y);
  y = addPdfField(pdf, "Email", input.email, y);
  y = addPdfField(pdf, "Type de document", input.documentType, y);
  y = addPdfField(pdf, "Numéro du document", input.documentNumber, y);
  y = addPdfField(pdf, "Pays", input.country, y);
  y = addPdfField(pdf, "Ville", input.city, y);
  y = addPdfField(pdf, "Lieu-dit / code postal", input.postalCode, y);
  y = addPdfField(pdf, "Latitude", input.latitude, y);
  y = addPdfField(pdf, "Longitude", input.longitude, y);
  y = addPdfField(pdf, "Type d'activité", input.businessType, y);
  y = addPdfField(pdf, "Catégorie", input.businessCategory, y);
  pdf.setFont("helvetica", "bold");
  pdf.text("Description de l'activité :", 18, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(pdf.splitTextToSize(input.businessDescription || "Non renseigné", 174), 18, y + 6);

  addPdfImage(pdf, "Document — Recto", pdfFiles.front.buffer, pdfFiles.front.contentType);
  addPdfImage(pdf, "Document — Verso", pdfFiles.back.buffer, pdfFiles.back.contentType);
  addPdfImage(pdf, "Selfie avec document", pdfFiles.selfie.buffer, pdfFiles.selfie.contentType);

  return Buffer.from(pdf.output("arraybuffer"));
}

async function saveDatabaseDocument(
  userId: string,
  storagePath: string,
  buffer: Buffer,
  contentType: string,
  originalName: string,
): Promise<void> {
  if (!isFieldEncryptionConfigured()) {
    const error = new Error("KYC_ENCRYPTION_NOT_CONFIGURED");
    (error as NodeJS.ErrnoException).code = "KYC_ENCRYPTION_NOT_CONFIGURED";
    throw error;
  }
  await ensureMysqlKycDocumentsSchema();
  const encryptedData = encryptField(buffer.toString("base64"));
  if (!encryptedData) {
    const error = new Error("KYC_ENCRYPTION_FAILED");
    (error as NodeJS.ErrnoException).code = "KYC_ENCRYPTION_FAILED";
    throw error;
  }
  await db.insert(kycDocuments).values({
    id: crypto.randomUUID(),
    userId,
    storagePath,
    contentType,
    originalName,
    encryptedData,
    createdAt: new Date(),
  } as any);
}

export async function savePrivateKycUpload(userId: string, originalPath: string, buffer: Buffer, contentType: string): Promise<string> {
  const extension = extensionFromContentType(contentType, originalPath);
  const userFolder = safeSegment(userId, "user");
  const storagePath = `${DATABASE_PREFIX}inbox/${userFolder}/${crypto.randomUUID()}${extension}`;
  await saveDatabaseDocument(userId, storagePath, buffer, contentType, originalPath);
  return storagePath;
}

export async function removePrivateKycUpload(storagePath: string): Promise<void> {
  if (!storagePath.startsWith(TEMP_PREFIX) && !storagePath.startsWith(DATABASE_TEMP_PREFIX)) return;
  try {
    if (storagePath.startsWith(DATABASE_PREFIX)) {
      await db.delete(kycDocuments).where(eq(kycDocuments.storagePath, storagePath));
      return;
    }
    await fs.rm(getPrivateDocumentAbsolutePath(storagePath), { force: true });
  } catch (error) {
    console.error("[KYC private documents] Temporary upload cleanup failed:", error);
  }
}

export async function removePrivateKycBundle(bundle: Partial<PrivateKycDocumentBundle>): Promise<void> {
  if (!bundle.folderPath) return;
  try {
    if (bundle.folderPath.startsWith(DATABASE_PREFIX)) {
      await db.delete(kycDocuments).where(like(kycDocuments.storagePath, `${bundle.folderPath}/%`));
      return;
    }
    const folder = getPrivateDocumentAbsolutePath(bundle.folderPath);
    await fs.rm(folder, { recursive: true, force: true });
  } catch (error) {
    console.error("[KYC private documents] Cleanup failed:", error);
  }
}

export async function createPrivateKycDocumentBundle(input: KycDocumentBundleInput): Promise<PrivateKycDocumentBundle> {
  const folderName = `${safeSegment(input.fullName, "user")}-${safeSegment(input.userId, "id")}-${Date.now().toString(36)}`;
  const folderPath = `${DATABASE_PREFIX}${folderName}`;

  try {
    const [front, back, selfie] = await Promise.all([
      readUploadedSource(input.documentFrontPath),
      readUploadedSource(input.documentBackPath),
      readUploadedSource(input.selfiePath),
    ]);

    const files = [
      { key: "frontPath", name: "document-recto", source: input.documentFrontPath, file: front },
      { key: "backPath", name: "document-verso", source: input.documentBackPath, file: back },
      { key: "selfiePath", name: "selfie", source: input.selfiePath, file: selfie },
    ] as const;

    const result: Partial<PrivateKycDocumentBundle> = { folderPath };
    for (const item of files) {
      const extension = extensionFromContentType(item.file.contentType, item.source);
      const storagePath = `${folderPath}/${item.name}${extension}`;
      await saveDatabaseDocument(input.userId, storagePath, item.file.buffer, item.file.contentType, item.name);
      result[item.key] = storagePath;
    }

    const summaryPdfPath = `${folderPath}/kyc-resume.pdf`;
    const summaryPdf = await createSummaryPdf(input, { front, back, selfie });
    await saveDatabaseDocument(input.userId, summaryPdfPath, summaryPdf, "application/pdf", "kyc-resume.pdf");
    result.summaryPdfPath = summaryPdfPath;

    return result as PrivateKycDocumentBundle;
  } catch (error) {
    await removePrivateKycBundle({ folderPath });
    throw error;
  }
}

export function isPrivateKycPath(storagePath: string): boolean {
  return storagePath.startsWith(PRIVATE_PREFIX);
}

export { getPrivateDocumentsRoot };