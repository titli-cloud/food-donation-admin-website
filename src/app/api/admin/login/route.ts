import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { createSessionToken, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, SESSION_MAX_AGE, verifyPassword } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.ADMIN_DEMO_MODE === "true") {
    let body: { email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Enter your email and password." }, { status: 400 });
    }
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    if (email !== DEMO_ADMIN_EMAIL || password !== DEMO_ADMIN_PASSWORD) {
      return Response.json({ error: "Use the demo email and password shown below." }, { status: 401 });
    }
    const response = NextResponse.json({
      admin: { id: "demo-admin", name: "Demo Administrator", email: DEMO_ADMIN_EMAIL, role: "super_admin" },
    });
    response.cookies.set("seva_admin_demo", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  }
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return Response.json({ error: "Administrator sign-in is not configured on this server." }, { status: 503 });
  }
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password || password.length > 256) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });

  const [record] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (!record || !record.active || !(await verifyPassword(password, record.passwordHash))) {
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({
    admin: { id: record.id, name: record.name, email: record.email, role: record.role },
  });
  response.cookies.set("seva_admin_session", createSessionToken(record.id, record.sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
