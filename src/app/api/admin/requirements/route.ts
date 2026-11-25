import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { contributions, ngoRequirements, registrationRecords } from "@/db/schema";
import { createNotification, getCurrentAdmin, writeAudit } from "@/lib/admin/auth";
import { badRequest, canManageOperations, pagination, requestIp, unauthorized, forbidden } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  const url = new URL(request.url);
  const { page, limit, offset } = pagination(url);
  const filters: SQL[] = [];
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("q")?.trim();
  if (status === "open") filters.push(inArray(ngoRequirements.status, ["open", "in_progress"]));
  else if (status && status !== "all") filters.push(inArray(ngoRequirements.status, [status]));
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(ngoRequirements.requirementId, pattern), ilike(ngoRequirements.ngoName, pattern), ilike(ngoRequirements.item, pattern)) as SQL);
  }
  const where = filters.length ? and(...filters) : undefined;
  const [rows, totalResult, contributionTotals] = await Promise.all([
    db.select().from(ngoRequirements).where(where).orderBy(desc(ngoRequirements.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(ngoRequirements).where(where),
    db.select({ requirementId: contributions.requirementId, received: contributions.quantityReceived }).from(contributions).where(inArray(contributions.status, ["received", "completed"])),
  ]);
  const fulfilled = new Map<string, number>();
  for (const row of contributionTotals) fulfilled.set(row.requirementId, (fulfilled.get(row.requirementId) ?? 0) + Number(row.received));
  const records = rows.map((row) => {
    const fulfilledQuantity = fulfilled.get(row.requirementId) ?? 0;
    return { ...row, fulfilledQuantity, remainingQuantity: Math.max(0, row.requiredQuantity - fulfilledQuantity) };
  });
  const total = Number(totalResult[0]?.total ?? 0);
  return Response.json({ records, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (!canManageOperations(admin)) return forbidden();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Enter valid requirement details.");
  }
  const ngoRegistrationId = String(body.ngoRegistrationId ?? "").trim();
  const item = String(body.item ?? "").trim();
  const category = String(body.category ?? "").trim();
  const unit = String(body.unit ?? "").trim();
  const requiredQuantity = Number(body.requiredQuantity);
  if (!ngoRegistrationId || !item || !category || !unit || !Number.isFinite(requiredQuantity) || requiredQuantity <= 0) return badRequest("Choose an NGO and enter an item, category, positive quantity, and unit.");
  const [ngo] = await db.select({ id: registrationRecords.id, name: registrationRecords.name }).from(registrationRecords).where(and(eq(registrationRecords.registrationId, ngoRegistrationId), eq(registrationRecords.role, "ngo"))).limit(1);
  if (!ngo) return badRequest("The NGO registration ID was not found.");
  const requestedBy = typeof body.requiredBy === "string" && body.requiredBy ? new Date(body.requiredBy) : null;
  if (requestedBy && Number.isNaN(requestedBy.getTime())) return badRequest("Enter a valid required-by date.");
  const priority = ["low", "normal", "high", "urgent"].includes(String(body.priority)) ? String(body.priority) : "normal";
  const requirementId = `REQ-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  try {
    const [record] = await db.insert(ngoRequirements).values({
      requirementId,
      ngoRegistrationId,
      ngoName: ngo.name,
      item,
      category,
      requiredQuantity,
      unit,
      priority,
      requiredBy: requestedBy,
      location: typeof body.location === "string" ? body.location.trim() || null : null,
    }).returning();
    await Promise.all([
      writeAudit(admin, "requirement_created", "ngo_requirement", record.id, { requirementId, ngoRegistrationId }, requestIp(request)),
      createNotification("requirement", "New NGO requirement", `${ngo.name} needs ${requiredQuantity} ${unit} of ${item}.`, "requirement", record.id),
    ]);
    return Response.json({ record: { ...record, fulfilledQuantity: 0, remainingQuantity: requiredQuantity } }, { status: 201 });
  } catch {
    return Response.json({ error: "The requirement could not be saved." }, { status: 409 });
  }
}
