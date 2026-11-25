import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { activityRecords, adminAuditLogs, adminNotifications, privateDocuments, registrationRecords } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { badRequest, canManageOperations, canManageRecords, forbidden, isObject, requestIp, unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (!canManageRecords(admin)) return forbidden("Your role does not allow access to registration records.");
  const { id } = await params;
  const predicate = uuidPattern.test(id) ? eq(registrationRecords.id, id) : eq(registrationRecords.registrationId, id);
  const [record] = await db.select().from(registrationRecords).where(predicate).limit(1);
  if (!record) return Response.json({ error: "Registration record not found." }, { status: 404 });

  const [documents, activities] = await Promise.all([
    db.select({ id: privateDocuments.id, name: privateDocuments.name, category: privateDocuments.category, contentType: privateDocuments.contentType, byteSize: privateDocuments.byteSize, uploadedAt: privateDocuments.uploadedAt }).from(privateDocuments).where(eq(privateDocuments.registrationRecordId, record.id)).orderBy(desc(privateDocuments.uploadedAt)),
    db.select().from(activityRecords).where(eq(activityRecords.registrationRecordId, record.id)).orderBy(desc(activityRecords.occurredAt)).limit(50),
  ]);
  return Response.json({ record, documents, activities });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (!canManageRecords(admin)) return forbidden();
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Enter valid update details.");
  }
  const action = String(body.action ?? "");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!["approve", "reject", "request_information", "suspend", "reactivate", "update"].includes(action)) return badRequest("Choose a supported admin action.");
  if ((action === "reject" || action === "request_information") && !reason) return badRequest("A reason is required for this action.");
  if (["suspend", "reactivate", "update"].includes(action) && !canManageOperations(admin)) return forbidden("Only administrators can change account access or profile details.");

  const predicate = uuidPattern.test(id) ? eq(registrationRecords.id, id) : eq(registrationRecords.registrationId, id);
  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(registrationRecords).where(predicate).limit(1);
      if (!current) return { missing: true as const };
      if (["approve", "reject", "request_information"].includes(action) && !["pending", "info_requested"].includes(current.verificationStatus)) {
        return { conflict: true as const, status: current.verificationStatus };
      }

      const values: Partial<typeof registrationRecords.$inferInsert> = { updatedAt: new Date() };
      if (action === "approve") {
        values.verificationStatus = "approved";
        values.verifiedAt = new Date();
        values.verifiedBy = admin.id;
        values.verificationReason = null;
      } else if (action === "reject") {
        values.verificationStatus = "rejected";
        values.verifiedAt = new Date();
        values.verifiedBy = admin.id;
        values.verificationReason = reason;
      } else if (action === "request_information") {
        values.verificationStatus = "info_requested";
        values.verifiedBy = admin.id;
        values.verificationReason = reason;
      } else if (action === "suspend") {
        values.accountStatus = "suspended";
      } else if (action === "reactivate") {
        values.accountStatus = "active";
      } else {
        if (typeof body.name === "string") {
          const name = body.name.trim();
          if (!name || name.length > 160) throw new Error("Enter a name between 1 and 160 characters.");
          values.name = name;
        }
        if (typeof body.email === "string") {
          const email = body.email.trim().toLowerCase();
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
          values.email = email || null;
        }
        if (typeof body.phone === "string") values.phone = body.phone.trim() || null;
        if (typeof body.assignedOrganization === "string") values.assignedOrganization = body.assignedOrganization.trim() || null;
        if (typeof body.adminRemarks === "string") values.adminRemarks = body.adminRemarks.trim() || null;
        if (isObject(body.profile)) values.profile = { ...current.profile, ...body.profile };
      }
      const [record] = await tx.update(registrationRecords).set(values).where(eq(registrationRecords.id, current.id)).returning();
      const actionLabel = action === "request_information" ? "request_information" : action;
      await tx.insert(adminAuditLogs).values({
        adminId: admin.id,
        adminName: admin.name,
        action: `registration_${actionLabel}`,
        entityType: current.role,
        entityId: current.id,
        details: { registrationId: current.registrationId, reason: reason || null },
        ipAddress: requestIp(request),
      });
      if (["approve", "reject", "request_information", "suspend", "reactivate"].includes(action)) {
        const labels: Record<string, string> = {
          approve: "Registration approved",
          reject: "Registration rejected",
          request_information: "More information requested",
          suspend: "Account suspended",
          reactivate: "Account reactivated",
        };
        await tx.insert(adminNotifications).values({
          type: `registration_${actionLabel}`,
          title: labels[action] ?? "Registration updated",
          message: `${current.name} (${current.registrationId}) — ${reason || actionLabel.replaceAll("_", " ")}.`,
          targetType: "registration",
          targetId: current.id,
        });
      }
      return { record };
    });
    if ("missing" in result) return Response.json({ error: "Registration record not found." }, { status: 404 });
    if ("conflict" in result) return Response.json({ error: `This request is already ${(result.status ?? "pending").replaceAll("_", " ")}.` }, { status: 409 });
    return Response.json({ record: result.record });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The registration could not be updated." }, { status: 400 });
  }
}
