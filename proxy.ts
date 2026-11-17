import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const publicPaths = new Set(["/login", "/signup"]);

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = Boolean(request.auth?.user);
  const isPublic = publicPaths.has(pathname);
  const isAuthApi = pathname.startsWith("/api/auth");

  if (isAuthApi) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
