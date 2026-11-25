import { desc } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { pagination, forbidden, unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorized();
  if (admin.role !== "super_admin") return forbidden("Only a super administrator can view audit history.");
  const { page, limit, offset } = pagination(new URL(request.url));
  const rows = await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.occurredAt)).limit(limit).offset(offset);
  return Response.json({ records: rows, page, limit });
}
