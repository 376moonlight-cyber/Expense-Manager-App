import { NextRequest, NextResponse } from "next/server";
import { jsonError, serverError } from "@/lib/api";
import {
  BackupValidationError,
  MAX_BACKUP_ZIP_BYTES,
  parseBackupZip,
  restoreBackupForUser,
  type RestoreMode,
} from "@/lib/backup";
import { requireUserId } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

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

    const modeRaw = String(formData.get("mode") ?? "").trim().toLowerCase();
    if (modeRaw !== "merge" && modeRaw !== "replace") {
      return jsonError("Mode must be merge or replace.", 400);
    }
    const mode = modeRaw as RestoreMode;

    if (mode === "replace") {
      const confirmation = String(formData.get("confirmation") ?? "").trim();
      if (confirmation !== "RESTORE") {
        return jsonError(
          'Replace requires typing RESTORE in the confirmation field.',
          400,
        );
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_BACKUP_ZIP_BYTES) {
      return jsonError("Backup must be 50 MB or smaller.", 400);
    }

    let parsed;
    try {
      parsed = parseBackupZip(bytes);
    } catch (error) {
      if (error instanceof BackupValidationError) {
        return jsonError(error.message, 400);
      }
      throw error;
    }

    try {
      const result = await restoreBackupForUser(userId, parsed, mode);
      return NextResponse.json({
        mode,
        ...result,
      });
    } catch (error) {
      if (error instanceof BackupValidationError) {
        return jsonError(error.message, 400);
      }
      throw error;
    }
  } catch (error) {
    return serverError(
      "POST /api/settings/backup/restore",
      error,
      "Failed to restore backup.",
    );
  }
}
