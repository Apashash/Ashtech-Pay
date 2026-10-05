import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Request, RequestHandler } from "express";

type BusboyFactory = (options: {
  headers: Request["headers"];
  limits: {
    fileSize: number;
    files: number;
    fields: number;
    parts: number;
  };
}) => any;

const Busboy = createRequire(path.resolve(process.cwd(), "package.json"))("busboy") as BusboyFactory;

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

declare global {
  namespace Express {
    interface Request {
      file?: UploadedFile;
    }
  }
}

type UploadError = Error & { code?: string };

type SingleFileUploadOptions = {
  fieldName: string;
  allowedMimeTypes: readonly string[];
  maxFileSize: number;
} & (
  | { storage: { kind: "memory" } }
  | { storage: { kind: "disk"; destination: string } }
);

function makeUploadError(message: string, code?: string): UploadError {
  const error = new Error(message) as UploadError;
  if (code) error.code = code;
  return error;
}

function fileSizeError(): UploadError {
  return makeUploadError("Le fichier dépasse la taille maximale autorisée", "LIMIT_FILE_SIZE");
}

function bufferFromStream(stream: any, maxFileSize: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      stream.resume();
      reject(error);
    };

    stream.on("data", (chunk: Buffer | Uint8Array) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxFileSize) {
        fail(fileSizeError());
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    stream.once("limit", () => fail(fileSizeError()));
    stream.once("error", fail);
    stream.once("end", () => {
      if (settled) return;
      if (stream.truncated) {
        fail(fileSizeError());
        return;
      }
      settled = true;
      resolve(Buffer.concat(chunks, size));
    });
  });
}

function streamToDisk(
  stream: any,
  filePath: string,
  maxFileSize: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(filePath, { flags: "wx", mode: 0o644 });
    let size = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      stream.unpipe(output);
      output.destroy();
      stream.resume();
      void fs.rm(filePath, { force: true }).finally(() => reject(error));
    };

    stream.on("data", (chunk: Buffer | Uint8Array) => {
      size += chunk.length;
      if (size > maxFileSize) fail(fileSizeError());
    });
    stream.once("limit", () => fail(fileSizeError()));
    stream.once("error", fail);
    output.once("error", fail);
    output.once("finish", () => {
      if (settled) return;
      settled = true;
      resolve(size);
    });
    stream.pipe(output);
  });
}

export function singleFileUpload(options: SingleFileUploadOptions): RequestHandler {
  const allowedMimeTypes = new Set(options.allowedMimeTypes.map((type) => type.toLowerCase()));

  return (req, _res, next) => {
    let parser: any;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: {
          fileSize: options.maxFileSize,
          files: 1,
          fields: 0,
          parts: 2,
        },
      });
    } catch {
      return next(makeUploadError("Requête multipart invalide", "INVALID_MULTIPART"));
    }

    let parserClosed = false;
    let pendingFiles = 0;
    let fileCount = 0;
    let completed = false;
    let firstError: UploadError | undefined;
    let uploadedFile: UploadedFile | undefined;

    const setError = (error: UploadError) => {
      firstError ??= error;
    };

    const finishIfReady = () => {
      if (completed || !parserClosed || pendingFiles > 0) return;
      completed = true;

      if (firstError) {
        const uploadedPath = uploadedFile?.path;
        if (uploadedPath) {
          void fs.rm(uploadedPath, { force: true }).finally(() => next(firstError));
        } else {
          next(firstError);
        }
        return;
      }

      req.file = uploadedFile;
      next();
    };

    parser.on("file", (fieldName: string, stream: any, info: {
      filename?: string;
      encoding?: string;
      mimeType?: string;
    }) => {
      fileCount += 1;
      if (fileCount > 1) {
        setError(makeUploadError("Un seul fichier est accepté", "LIMIT_FILE_COUNT"));
        stream.resume();
        return;
      }
      if (fieldName !== options.fieldName) {
        setError(makeUploadError("Champ de fichier inattendu", "LIMIT_UNEXPECTED_FILE"));
        stream.resume();
        return;
      }

      const mimetype = (info.mimeType || "application/octet-stream").toLowerCase();
      if (!allowedMimeTypes.has(mimetype)) {
        setError(makeUploadError("Type de fichier non autorisé"));
        stream.resume();
        return;
      }

      pendingFiles += 1;
      const originalname = info.filename || "";
      const metadata = {
        fieldname: fieldName,
        originalname,
        encoding: info.encoding || "7bit",
        mimetype,
      };

      const consume = async () => {
        if (options.storage.kind === "memory") {
          const buffer = await bufferFromStream(stream, options.maxFileSize);
          return { ...metadata, size: buffer.length, buffer };
        }

        const extension = path.extname(originalname).toLowerCase();
        const safeExtension = /^\.[a-z0-9]{1,12}$/.test(extension) ? extension : "";
        const filename = `${Date.now()}-${randomUUID()}${safeExtension}`;
        const filePath = path.join(options.storage.destination, filename);
        const size = await streamToDisk(stream, filePath, options.maxFileSize);
        return {
          ...metadata,
          size,
          destination: options.storage.destination,
          filename,
          path: filePath,
        };
      };

      void consume()
        .then((file) => {
          uploadedFile = file;
        })
        .catch((error: unknown) => {
          setError(error instanceof Error ? error as UploadError : makeUploadError("Échec de l'upload"));
        })
        .finally(() => {
          pendingFiles -= 1;
          finishIfReady();
        });
    });

    parser.on("field", () => {
      setError(makeUploadError("Les champs de formulaire ne sont pas acceptés", "LIMIT_UNEXPECTED_FIELD"));
    });
    parser.on("filesLimit", () => {
      setError(makeUploadError("Un seul fichier est accepté", "LIMIT_FILE_COUNT"));
    });
    parser.on("fieldsLimit", () => {
      setError(makeUploadError("Les champs de formulaire ne sont pas acceptés", "LIMIT_UNEXPECTED_FIELD"));
    });
    parser.on("partsLimit", () => {
      setError(makeUploadError("Trop de parties multipart", "LIMIT_PART_COUNT"));
    });
    parser.once("error", (error: Error) => {
      setError(makeUploadError(error.message || "Requête multipart invalide", "INVALID_MULTIPART"));
    });
    parser.once("close", () => {
      parserClosed = true;
      finishIfReady();
    });
    req.once("aborted", () => {
      setError(makeUploadError("Requête interrompue", "UPLOAD_ABORTED"));
    });
    req.pipe(parser);
  };
}
