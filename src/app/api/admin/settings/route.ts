import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, adminUsers } from "@/db/schema";
import { createSessionToken, getCurrentAdmin, hashPassword, SESSION_MAX_AGE, verifyPassword } from "@/lib/admin/auth";
import { badRequest, isValidEmail, requestIp, unauthorized } from "@/lib/admin/http";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  const [account] = await db.select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, role: adminUsers.role, active: adminUsers.active, createdAt: adminUsers.createdAt }).from(adminUsers).where(eq(adminUsers.id, admin.id)).limit(1);
  return Response.json({ account });
}

export async function PATCH(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  let body: { name?: string; email?: string; currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Enter valid account details.");
  }
  const [current] = await db.select().from(adminUsers).where(eq(adminUsers.id, admin.id)).limit(1);
  if (!current) return unauthorized();
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  if (name !== undefined && (!name || name.length > 120)) return badRequest("Enter a name between 1 and 120 characters.");
  if (email !== undefined && !isValidEmail(email)) return badRequest("Enter a valid email address.");
  const changesPassword = Boolean(body.newPassword);
  if (changesPassword) {
    if (!body.currentPassword || !(await verifyPassword(body.currentPassword, current.passwordHash))) return Response.json({ error: "Your current password is incorrect." }, { status: 403 });
    if ((body.newPassword ?? "").length < 12 || (body.newPassword ?? "").length > 256) return badRequest("Use a new password between 12 and 256 characters.");
  }
  if (name === undefined && email === undefined && !changesPassword) return badRequest("There are no account changes to save.");

  const values: Partial<typeof adminUsers.$inferInsert> = { updatedAt: new Date() };
  if (name !== undefined) values.name = name;
  if (email !== undefined) values.email = email;
  if (changesPassword) {
    values.passwordHash = await hashPassword(body.newPassword ?? "");
    values.sessionVersion = current.sessionVersion + 1;
  }
  try {
    const [updated] = await db.update(adminUsers).set(values).where(eq(adminUsers.id, admin.id)).returning({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, role: adminUsers.role, active: adminUsers.active, createdAt: adminUsers.createdAt, sessionVersion: adminUsers.sessionVersion });
    await db.insert(adminAuditLogs).values({ adminId: admin.id, adminName: admin.name, action: "admin_profile_updated", entityType: "admin", entityId: admin.id, details: { nameChanged: name !== undefined, emailChanged: email !== undefined, passwordChanged: changesPassword }, ipAddress: requestIp(request) });
    const response = NextResponse.json({ account: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, active: updated.active, createdAt: updated.createdAt } });
    if (changesPassword) response.cookies.set("seva_admin_session", createSessionToken(updated.id, updated.sessionVersion), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
    return response;
  } catch {
    return Response.json({ error: "That email is already in use, or your account could not be updated." }, { status: 409 });
  }
}
