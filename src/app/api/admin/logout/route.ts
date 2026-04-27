/**
 * POST /api/admin/logout
 * Clears the admin cookie.
 */

import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
