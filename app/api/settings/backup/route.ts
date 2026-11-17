import { NextResponse } from "next/server";
import { serverError } from "@/lib/api";
import {
  backupFileName,
  buildBackupZip,
  collectUserBackupData,
  markBackupDownloaded,
} from "@/lib/backup";
import { requireUserId } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { data, receiptFiles } = await collectUserBackupData(userId);
    const zipBytes = buildBackupZip(data, receiptFiles);
    await markBackupDownloaded(userId);

    const filename = backupFileName(new Date(data.createdAt));
    // Copy into a fresh ArrayBuffer-backed Uint8Array for BodyInit typing.
    const body = new Uint8Array(zipBytes);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError(
      "GET /api/settings/backup",
      error,
      "Failed to create backup.",
    );
  }
}
