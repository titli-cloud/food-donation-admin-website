import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { contributions, foodDonations, ngoRequirements, registrationRecords } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export async function GET(request: Request) {
  if (!(await getCurrentAdmin())) return unauthorized();
  const url = new URL(request.url);
  const toInput = url.searchParams.get("to");
  const fromInput = url.searchParams.get("from");
  const now = new Date();
  const to = toInput ? new Date(`${toInput}T23:59:59.999Z`) : now;
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const from = fromInput ? new Date(`${fromInput}T00:00:00.000Z`) : defaultFrom;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return Response.json({ error: "Choose a valid reporting date range." }, { status: 400 });

  const [registrationRows, donationRows, totalVerifications, requirementRows, contributionRows, rescuedRows] = await Promise.all([
    db.select({ role: registrationRecords.role, registeredAt: registrationRecords.registeredAt }).from(registrationRecords).where(and(gte(registrationRecords.registeredAt, from), lte(registrationRecords.registeredAt, to))).orderBy(desc(registrationRecords.registeredAt)),
    db.select({ createdAt: foodDonations.createdAt, status: foodDonations.status }).from(foodDonations).where(and(gte(foodDonations.createdAt, from), lte(foodDonations.createdAt, to))).orderBy(desc(foodDonations.createdAt)),
    db.select({ total: count() }).from(registrationRecords).where(inArray(registrationRecords.verificationStatus, ["pending", "info_requested"])),
    db.select({ status: ngoRequirements.status, required: ngoRequirements.requiredQuantity }).from(ngoRequirements).where(and(gte(ngoRequirements.createdAt, from), lte(ngoRequirements.createdAt, to))),
    db.select({ status: contributions.status, quantityReceived: contributions.quantityReceived, contributedAt: contributions.contributedAt }).from(contributions).where(and(gte(contributions.contributedAt, from), lte(contributions.contributedAt, to))),
    db.select({ unit: foodDonations.unit, quantity: sql<number>`sum(${foodDonations.quantity})` }).from(foodDonations).where(and(inArray(foodDonations.status, ["delivered", "completed"]), gte(foodDonations.updatedAt, from), lte(foodDonations.updatedAt, to))).groupBy(foodDonations.unit),
  ]);

  const months = new Map<string, { month: string; volunteers: number; ngos: number; donors: number; shelters: number; donations: number }>();
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const finalMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= finalMonth) {
    const key = monthKey(cursor);
    months.set(key, { month: monthLabel(key), volunteers: 0, ngos: 0, donors: 0, shelters: 0, donations: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const row of registrationRows) {
    const item = months.get(monthKey(row.registeredAt));
    if (!item) continue;
    if (row.role === "volunteer") item.volunteers += 1;
    if (row.role === "ngo") item.ngos += 1;
    if (row.role === "donor") item.donors += 1;
    if (["gaushala", "sanctuary"].includes(row.role)) item.shelters += 1;
  }
  for (const row of donationRows) {
    const item = months.get(monthKey(row.createdAt));
    if (item) item.donations += 1;
  }
  const completedContributions = contributionRows.filter((row) => ["received", "completed"].includes(row.status));
  const fulfillment = requirementRows.reduce((sum, row) => sum + (["fulfilled", "closed"].includes(row.status) ? 1 : 0), 0);
  const monthly = Array.from(months.values());
  return Response.json({
    from: from.toISOString(),
    to: to.toISOString(),
    monthly,
    summary: {
      registrations: registrationRows.length,
      donations: donationRows.length,
      pendingVerifications: Number(totalVerifications[0]?.total ?? 0),
      openRequirements: requirementRows.filter((row) => ["open", "in_progress"].includes(row.status)).length,
      totalRequirements: requirementRows.length,
      fulfilledRequirements: fulfillment,
      completedContributions: completedContributions.length,
      receivedContributionQuantity: completedContributions.reduce((sum, row) => sum + Number(row.quantityReceived), 0),
    },
    rescuedByUnit: rescuedRows.map((row) => ({ unit: row.unit, quantity: Number(row.quantity ?? 0) })),
  });
}
