"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, PlayCircle, History, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import  ActivityDropdown  from "@/components/activity-dropdown";

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
]

export function Navbar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col w-full">
      {/* Üst Bar */}
      <div className="bg-card text-primary px-6 py-3 flex justify-between items-center border-b border-primary/50">
        <div className="text-2xl font-bold ml-20">ÇEKİM</div>
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

      {/* Alt Navigasyon - Ortalanmış */}
      <div className="bg-card border-b border-primary/50 px-6 py-2">
        <div className="flex items-center justify-center space-x-4">
          {navItems.map((item) => {
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
