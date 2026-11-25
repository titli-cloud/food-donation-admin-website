import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adminNotifications } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { pagination, unauthorized } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getCurrentAdmin())) return unauthorized();
  const url = new URL(request.url);
  const { page, limit, offset } = pagination(url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const where = unreadOnly ? isNull(adminNotifications.readAt) : undefined;
  const [notifications, unreadResult, totalResult] = await Promise.all([
    db.select().from(adminNotifications).where(where).orderBy(desc(adminNotifications.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(adminNotifications).where(isNull(adminNotifications.readAt)),
    db.select({ total: count() }).from(adminNotifications).where(where),
  ]);
  const total = Number(totalResult[0]?.total ?? 0);
  return Response.json({ notifications, unreadCount: Number(unreadResult[0]?.total ?? 0), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function PATCH(request: Request) {
  if (!(await getCurrentAdmin())) return unauthorized();
  let body: { markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter valid notification details." }, { status: 400 });
  }
  if (body.markAllRead) {
    await db.update(adminNotifications).set({ readAt: new Date() }).where(isNull(adminNotifications.readAt));
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Choose a notification to update." }, { status: 400 });
}
