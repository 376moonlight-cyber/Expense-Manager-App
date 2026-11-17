import { NextRequest, NextResponse } from "next/server";
import { jsonError, serverError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  deleteReceiptFile,
  isAllowedReceiptMimeType,
  matchesMimeMagic,
  MAX_RECEIPT_BYTES,
  writeReceiptFile,
} from "@/lib/receipts";
import { requireUserId } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

function serializeReceipt(receipt: {
  id: string;
  expenseId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}) {
  return {
    id: receipt.id,
    expenseId: receipt.expenseId,
    fileName: receipt.fileName,
    mimeType: receipt.mimeType,
    sizeBytes: receipt.sizeBytes,
    createdAt: receipt.createdAt,
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  let writtenPath: string | null = null;

  try {
    const session = await requireUserId();
    if ("error" in session) return session.error;
    const { userId } = session;

    const { id: expenseId } = await context.params;

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, userId },
      include: { receipt: true },
    });
    if (!expense) {
      return jsonError("Expense not found.", 404);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError("Expected multipart form data.", 400);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("A receipt file is required.", 400);
    }

    if (file.size <= 0) {
      return jsonError("Receipt file is empty.", 400);
    }

    if (file.size > MAX_RECEIPT_BYTES) {
      return jsonError("Receipt must be 5 MB or smaller.", 400);
    }

    const mimeType = file.type;
    if (!isAllowedReceiptMimeType(mimeType)) {
      return jsonError("Only JPEG, PNG, and PDF receipts are allowed.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_RECEIPT_BYTES) {
      return jsonError("Receipt must be 5 MB or smaller.", 400);
    }

    if (!matchesMimeMagic(mimeType, buffer)) {
      return jsonError("File contents do not match the declared type.", 400);
    }

    const originalName = file.name?.trim() || "receipt";
    const safeName = originalName.slice(0, 200);

    const { storagePath, sizeBytes } = await writeReceiptFile(mimeType, buffer);
    writtenPath = storagePath;

    const previous = expense.receipt;

    const receipt = await prisma.$transaction(async (tx) => {
      if (previous) {
        await tx.receipt.delete({ where: { id: previous.id } });
      }

      return tx.receipt.create({
        data: {
          expenseId,
          fileName: safeName,
          mimeType,
          sizeBytes,
          storagePath,
        },
      });
    });

    if (previous) {
      await deleteReceiptFile(previous.storagePath);
    }

    writtenPath = null;

    return NextResponse.json(serializeReceipt(receipt), { status: 201 });
  } catch (error) {
    if (writtenPath) {
      await deleteReceiptFile(writtenPath).catch(() => undefined);
    }
    return serverError(
      "POST /api/expenses/[id]/receipt",
      error,
      "Failed to upload receipt.",
    );
  }
}
