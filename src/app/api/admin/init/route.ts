import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.ADMIN_DEMO_MODE === "true") {
    return Response.json({
      setupRequired: false,
      sessionConfigured: true,
      bootstrapConfigured: false,
      demoMode: true,
      demoEmail: DEMO_ADMIN_EMAIL,
      demoPassword: DEMO_ADMIN_PASSWORD,
    });
  }
  const [firstAdmin] = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  return Response.json({
    setupRequired: !firstAdmin,
    sessionConfigured: Boolean(process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 32),
    bootstrapConfigured: Boolean(process.env.ADMIN_BOOTSTRAP_TOKEN),
  });
}
