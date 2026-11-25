import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adminNotifications } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { unauthorized } from "@/lib/admin/http";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return unauthorized();
  const { id } = await params;
  const [notification] = await db.update(adminNotifications).set({ readAt: new Date() }).where(eq(adminNotifications.id, id)).returning({ id: adminNotifications.id, readAt: adminNotifications.readAt });
  if (!notification) return Response.json({ error: "Notification not found." }, { status: 404 });
  return Response.json({ notification });
}
