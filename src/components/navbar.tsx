"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, PlayCircle, History, Sun, Moon, Users, FileText, ClipboardList, } from "lucide-react"
import { Button } from "@/components/ui/button"
import LoadingSpinner from "@/components/loading-spinner"
import { useTheme } from "next-themes"
import ActivityDropdown from "@/components/activity-dropdown";
import { useQuery } from "@tanstack/react-query";

const navItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Aktif Çekimler",
    href: "/withdraw",
    icon: PlayCircle,
  },
  {
    name: "Geçmiş Çekimler",
    href: "/past-withdrawals",
    icon: History,
  },
  {
    name: "Personeller",
    href: "/users",
    icon: Users
  },
  {
    name: "Log Kayıtları",
    href: "/logs",
    icon: FileText,
  },
  {
    name: "Raporlar",
    href: "/reports",
    icon: ClipboardList
  }
]

interface CurrentUser {
  id: string
  role: string
  username: string
}

const fetchCurrentUser = async () => {
  const response = await fetch('/api/current-user', { credentials: "include" })
  if (!response.ok) {
    throw new Error(`Kullanıcı bilgisi alınamadı: ${response.status}`)
  }

  const result = await response.json()
  return result.data
}

export function Navbar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const { data: currentUser, isLoading: currentUserLoading, error: currentUserError } = useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser
  })

  if (currentUserLoading) {
    return (
              <LoadingSpinner message="Yükleniyor..." size="sm" />
    )
  }

  if (currentUserError) {
    return <div className="text-red-500">Hata: {currentUserError.message}</div>
  }
  if (!currentUser) {
    return <div className="text-red-500">Hata: Kullanıcı bilgisi alınamadı</div>
  }

  const userRole = currentUser.role?.toLowerCase()
  const canSeeUsers = userRole === "admin" || userRole === "cekimsorumlusu"

  return (
    <div className="flex flex-col w-full">
      {/* Üst */}
      <div className="bg-card text-primary px-6 py-3 flex justify-between items-center border-b border-primary/30">
        <div className="text-2xl font-bold ml-25">ÇEKİM</div>
        <ActivityDropdown />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="text-primary hover:text-primary/90 hover:bg-primary/10"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="sr-only">Tema Değiştir</span>
        </Button>
      </div>

      {/* Alt */}
      <div className="bg-card border-b border-primary/30 px-6 py-2">
        <div className="flex items-center justify-center space-x-4">
          {navItems.map((item) => {

            if((item.name === "Personeller" || item.name === "Log Kayıtları" || item.name === "Dashboard" || item.name === "Raporlar") && !canSeeUsers) {
              return null
            }
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
