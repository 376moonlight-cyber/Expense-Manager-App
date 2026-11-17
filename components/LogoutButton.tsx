"use client";

import { logout } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-sm font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
      >
        Log out
      </button>
    </form>
  );
}
