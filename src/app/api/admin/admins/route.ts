import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { getCurrentAdmin, hashPassword, writeAudit } from "@/lib/admin/auth";
import { badRequest, forbidden, isValidEmail, requestIp, unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
const allowedRoles = ["super_admin", "admin", "verifier", "analyst"];

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (admin.role !== "super_admin") return forbidden("Only a super administrator can manage admin accounts.");
  const users = await db.select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, role: adminUsers.role, active: adminUsers.active, createdAt: adminUsers.createdAt }).from(adminUsers).orderBy(desc(adminUsers.createdAt));
  const [activeResult] = await db.select({ total: count() }).from(adminUsers).where(eq(adminUsers.active, true));
  return Response.json({ users, activeAdmins: Number(activeResult?.total ?? 0) });
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (admin.role !== "super_admin") return forbidden("Only a super administrator can provision admin accounts.");
  let body: { name?: string; email?: string; password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Enter valid administrator details.");
  }
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const role = body.role ?? "admin";
  if (!name || name.length > 120 || !isValidEmail(email)) return badRequest("Enter a name and valid email address.");
  if (password.length < 12 || password.length > 256) return badRequest("Use a password between 12 and 256 characters.");
  if (!allowedRoles.includes(role)) return badRequest("Choose a supported administrator role.");
  try {
    const [created] = await db.insert(adminUsers).values({ name, email, passwordHash: await hashPassword(password), role }).returning({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, role: adminUsers.role, active: adminUsers.active, createdAt: adminUsers.createdAt });
    await writeAudit(admin, "admin_created", "admin", created.id, { role: created.role, email: created.email }, requestIp(request));
    return Response.json({ user: created }, { status: 201 });
  } catch {
    return Response.json({ error: "That email address is already in use, or the account could not be created." }, { status: 409 });
  }
}
