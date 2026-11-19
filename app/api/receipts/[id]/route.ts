import { NextRequest, NextResponse } from "next/server";
import { jsonError, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  deleteReceiptFile,
  openReceiptStream,
} from "@/lib/receipts";
import { requireUserId } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

/** Stream the private Blob receipt (auth + per-user ownership required). */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const receipt = await prisma.receipt.findFirst({
      where: { id, expense: { userId } },
    });
    if (!receipt) {
      return jsonError("Receipt not found.", 404);
    }

    let blob;
    try {
      blob = await openReceiptStream(receipt.storagePath);
    } catch {
      return jsonError("Receipt file is missing.", 404);
    }

    const dispositionName = receipt.fileName.replace(/["\r\n]/g, "_");

    return new NextResponse(blob.stream, {
      status: 200,
      headers: {
        "Content-Type": receipt.mimeType || blob.contentType || "application/octet-stream",
        "Content-Length": String(blob.size ?? receipt.sizeBytes),
        "Content-Disposition": `inline; filename="${dispositionName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return serverError(
      "GET /api/receipts/[id]",
      error,
      "Failed to download receipt.",
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id } = await context.params;

    const receipt = await prisma.receipt.findFirst({
      where: { id, expense: { userId } },
    });
    if (!receipt) {
      return jsonError("Receipt not found.", 404);
    }

    await prisma.receipt.delete({ where: { id: receipt.id } });
    await deleteReceiptFile(receipt.storagePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(
      "DELETE /api/receipts/[id]",
      error,
      "Failed to delete receipt.",
    );
  }
}
