"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm font-medium hover:underline"
      style={{ color: "var(--text-muted)" }}
    >
      Sign out
    </button>
  );
}
