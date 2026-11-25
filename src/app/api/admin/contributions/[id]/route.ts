import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, adminNotifications, contributions, ngoRequirements } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { badRequest, canManageOperations, forbidden, requestIp, unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
const statuses = ["offered", "accepted", "scheduled", "in_transit", "received", "completed", "cancelled", "rejected"];
const reserving = ["accepted", "scheduled", "in_transit"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (!canManageOperations(admin)) return forbidden();
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Enter a valid contribution update.");
  }
  const status = String(body.status ?? "");
  if (!statuses.includes(status)) return badRequest("Choose a supported contribution status.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (["cancelled", "rejected"].includes(status) && !reason) return badRequest("A reason is required to cancel or reject an offer.");
  const confirmedInput = body.quantityConfirmed === undefined ? undefined : Number(body.quantityConfirmed);
  const receivedInput = body.quantityReceived === undefined ? undefined : Number(body.quantityReceived);
  if (confirmedInput !== undefined && (!Number.isFinite(confirmedInput) || confirmedInput < 0)) return badRequest("Confirmed quantity must be zero or more.");
  if (receivedInput !== undefined && (!Number.isFinite(receivedInput) || receivedInput < 0)) return badRequest("Received quantity must be zero or more.");

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(contributions).where(eq(contributions.id, id)).limit(1);
      if (!current) return { missing: true as const };
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${current.requirementId})::bigint)`);
      const [lockedCurrent] = await tx.select().from(contributions).where(eq(contributions.id, current.id)).limit(1);
      const [requirement] = await tx.select().from(ngoRequirements).where(eq(ngoRequirements.requirementId, current.requirementId)).limit(1);
      if (!lockedCurrent || !requirement) return { missing: true as const };
      if (["received", "completed"].includes(lockedCurrent.status) && ["cancelled", "rejected"].includes(status)) return { conflict: "A contribution already received by the NGO cannot be cancelled or rejected." as const };
      if (status === "accepted" && !["offered", "accepted"].includes(lockedCurrent.status)) return { conflict: "Only an offered contribution can be confirmed." as const };
      if (["scheduled", "in_transit"].includes(status) && !["accepted", "scheduled", "in_transit"].includes(lockedCurrent.status)) return { conflict: "Confirm the contribution before scheduling delivery." as const };
      if (status === "received" && !["accepted", "scheduled", "in_transit", "received"].includes(lockedCurrent.status)) return { conflict: "Confirm the contribution before recording receipt." as const };
      if (status === "completed" && !["received", "completed"].includes(lockedCurrent.status)) return { conflict: "Record receipt before completing this contribution." as const };

      const confirmed = status === "accepted"
        ? confirmedInput ?? lockedCurrent.quantityOffered
        : confirmedInput ?? lockedCurrent.quantityConfirmed;
      if (["accepted", "scheduled", "in_transit", "received", "completed"].includes(status) && (confirmed <= 0 || confirmed > lockedCurrent.quantityOffered)) {
        return { conflict: "Confirmed quantity must be greater than zero and no more than the offered quantity." as const };
      }
      const receiving = ["received", "completed"].includes(status);
      const received = receivedInput ?? (status === "received" && lockedCurrent.status !== "received" ? confirmed : lockedCurrent.quantityReceived);
      if (receiving && (received <= 0 || received > confirmed)) return { conflict: "Received quantity must be greater than zero and no more than the confirmed quantity." as const };
      if (status === "completed" && received !== confirmed) return { conflict: "A contribution can be completed only after its full confirmed quantity is received." as const };

      if (status === "accepted") {
        const otherRows = await tx.select({ status: contributions.status, confirmed: contributions.quantityConfirmed, received: contributions.quantityReceived }).from(contributions).where(and(eq(contributions.requirementId, current.requirementId), ne(contributions.id, current.id)));
        const committed = otherRows.reduce((sum, row) => sum + (reserving.includes(row.status) ? Number(row.confirmed) : ["received", "completed"].includes(row.status) ? Number(row.received) : 0), 0);
        if (committed + confirmed > requirement.requiredQuantity) return { conflict: `Only ${Math.max(0, requirement.requiredQuantity - committed)} ${requirement.unit} remain available to confirm.` as const };
      }

      const now = new Date();
      const [record] = await tx.update(contributions).set({
        status,
        quantityConfirmed: confirmed,
        quantityReceived: received,
        receivedAt: received > 0 ? lockedCurrent.receivedAt ?? now : null,
        updatedAt: now,
      }).where(eq(contributions.id, lockedCurrent.id)).returning();

      const allRows = await tx.select({ status: contributions.status, received: contributions.quantityReceived }).from(contributions).where(eq(contributions.requirementId, current.requirementId));
      const totalReceived = allRows.filter((row) => ["received", "completed"].includes(row.status)).reduce((sum, row) => sum + Number(row.received), 0);
      const nextRequirementStatus = totalReceived >= requirement.requiredQuantity ? "fulfilled" : totalReceived > 0 && requirement.status === "open" ? "in_progress" : requirement.status;
      if (nextRequirementStatus !== requirement.status) {
        await tx.update(ngoRequirements).set({ status: nextRequirementStatus, updatedAt: now }).where(eq(ngoRequirements.id, requirement.id));
      }
      await tx.insert(adminAuditLogs).values({
        adminId: admin.id,
        adminName: admin.name,
        action: "contribution_status_updated",
        entityType: "contribution",
        entityId: lockedCurrent.id,
        details: { contributionId: lockedCurrent.contributionId, previousStatus: lockedCurrent.status, status, quantityConfirmed: confirmed, quantityReceived: received, reason: reason || null },
        ipAddress: requestIp(request),
      });
      await tx.insert(adminNotifications).values({
        type: "contribution_status",
        title: "Contribution updated",
        message: `${lockedCurrent.contributionId} is now ${status.replaceAll("_", " ")}.`,
        targetType: "contribution",
        targetId: lockedCurrent.id,
      });
      return { record, totalReceived };
    });
    if ("missing" in result) return Response.json({ error: "Contribution or requirement not found." }, { status: 404 });
    if ("conflict" in result) return Response.json({ error: result.conflict }, { status: 409 });
    return Response.json({ record: result.record, fulfilledQuantity: result.totalReceived });
  } catch {
    return Response.json({ error: "The contribution could not be updated." }, { status: 500 });
  }
}
