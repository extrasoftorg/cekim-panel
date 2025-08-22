import React from 'react'
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Users from "../../components/auth/users-form";

export default async function UsersPage() {
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
        <div><Users /></div>
    )
}