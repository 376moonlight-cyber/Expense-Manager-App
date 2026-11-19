import { randomUUID } from "crypto";
import { BlobNotFoundError, del, get, put } from "@vercel/blob";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export const ALLOWED_RECEIPT_MIME_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
} as const;

export type AllowedReceiptMimeType = keyof typeof ALLOWED_RECEIPT_MIME_TYPES;

export function isAllowedReceiptMimeType(
  mimeType: string,
): mimeType is AllowedReceiptMimeType {
  return Object.prototype.hasOwnProperty.call(
    ALLOWED_RECEIPT_MIME_TYPES,
    mimeType,
  );
}

/** Ensure `storagePath` is a Vercel Blob HTTPS URL (never a local path). */
export function assertReceiptStoragePath(storagePath: string): string {
  let parsed: URL;
  try {
    parsed = new URL(storagePath);
  } catch {
    throw new Error("Invalid receipt storage path.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Invalid receipt storage path.");
  }

  const host = parsed.hostname.toLowerCase();
  const isBlobHost =
    host === "blob.vercel-storage.com" ||
    host.endsWith(".blob.vercel-storage.com");

  if (!isBlobHost) {
    throw new Error("Invalid receipt storage path.");
  }

  return storagePath;
}

/** Upload bytes to private Vercel Blob using a random UUID file name. */
export async function writeReceiptFile(
  mimeType: AllowedReceiptMimeType,
  data: Buffer,
): Promise<{ storagePath: string; sizeBytes: number }> {
  const fileName = `${randomUUID()}${ALLOWED_RECEIPT_MIME_TYPES[mimeType]}`;
  const pathname = `receipts/${fileName}`;

  const blob = await put(pathname, data, {
    access: "private",
    contentType: mimeType,
    addRandomSuffix: false,
  });

  return { storagePath: blob.url, sizeBytes: data.byteLength };
}

/** Read a private blob into a Buffer (backup / restore helpers). */
export async function readReceiptFile(storagePath: string): Promise<Buffer> {
  const url = assertReceiptStoragePath(storagePath);
  const result = await get(url, { access: "private" });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Receipt file is missing.");
  }

  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

/** Stream a private blob for authenticated download responses. */
export async function openReceiptStream(storagePath: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string | null;
  size: number | null;
}> {
  const url = assertReceiptStoragePath(storagePath);
  const result = await get(url, { access: "private" });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Receipt file is missing.");
  }

  return {
    stream: result.stream,
    contentType: result.blob.contentType,
    size: result.blob.size,
  };
}

export async function deleteReceiptFile(storagePath: string): Promise<void> {
  try {
    const url = assertReceiptStoragePath(storagePath);
    await del(url);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return;
    throw error;
  }
}

/** Basic magic-byte check so Content-Type alone is not enough. */
export function matchesMimeMagic(
  mimeType: AllowedReceiptMimeType,
  data: Buffer,
): boolean {
  if (data.length < 4) return false;

  if (mimeType === "image/jpeg") {
    return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return (
      data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47
    );
  }

  // %PDF
  return (
    data[0] === 0x25 &&
    data[1] === 0x50 &&
    data[2] === 0x44 &&
    data[3] === 0x46
  );
}
