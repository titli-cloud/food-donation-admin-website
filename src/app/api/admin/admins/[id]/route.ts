import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { getCurrentAdmin, writeAudit } from "@/lib/admin/auth";
import { badRequest, forbidden, requestIp, unauthorized } from "@/lib/admin/http";

const allowedRoles = ["super_admin", "admin", "verifier", "analyst"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (admin.role !== "super_admin") return forbidden("Only a super administrator can change admin accounts.");
  const { id } = await params;
  let body: { role?: string; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return badRequest("Enter valid account settings.");
  }
  if (body.role !== undefined && !allowedRoles.includes(body.role)) return badRequest("Choose a supported administrator role.");
  if (body.active !== undefined && typeof body.active !== "boolean") return badRequest("Choose a valid account status.");
  if (id === admin.id && (body.active === false || (body.role !== undefined && body.role !== "super_admin"))) return badRequest("You cannot deactivate or demote your own account.");

  const [target] = await db.select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, role: adminUsers.role, active: adminUsers.active }).from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  if (!target) return Response.json({ error: "Administrator not found." }, { status: 404 });
  const losesSuperAccess = target.role === "super_admin" && target.active && (body.role !== undefined && body.role !== "super_admin" || body.active === false);
  if (losesSuperAccess) {
    const [superCount] = await db.select({ total: count() }).from(adminUsers).where(and(eq(adminUsers.role, "super_admin"), eq(adminUsers.active, true)));
    if (Number(superCount?.total ?? 0) <= 1) return Response.json({ error: "At least one active super administrator must remain." }, { status: 409 });
  }
  const values: Partial<typeof adminUsers.$inferInsert> = { updatedAt: new Date() };
  if (body.role !== undefined) values.role = body.role;
  if (body.active !== undefined) values.active = body.active;
  const [updated] = await db.update(adminUsers).set(values).where(eq(adminUsers.id, id)).returning({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, role: adminUsers.role, active: adminUsers.active, createdAt: adminUsers.createdAt });
  await writeAudit(admin, "admin_updated", "admin", id, { previousRole: target.role, role: updated.role, previousActive: target.active, active: updated.active }, requestIp(request));
  return Response.json({ user: updated });
}
