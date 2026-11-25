import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, adminNotifications, contributions, ngoRequirements } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { badRequest, canManageOperations, forbidden, requestIp, unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
const statuses = ["open", "in_progress", "fulfilled", "closed", "cancelled"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (!canManageOperations(admin)) return forbidden();
  const { id } = await params;
  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Enter a valid status update.");
  }
  if (!body.status || !statuses.includes(body.status)) return badRequest("Choose a supported requirement status.");
  const nextStatus = body.status;
  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(ngoRequirements).where(eq(ngoRequirements.id, id)).limit(1);
    if (!current) return { missing: true as const };
    if (nextStatus === "fulfilled") {
      const receivedRows = await tx.select({ quantity: contributions.quantityReceived }).from(contributions).where(and(eq(contributions.requirementId, current.requirementId), inArray(contributions.status, ["received", "completed"])));
      const received = receivedRows.reduce((sum, row) => sum + Number(row.quantity), 0);
      if (received < current.requiredQuantity) return { remaining: current.requiredQuantity - received };
    }
    const [record] = await tx.update(ngoRequirements).set({ status: nextStatus, updatedAt: new Date() }).where(eq(ngoRequirements.id, id)).returning();
    await tx.insert(adminAuditLogs).values({ adminId: admin.id, adminName: admin.name, action: "requirement_status_updated", entityType: "ngo_requirement", entityId: id, details: { requirementId: current.requirementId, previousStatus: current.status, status: nextStatus }, ipAddress: requestIp(request) });
    await tx.insert(adminNotifications).values({ type: "requirement_status", title: "Requirement updated", message: `${current.requirementId} is now ${nextStatus.replaceAll("_", " ")}.`, targetType: "requirement", targetId: id });
    return { record };
  });
  if ("missing" in result) return Response.json({ error: "Requirement not found." }, { status: 404 });
  if ("remaining" in result) return Response.json({ error: `This requirement still has ${result.remaining} units unreceived. Confirm receipt before marking it fulfilled.` }, { status: 409 });
  return Response.json({ record: result.record });
}
