"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "unknown" }));
        throw new Error(msg ?? "Login failed");
      }
      router.replace(next as Route);
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-semibold text-navy-900">SnowFox Admin</h1>
      <p className="text-ink-500 text-sm mt-1">Sign in to view assessment results.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
            className="mt-1 block w-full rounded-md border border-snow-300 bg-snow-50 px-3 py-2 focus:border-navy-700 focus:outline-none"
          />
        </label>

        {error && (
          <div role="alert" className="rounded-md border border-fox-600/30 bg-fox-600/5 px-3 py-2 text-sm text-fox-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!password || submitting}
          className="w-full rounded-md bg-fox-600 disabled:bg-snow-300 disabled:text-ink-400 text-snow-50 font-semibold px-4 py-2.5 transition"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
