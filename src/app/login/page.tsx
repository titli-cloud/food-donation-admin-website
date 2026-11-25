import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/auth";
import LoginScreen from "@/components/admin/login-screen";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentAdmin()) redirect("/");
  return <LoginScreen />;
}
