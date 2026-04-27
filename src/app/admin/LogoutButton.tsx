"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login" as Route);
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="rounded-md border border-snow-300 px-3 py-1.5 text-sm text-ink-700 hover:bg-snow-100 disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
