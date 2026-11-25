import { desc, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { foodDonations, ngoRequirements, registrationRecords } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { canManageRecords, unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ registrations: [], donations: [], requirements: [] });
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const [registrations, donations, requirements] = await Promise.all([
    canManageRecords(admin) ? db.select({ id: registrationRecords.id, registrationId: registrationRecords.registrationId, role: registrationRecords.role, name: registrationRecords.name, status: registrationRecords.verificationStatus }).from(registrationRecords).where(or(ilike(registrationRecords.name, pattern), ilike(registrationRecords.registrationId, pattern))).orderBy(desc(registrationRecords.registeredAt)).limit(5) : Promise.resolve([]),
    db.select({ id: foodDonations.id, donationId: foodDonations.donationId, donorName: foodDonations.donorName, foodItem: foodDonations.foodItem, status: foodDonations.status }).from(foodDonations).where(or(ilike(foodDonations.donationId, pattern), ilike(foodDonations.foodItem, pattern), ilike(foodDonations.donorName, pattern))).orderBy(desc(foodDonations.createdAt)).limit(5),
    db.select({ id: ngoRequirements.id, requirementId: ngoRequirements.requirementId, ngoName: ngoRequirements.ngoName, item: ngoRequirements.item, status: ngoRequirements.status }).from(ngoRequirements).where(or(ilike(ngoRequirements.requirementId, pattern), ilike(ngoRequirements.ngoName, pattern), ilike(ngoRequirements.item, pattern))).orderBy(desc(ngoRequirements.createdAt)).limit(5),
  ]);
  return Response.json({ registrations, donations, requirements });
}
