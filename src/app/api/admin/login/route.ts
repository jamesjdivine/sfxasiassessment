/**
 * POST /api/admin/login
 * Body: { password: string }
 * Validates against ADMIN_PASSWORD; on success sets a signed sfx_admin cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_TTL_SECONDS, safeEqual, signAdminToken } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || expected.length < 8) {
      return NextResponse.json(
        { error: "Admin not configured (ADMIN_PASSWORD missing)." },
        { status: 503 }
      );
    }

    const { password } = (await req.json().catch(() => ({}))) as { password?: string };
    if (typeof password !== "string" || !safeEqual(password, expected)) {
      // Small delay to take some sting out of a brute-force attack.
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ error: "Wrong password." }, { status: 401 });
    }

    const token = await signAdminToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_TTL_SECONDS,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
