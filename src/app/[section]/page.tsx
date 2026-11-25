import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { sectionPermissions } from "@/lib/admin/permissions";
import AdminConsole from "@/components/admin/admin-console";

export const dynamic = "force-dynamic";
const sections = new Set(["volunteers", "ngos", "donors", "shelters", "donations", "requirements", "contributions", "verifications", "reports", "notifications", "settings"]);

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (!sectionPermissions[section]?.includes(admin.role)) notFound();
  return <AdminConsole section={section} admin={admin} />;
}
