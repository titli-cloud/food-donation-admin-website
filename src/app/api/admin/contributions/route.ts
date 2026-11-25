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
  if (status && status !== "all") filters.push(inArray(contributions.status, [status]));
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(contributions.contributionId, pattern), ilike(contributions.donorName, pattern), ilike(contributions.ngoName, pattern), ilike(contributions.requirementId, pattern)) as SQL);
  }
  const where = filters.length ? and(...filters) : undefined;
  const [records, totalResult] = await Promise.all([
    db.select().from(contributions).where(where).orderBy(desc(contributions.contributedAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(contributions).where(where),
  ]);
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
    return badRequest("Enter valid contribution details.");
  }
  const requirementId = String(body.requirementId ?? "").trim();
  const offered = Number(body.quantityOffered);
  const donorNameInput = String(body.donorName ?? "").trim();
  if (!requirementId || !donorNameInput || !Number.isFinite(offered) || offered <= 0) return badRequest("Choose a requirement, donor, and positive offered quantity.");
  const [requirement] = await db.select().from(ngoRequirements).where(eq(ngoRequirements.requirementId, requirementId)).limit(1);
  if (!requirement || !["open", "in_progress"].includes(requirement.status)) return badRequest("The selected requirement is not open for contributions.");
  const donorRegistrationId = typeof body.donorRegistrationId === "string" ? body.donorRegistrationId.trim() : "";
  let donorName = donorNameInput;
  if (donorRegistrationId) {
    const [donor] = await db.select({ name: registrationRecords.name }).from(registrationRecords).where(and(eq(registrationRecords.registrationId, donorRegistrationId), eq(registrationRecords.role, "donor"))).limit(1);
    if (!donor) return badRequest("The donor registration ID was not found.");
    donorName = donor.name;
  }
  const contributionId = `CON-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  try {
    const [record] = await db.insert(contributions).values({
      contributionId,
      donorRegistrationId: donorRegistrationId || null,
      donorName,
      ngoRegistrationId: requirement.ngoRegistrationId,
      ngoName: requirement.ngoName,
      requirementId: requirement.requirementId,
      item: requirement.item,
      quantityOffered: offered,
      unit: requirement.unit,
      deliveryPreference: typeof body.deliveryPreference === "string" ? body.deliveryPreference.trim() || null : null,
    }).returning();
    await Promise.all([
      writeAudit(admin, "contribution_created", "contribution", record.id, { contributionId, requirementId, offered }, requestIp(request)),
      createNotification("contribution", "New contribution offer", `${donorName} offered ${offered} ${requirement.unit} of ${requirement.item} to ${requirement.ngoName}.`, "contribution", record.id),
    ]);
    return Response.json({ record }, { status: 201 });
  } catch {
    return Response.json({ error: "The contribution could not be saved." }, { status: 409 });
  }
}
