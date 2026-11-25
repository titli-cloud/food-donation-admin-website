import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { createSessionToken, hashPassword, safeEqual, SESSION_MAX_AGE, writeAudit } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!bootstrapToken) return Response.json({ error: "First-admin provisioning is not configured on this server." }, { status: 503 });
  if (!sessionSecret || sessionSecret.length < 32) {
    return Response.json({ error: "The server must configure ADMIN_SESSION_SECRET (at least 32 characters) before sign-in." }, { status: 503 });
  }

  let body: { name?: string; email?: string; password?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter valid setup details." }, { status: 400 });
  }
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!body.token || !safeEqual(body.token, bootstrapToken)) return Response.json({ error: "The setup token is incorrect." }, { status: 403 });
  if (!name || name.length > 120 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a name and a valid email address." }, { status: 400 });
  }
  if (password.length < 12 || password.length > 256) return Response.json({ error: "Use a password between 12 and 256 characters." }, { status: 400 });

  const passwordHash = await hashPassword(password);
  const admin = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(8140234)`);
    const [existing] = await tx.select({ id: adminUsers.id }).from(adminUsers).limit(1);
    if (existing) return null;
    const [created] = await tx.insert(adminUsers).values({ name, email, passwordHash, role: "super_admin" }).returning({
      id: adminUsers.id,
      name: adminUsers.name,
      email: adminUsers.email,
      role: adminUsers.role,
      sessionVersion: adminUsers.sessionVersion,
    });
    return created;
  });
  if (!admin) return Response.json({ error: "An administrator has already been set up. Please sign in." }, { status: 409 });

  await writeAudit(admin, "bootstrap_created", "admin", admin.id, { role: admin.role });
  const response = NextResponse.json({ admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  response.cookies.set("seva_admin_session", createSessionToken(admin.id, admin.sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
