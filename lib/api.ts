import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { formatZodError } from "@/lib/expenses";

/** JSON error response helper used by all API routes. */
export function jsonError(
  error: string,
  status: number,
  details?: ReturnType<typeof formatZodError>,
) {
  return NextResponse.json(
    details ? { error, details } : { error },
    { status },
  );
}

export function validationError(zodError: ZodError) {
  return jsonError("Validation failed.", 400, formatZodError(zodError));
}

export function invalidJsonError() {
  return jsonError("Invalid JSON body.", 400);
}

export function serverError(route: string, error: unknown, message: string) {
  console.error(`${route} failed:`, error);
  return jsonError(message, 500);
}
