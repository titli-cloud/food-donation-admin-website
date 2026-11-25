import { and, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adminNotifications,
  contributions,
  foodDonations,
  ngoRequirements,
  registrationRecords,
} from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCurrentAdmin())) return unauthorized();

  const [registrationsByRole, verificationStatuses, donationStatuses, requirementStatuses, contributionStatuses, unreadResult, recentRegistrations, recentDonations, recentVerifications, recentNotifications] = await Promise.all([
    db.select({ role: registrationRecords.role, total: count() }).from(registrationRecords).groupBy(registrationRecords.role),
    db.select({ status: registrationRecords.verificationStatus, total: count() }).from(registrationRecords).groupBy(registrationRecords.verificationStatus),
    db.select({ status: foodDonations.status, total: count() }).from(foodDonations).groupBy(foodDonations.status),
    db.select({ status: ngoRequirements.status, total: count() }).from(ngoRequirements).groupBy(ngoRequirements.status),
    db.select({ status: contributions.status, total: count() }).from(contributions).groupBy(contributions.status),
    db.select({ total: count() }).from(adminNotifications).where(isNull(adminNotifications.readAt)),
    db.select({ id: registrationRecords.id, registrationId: registrationRecords.registrationId, role: registrationRecords.role, name: registrationRecords.name, email: registrationRecords.email, verificationStatus: registrationRecords.verificationStatus, registeredAt: registrationRecords.registeredAt }).from(registrationRecords).orderBy(desc(registrationRecords.registeredAt)).limit(6),
    db.select({ id: foodDonations.id, donationId: foodDonations.donationId, donorName: foodDonations.donorName, foodItem: foodDonations.foodItem, quantity: foodDonations.quantity, unit: foodDonations.unit, status: foodDonations.status, createdAt: foodDonations.createdAt, safeUntil: foodDonations.safeUntil }).from(foodDonations).orderBy(desc(foodDonations.createdAt)).limit(6),
    db.select({ id: registrationRecords.id, registrationId: registrationRecords.registrationId, role: registrationRecords.role, name: registrationRecords.name, registeredAt: registrationRecords.registeredAt, verificationStatus: registrationRecords.verificationStatus }).from(registrationRecords).where(inArray(registrationRecords.verificationStatus, ["pending", "info_requested"])).orderBy(desc(registrationRecords.registeredAt)).limit(6),
    db.select({ id: adminNotifications.id, type: adminNotifications.type, title: adminNotifications.title, message: adminNotifications.message, createdAt: adminNotifications.createdAt, readAt: adminNotifications.readAt, targetType: adminNotifications.targetType, targetId: adminNotifications.targetId }).from(adminNotifications).orderBy(desc(adminNotifications.createdAt)).limit(5),
  ]);

  const roleCount = (role: string) => Number(registrationsByRole.find((row) => row.role === role)?.total ?? 0);
  const statusCount = (rows: { status: string; total: number }[], statuses: string[]) =>
    rows.filter((row) => statuses.includes(row.status)).reduce((total, row) => total + Number(row.total), 0);
  const donationActive = statusCount(donationStatuses, ["available", "requested", "accepted", "pickup_scheduled", "picked_up", "delivered"]);
  const openRequirements = statusCount(requirementStatuses, ["open", "in_progress"]);
  const pendingContributions = statusCount(contributionStatuses, ["offered", "accepted", "scheduled", "in_transit"]);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const donationsThisWeek = await db
    .select({ day: sql<string>`to_char(date_trunc('day', ${foodDonations.createdAt}), 'YYYY-MM-DD')`, total: count() })
    .from(foodDonations)
    .where(and(gt(foodDonations.createdAt, weekStart), sql`${foodDonations.createdAt} <= now()`))
    .groupBy(sql`date_trunc('day', ${foodDonations.createdAt})`)
    .orderBy(sql`date_trunc('day', ${foodDonations.createdAt})`);

  return Response.json({
    totals: {
      volunteers: roleCount("volunteer"),
      ngos: roleCount("ngo"),
      donors: roleCount("donor"),
      shelters: roleCount("gaushala") + roleCount("sanctuary"),
      pendingVerifications: statusCount(verificationStatuses, ["pending", "info_requested"]),
      activeDonations: donationActive,
      openRequirements,
      pendingContributions,
      unreadNotifications: Number(unreadResult[0]?.total ?? 0),
    },
    recentRegistrations,
    recentDonations,
    pendingApprovals: recentVerifications,
    notifications: recentNotifications,
    donationsThisWeek,
  });
}
