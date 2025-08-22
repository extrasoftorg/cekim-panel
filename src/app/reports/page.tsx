import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ReportsForm from '../../components/auth/reports-form'

export default async function ReportsPage() {
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
    <div><ReportsForm /></div>
  )
}