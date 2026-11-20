import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export const ALLOWED_RECEIPT_MIME_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
} as const;

export type AllowedReceiptMimeType = keyof typeof ALLOWED_RECEIPT_MIME_TYPES;

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export function isAllowedReceiptMimeType(
  mimeType: string,
): mimeType is AllowedReceiptMimeType {
  return Object.prototype.hasOwnProperty.call(
    ALLOWED_RECEIPT_MIME_TYPES,
    mimeType,
  );
}

/** Absolute path for a stored relative `storagePath` (e.g. uploads/<uuid>.jpg). */
export function absoluteReceiptPath(storagePath: string): string {
  const resolved = path.resolve(process.cwd(), storagePath);
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  if (
    resolved !== uploadsRoot &&
    !resolved.startsWith(uploadsRoot + path.sep)
  ) {
    throw new Error("Invalid receipt storage path.");
  }
  return resolved;
}

export async function ensureUploadsDir(): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

/** Save bytes under uploads/ using a random UUID file name (never the original). */
export async function writeReceiptFile(
  mimeType: AllowedReceiptMimeType,
  data: Buffer,
): Promise<{ storagePath: string; sizeBytes: number }> {
  await ensureUploadsDir();
  const fileName = `${randomUUID()}${ALLOWED_RECEIPT_MIME_TYPES[mimeType]}`;
  const storagePath = path.posix.join("uploads", fileName);
  await fs.writeFile(path.join(process.cwd(), storagePath), data);
  return { storagePath, sizeBytes: data.byteLength };
}

export async function deleteReceiptFile(storagePath: string): Promise<void> {
  try {
    await fs.unlink(absoluteReceiptPath(storagePath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
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
