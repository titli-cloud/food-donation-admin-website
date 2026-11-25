import { and, count, desc, ilike, inArray, or, type SQL } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { foodDonations, registrationRecords } from "@/db/schema";
import { createNotification, getCurrentAdmin, writeAudit } from "@/lib/admin/auth";
import { badRequest, canManageOperations, pagination, requestIp, unauthorized, forbidden } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
const statuses = ["available", "requested", "accepted", "pickup_scheduled", "picked_up", "delivered", "completed", "cancelled", "rejected", "expired_review"];

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  const url = new URL(request.url);
  const { page, limit, offset } = pagination(url);
  const filters: SQL[] = [];
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("q")?.trim();
  if (status && status !== "all") filters.push(inArray(foodDonations.status, [status]));
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(foodDonations.donationId, pattern), ilike(foodDonations.donorName, pattern), ilike(foodDonations.foodItem, pattern)) as SQL);
  }
  const where = filters.length ? and(...filters) : undefined;
  const [records, totalResult] = await Promise.all([
    db.select().from(foodDonations).where(where).orderBy(desc(foodDonations.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(foodDonations).where(where),
  ]);
  const now = Date.now();
  const rows = records.map((record) => ({
    ...record,
    safetyFlag: Boolean(record.safeUntil && record.safeUntil.getTime() <= now) || record.status === "expired_review",
  }));
  const total = Number(totalResult[0]?.total ?? 0);
  return Response.json({ records: rows, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (!canManageOperations(admin)) return forbidden();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Enter valid food donation details.");
  }
  const donorName = String(body.donorName ?? "").trim();
  const foodItem = String(body.foodItem ?? "").trim();
  const category = String(body.foodCategory ?? "").trim();
  const unit = String(body.unit ?? "").trim();
  const quantity = Number(body.quantity);
  if (!donorName || donorName.length > 160 || !foodItem || foodItem.length > 160 || !category || !unit) return badRequest("Donor, food item, category, and unit are required.");
  if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("Quantity must be greater than zero.");
  const safeUntil = typeof body.safeUntil === "string" && body.safeUntil ? new Date(body.safeUntil) : null;
  const preparedAt = typeof body.preparedAt === "string" && body.preparedAt ? new Date(body.preparedAt) : null;
  if (safeUntil && Number.isNaN(safeUntil.getTime())) return badRequest("Enter a valid safe-consumption time.");
  if (preparedAt && Number.isNaN(preparedAt.getTime())) return badRequest("Enter a valid preparation time.");

  const donorRegistrationId = typeof body.donorRegistrationId === "string" ? body.donorRegistrationId.trim() : "";
  let resolvedDonorName = donorName;
  if (donorRegistrationId) {
    const [donor] = await db.select({ name: registrationRecords.name }).from(registrationRecords).where(and(inArray(registrationRecords.role, ["donor"]), inArray(registrationRecords.registrationId, [donorRegistrationId]))).limit(1);
    if (!donor) return badRequest("The donor registration ID was not found.");
    resolvedDonorName = donor.name;
  }
  const ngoRegistrationId = typeof body.assignedNgoRegistrationId === "string" ? body.assignedNgoRegistrationId.trim() : "";
  let assignedNgoName: string | null = null;
  if (ngoRegistrationId) {
    const [ngo] = await db.select({ name: registrationRecords.name }).from(registrationRecords).where(and(inArray(registrationRecords.role, ["ngo"]), inArray(registrationRecords.registrationId, [ngoRegistrationId]))).limit(1);
    if (!ngo) return badRequest("The assigned NGO registration ID was not found.");
    assignedNgoName = ngo.name;
  }

  const id = `FD-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const expired = Boolean(safeUntil && safeUntil.getTime() <= Date.now());
  const status = expired ? "expired_review" : "available";
  const journey = [{ status, changedAt: new Date().toISOString(), changedBy: admin.name, note: expired ? "Safe-consumption time has passed; held for review." : "Donation recorded." }];
  try {
    const [record] = await db.insert(foodDonations).values({
      donationId: id,
      donorRegistrationId: donorRegistrationId || null,
      donorName: resolvedDonorName,
      foodCategory: category,
      foodItem,
      quantity,
      unit,
      preparedAt,
      safeUntil,
      foodType: body.foodType === "non_vegetarian" ? "non_vegetarian" : "vegetarian",
      storageConditions: typeof body.storageConditions === "string" ? body.storageConditions.trim() || null : null,
      pickupLocation: body.pickupLocation && typeof body.pickupLocation === "object" && !Array.isArray(body.pickupLocation) ? body.pickupLocation as Record<string, unknown> : {},
      assignedNgoRegistrationId: ngoRegistrationId || null,
      assignedNgoName,
      status,
      safetyNotes: typeof body.safetyNotes === "string" ? body.safetyNotes.trim() || null : null,
      journey,
    }).returning();
    await Promise.all([
      writeAudit(admin, "food_donation_created", "food_donation", record.id, { donationId: id, status }, requestIp(request)),
      createNotification("food_donation", expired ? "Food donation needs safety review" : "New food donation", `${foodItem} · ${quantity} ${unit} from ${resolvedDonorName}${expired ? " — past its safe-consumption time" : ""}.`, "food_donation", record.id),
    ]);
    return Response.json({ record, safetyFlag: expired }, { status: 201 });
  } catch {
    return Response.json({ error: "The donation could not be saved." }, { status: 409 });
  }
}
