import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";

export const ADMIN_COOKIE = "seva_admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 8;
export type AdminRole = "super_admin" | "admin" | "verifier" | "analyst";
export type AdminPrincipal = {
  id: string;
  name: string;
  email: string;
  role: AdminRole | string;
};
export const DEMO_ADMIN_EMAIL = "demo@aifoodbridge.local";
export const DEMO_ADMIN_PASSWORD = "demo-admin-123";

type SessionClaims = { sub: string; ver: number; exp: number };

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function sessionConfigurationReady() {
  return sessionSecret() !== null;
}

export function createSessionToken(adminId: string, sessionVersion = 0) {
  const secret = sessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters.");
  const claims: SessionClaims = { sub: adminId, ver: sessionVersion, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

async function readSessionAdmin(): Promise<AdminPrincipal | null> {
  const cookieStore = await cookies();
  if (process.env.ADMIN_DEMO_MODE === "true" && cookieStore.get("seva_admin_demo")?.value === "true") {
    return {
      id: "demo-admin",
      name: "Demo Administrator",
      email: DEMO_ADMIN_EMAIL,
      role: "super_admin",
    };
  }
  const secret = sessionSecret();
  if (!secret) return null;
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  if (!constantTimeEqual(signature, sign(payload, secret))) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (!claims.sub || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000 || !Number.isInteger(claims.ver)) return null;
    const [admin] = await db
      .select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, role: adminUsers.role, active: adminUsers.active, sessionVersion: adminUsers.sessionVersion })
      .from(adminUsers)
      .where(eq(adminUsers.id, claims.sub))
      .limit(1);
    if (!admin?.active || admin.sessionVersion !== claims.ver) return null;
    return { id: admin.id, name: admin.name, email: admin.email, role: admin.role };
  } catch {
    return null;
  }
}

export async function getCurrentAdmin() {
  return readSessionAdmin();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => (error ? reject(error) : resolve(key as Buffer)));
  });
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, keyHex] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, expected.length, (error, key) => (error ? reject(error) : resolve(key as Buffer)));
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function safeEqual(left: string, right: string) {
  return constantTimeEqual(left, right);
}

export async function writeAudit(
  admin: AdminPrincipal,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
  ipAddress?: string | null,
) {
  const { adminAuditLogs } = await import("@/db/schema");
  await db.insert(adminAuditLogs).values({
    adminId: admin.id,
    adminName: admin.name,
    action,
    entityType,
    entityId,
    details,
    ipAddress: ipAddress ?? null,
  });
}

export async function createNotification(
  type: string,
  title: string,
  message: string,
  targetType?: string,
  targetId?: string,
) {
  const { adminNotifications } = await import("@/db/schema");
  await db.insert(adminNotifications).values({
    type,
    title,
    message,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
  });
}
