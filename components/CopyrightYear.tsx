"use client";

/** Client-only year so Cache Components prerender avoids sync Date IO. */
export function CopyrightYear() {
  return <>{new Date().getFullYear()}</>;
}
