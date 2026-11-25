import { and, asc, count, desc, ilike, inArray, or, type SQL } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { registrationRecords } from "@/db/schema";
import { getCurrentAdmin, writeAudit, createNotification } from "@/lib/admin/auth";
import { badRequest, canManageOperations, canManageRecords, isObject, pagination, requestIp, unauthorized, forbidden } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
const validRoles = ["volunteer", "ngo", "donor", "gaushala", "sanctuary"] as const;

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (!canManageRecords(admin)) return forbidden("Your role does not allow access to registration records.");

  const url = new URL(request.url);
  const { page, limit, offset } = pagination(url);
  const requestedRole = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const accountStatus = url.searchParams.get("accountStatus");
  const sort = url.searchParams.get("sort") ?? "registeredAt";
  const direction = url.searchParams.get("direction") === "asc" ? "asc" : "desc";
  const sortColumn = sort === "name" ? registrationRecords.name : sort === "registrationId" ? registrationRecords.registrationId : sort === "verificationStatus" ? registrationRecords.verificationStatus : registrationRecords.registeredAt;
  const order = direction === "asc" ? asc(sortColumn) : desc(sortColumn);
  const search = url.searchParams.get("q")?.trim();
  const filters: SQL[] = [];
  if (requestedRole === "shelters") filters.push(inArray(registrationRecords.role, ["gaushala", "sanctuary"]));
  else if (requestedRole && (validRoles as readonly string[]).includes(requestedRole)) filters.push(inArray(registrationRecords.role, [requestedRole]));
  if (status === "needs_review") filters.push(inArray(registrationRecords.verificationStatus, ["pending", "info_requested"]));
  else if (status && status !== "all") filters.push(inArray(registrationRecords.verificationStatus, [status]));
  if (accountStatus && accountStatus !== "all") filters.push(inArray(registrationRecords.accountStatus, [accountStatus]));
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(
      ilike(registrationRecords.name, pattern),
      ilike(registrationRecords.registrationId, pattern),
      ilike(registrationRecords.email, pattern),
      ilike(registrationRecords.phone, pattern),
    ) as SQL);
  }
  const where = filters.length ? and(...filters) : undefined;
  const [records, totalResult] = await Promise.all([
    db.select({
      id: registrationRecords.id,
      registrationId: registrationRecords.registrationId,
      role: registrationRecords.role,
      name: registrationRecords.name,
      email: registrationRecords.email,
      phone: registrationRecords.phone,
      verificationStatus: registrationRecords.verificationStatus,
      accountStatus: registrationRecords.accountStatus,
      registeredAt: registrationRecords.registeredAt,
      verifiedAt: registrationRecords.verifiedAt,
      assignedOrganization: registrationRecords.assignedOrganization,
      profile: registrationRecords.profile,
    }).from(registrationRecords).where(where).orderBy(order).limit(limit).offset(offset),
    db.select({ total: count() }).from(registrationRecords).where(where),
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
    return badRequest("Enter valid registration details.");
  }
  const role = String(body.role ?? "");
  const name = String(body.name ?? "").trim();
  if (!(validRoles as readonly string[]).includes(role)) return badRequest("Choose a supported account type.");
  if (!name || name.length > 160) return badRequest("A name between 1 and 160 characters is required.");
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Enter a valid email address.");
  const suppliedId = typeof body.registrationId === "string" ? body.registrationId.trim() : "";
  const prefix = role === "volunteer" ? "VOL" : role === "ngo" ? "NGO" : role === "donor" ? "DON" : role === "gaushala" ? "GAU" : "SAN";
  const registrationId = suppliedId || `${prefix}-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const profile = isObject(body.profile) ? body.profile : {};
  const registeredAt = typeof body.registeredAt === "string" && !Number.isNaN(Date.parse(body.registeredAt)) ? new Date(body.registeredAt) : new Date();

  try {
    const [record] = await db.insert(registrationRecords).values({
      registrationId,
      role,
      name,
      email,
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      assignedOrganization: typeof body.assignedOrganization === "string" ? body.assignedOrganization.trim() || null : null,
      verificationStatus: "pending",
      registeredAt,
      profile,
    }).returning();
    await Promise.all([
      writeAudit(admin, "registration_created", role, record.id, { registrationId, name }, requestIp(request)),
      createNotification("registration", `New ${role} record`, `${name} was added to the registration register.`, "registration", record.id),
    ]);
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.toLowerCase().includes("unique")
      ? "That registration ID is already in use."
      : "The registration could not be saved.";
    return Response.json({ error: message }, { status: 409 });
  }
}
