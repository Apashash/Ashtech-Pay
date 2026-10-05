import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { AddressInfo } from "node:net";
import { singleFileUpload } from "../server/multipartUpload";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

type FilePart = {
  fieldName?: string;
  filename?: string;
  mimeType?: string;
  contents: string;
};

async function postMultipart(
  options: Parameters<typeof singleFileUpload>[0],
  parts: FilePart[],
) {
  const app = express();
  app.post("/upload", singleFileUpload(options), (req, res) => {
    const file = req.file;
    res.json({
      fieldname: file?.fieldname,
      originalname: file?.originalname,
      encoding: file?.encoding,
      mimetype: file?.mimetype,
      size: file?.size,
      filename: file?.filename,
      path: file?.path,
      buffer: file?.buffer?.toString("base64"),
    });
  });
  app.use((error: Error & { code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ message: error.message, code: error.code });
  });

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  try {
    const form = new FormData();
    for (const part of parts) {
      const blob = new Blob([part.contents], { type: part.mimeType || "image/png" });
      form.append(part.fieldName || "file", blob, part.filename || "upload.png");
    }
    return await fetch(`http://127.0.0.1:${address.port}/upload`, {
      method: "POST",
      body: form,
    });
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("singleFileUpload preserves memory upload metadata and bytes", async () => {
  const response = await postMultipart(
    {
      fieldName: "file",
      storage: { kind: "memory" },
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      maxFileSize: 1024,
    },
    [{ filename: "portrait.png", mimeType: "image/png", contents: "png-bytes" }],
  );
  const body = await response.json() as { originalname: string; mimetype: string; size: number; buffer: string };

  assert.equal(response.status, 200);
  assert.equal(body.originalname, "portrait.png");
  assert.equal(body.mimetype, "image/png");
  assert.equal(body.size, Buffer.byteLength("png-bytes"));
  assert.equal(Buffer.from(body.buffer, "base64").toString(), "png-bytes");
});

test("singleFileUpload rejects files over the configured limit", async () => {
  const response = await postMultipart(
    {
      fieldName: "file",
      storage: { kind: "memory" },
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      maxFileSize: 4,
    },
    [{ contents: "12345" }],
  );
  const body = await response.json() as { code: string };

  assert.equal(response.status, 400);
  assert.equal(body.code, "LIMIT_FILE_SIZE");
});

test("singleFileUpload rejects unapproved MIME types and unexpected fields", async () => {
  const options = {
    fieldName: "file",
    storage: { kind: "memory" } as const,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    maxFileSize: 1024,
  };
  const invalidMime = await postMultipart(options, [{ mimeType: "application/octet-stream", contents: "data" }]);
  const invalidMimeBody = await invalidMime.json() as { message: string };
  assert.equal(invalidMime.status, 400);
  assert.match(invalidMimeBody.message, /Type de fichier non autorisé/);

  const unexpectedField = await postMultipart(options, [{ fieldName: "other", contents: "data" }]);
  const unexpectedFieldBody = await unexpectedField.json() as { code: string };
  assert.equal(unexpectedField.status, 400);
  assert.equal(unexpectedFieldBody.code, "LIMIT_UNEXPECTED_FILE");
});

test("singleFileUpload streams disk uploads under generated private filenames", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ashtech-upload-test-"));
  try {
    const response = await postMultipart(
      {
        fieldName: "file",
        storage: { kind: "disk", destination: directory },
        allowedMimeTypes: ALLOWED_MIME_TYPES,
        maxFileSize: 1024,
      },
      [{ filename: "../unsafe.png", mimeType: "image/png", contents: "disk-bytes" }],
    );
    const body = await response.json() as { filename: string; path: string; size: number; buffer?: string };

    assert.equal(response.status, 200);
    assert.match(body.filename, /^\d+-[0-9a-f-]+\.png$/i);
    assert.equal(path.dirname(body.path), directory);
    assert.equal(body.size, Buffer.byteLength("disk-bytes"));
    assert.equal(body.buffer, undefined);
    assert.equal(await readFile(body.path, "utf8"), "disk-bytes");
    assert.equal((await stat(body.path)).mode & 0o777, 0o644);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
