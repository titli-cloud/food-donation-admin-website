import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, adminNotifications, foodDonations } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { badRequest, canManageOperations, forbidden, requestIp, unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
const donationStatuses = ["available", "requested", "accepted", "pickup_scheduled", "picked_up", "delivered", "completed", "cancelled", "rejected", "expired_review"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const activeStatuses = ["available", "requested", "accepted", "pickup_scheduled", "picked_up", "delivered"];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  const { id } = await params;
  const predicate = uuidPattern.test(id) ? eq(foodDonations.id, id) : eq(foodDonations.donationId, id);
  const [record] = await db.select().from(foodDonations).where(predicate).limit(1);
  if (!record) return Response.json({ error: "Donation not found." }, { status: 404 });
  const safetyFlag = Boolean(record.safeUntil && record.safeUntil.getTime() <= Date.now()) || record.status === "expired_review";
  return Response.json({ record, safetyFlag });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (!canManageOperations(admin)) return forbidden();
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Enter a valid donation update.");
  }
  const nextStatus = String(body.status ?? "");
  if (!donationStatuses.includes(nextStatus)) return badRequest("Choose a supported donation status.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (["cancelled", "rejected"].includes(nextStatus) && !reason) return badRequest("A reason is required to cancel or reject a donation.");
  const predicate = uuidPattern.test(id) ? eq(foodDonations.id, id) : eq(foodDonations.donationId, id);
  const safeUntilInput = typeof body.safeUntil === "string" && body.safeUntil ? new Date(body.safeUntil) : undefined;
  if (safeUntilInput && Number.isNaN(safeUntilInput.getTime())) return badRequest("Enter a valid safe-consumption time.");

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(foodDonations).where(predicate).limit(1);
      if (!current) return { missing: true as const };
      const safeUntil = safeUntilInput === undefined ? current.safeUntil : safeUntilInput;
      if (activeStatuses.includes(nextStatus) && safeUntil && safeUntil.getTime() <= Date.now()) {
        return { unsafe: true as const };
      }
      const now = new Date();
      const updatedJourney = [...(current.journey ?? []), { status: nextStatus, changedAt: now.toISOString(), changedBy: admin.name, ...(reason ? { note: reason } : {}) }];
      const assignedNgoRegistrationId = typeof body.assignedNgoRegistrationId === "string" ? body.assignedNgoRegistrationId.trim() || null : current.assignedNgoRegistrationId;
      const assignedNgoName = typeof body.assignedNgoName === "string" ? body.assignedNgoName.trim() || null : current.assignedNgoName;
      const [record] = await tx.update(foodDonations).set({
        status: nextStatus,
        safeUntil,
        assignedNgoRegistrationId,
        assignedNgoName,
        safetyNotes: typeof body.safetyNotes === "string" ? body.safetyNotes.trim() || null : current.safetyNotes,
        journey: updatedJourney,
        updatedAt: now,
      }).where(eq(foodDonations.id, current.id)).returning();
      await tx.insert(adminAuditLogs).values({
        adminId: admin.id,
        adminName: admin.name,
        action: "food_donation_status_updated",
        entityType: "food_donation",
        entityId: current.id,
        details: { donationId: current.donationId, previousStatus: current.status, status: nextStatus, reason: reason || null },
        ipAddress: requestIp(request),
      });
      await tx.insert(adminNotifications).values({
        type: "food_donation_status",
        title: "Food donation updated",
        message: `${current.donationId} is now ${nextStatus.replaceAll("_", " ")}${reason ? ` — ${reason}` : ""}.`,
        targetType: "food_donation",
        targetId: current.id,
      });
      return { record };
    });
    if ("missing" in result) return Response.json({ error: "Donation not found." }, { status: 404 });
    if ("unsafe" in result) return Response.json({ error: "This donation is past its safe-consumption time. It cannot be active or available." }, { status: 409 });
    return Response.json({ record: result.record, safetyFlag: Boolean(result.record.safeUntil && result.record.safeUntil.getTime() <= Date.now()) });
  } catch {
    return Response.json({ error: "The donation could not be updated." }, { status: 500 });
  }
}
