import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardForm } from "@/components/auth/dashboard-form";

export default async function Home() {
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
    <div>
      <DashboardForm />
    </div>
  );
}