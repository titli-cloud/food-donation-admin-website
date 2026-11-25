import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/auth";
import AdminConsole from "@/components/admin/admin-console";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return <AdminConsole section="dashboard" admin={admin} />;
}
