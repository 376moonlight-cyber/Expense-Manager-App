import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { jsonError } from "@/lib/api";

/** Require a logged-in user for API routes. Returns 401 JSON when missing. */
export async function requireUserId(): Promise<
  { userId: string } | { error: NextResponse }
> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return { error: jsonError("Unauthorized.", 401) };
    }

    return { userId };
  } catch {
    // During build/prerender, auth()/headers() can reject — treat as logged out.
    return { error: jsonError("Unauthorized.", 401) };
  }
}
