import { NextRequest, NextResponse } from "next/server";
import { jsonError, serverError } from "@/lib/api";
import {
  BackupValidationError,
  MAX_BACKUP_ZIP_BYTES,
  parseBackupZip,
} from "@/lib/backup";
import { requireUserId } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError("Expected multipart form data.", 400);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("A backup ZIP file is required.", 400);
    }

    if (file.size <= 0) {
      return jsonError("Backup file is empty.", 400);
    }

    if (file.size > MAX_BACKUP_ZIP_BYTES) {
      return jsonError("Backup must be 50 MB or smaller.", 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_BACKUP_ZIP_BYTES) {
      return jsonError("Backup must be 50 MB or smaller.", 400);
    }

    try {
      const parsed = parseBackupZip(bytes);
      return NextResponse.json({ preview: parsed.preview });
    } catch (error) {
      if (error instanceof BackupValidationError) {
        return jsonError(error.message, 400);
      }
      throw error;
    }
  } catch (error) {
    return serverError(
      "POST /api/settings/backup/preview",
      error,
      "Failed to preview backup.",
    );
  }
}
