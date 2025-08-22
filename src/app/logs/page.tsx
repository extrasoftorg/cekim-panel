import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LogsForm from '../../components/auth/logs-form'

export default async function LogsPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }
  
  const userRole = user.role.toLowerCase();
  const canSeeAdminPages = userRole === "admin" || userRole === "cekimsorumlusu";
  
  if (!canSeeAdminPages) {
    redirect("/withdraw");
  }

  return (
    <div><LogsForm /></div>
  )
}