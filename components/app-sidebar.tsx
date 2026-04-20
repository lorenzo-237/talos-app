"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Package,
  Hammer,
  FolderOpen,
  History,
  Anvil,
  LogOut,
  ShieldCheck,
  Archive,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import SettingsPopover from "./settings-popover"
import { useAuth } from "@/contexts/auth-context"
import type { UserRights } from "@/lib/auth"
import { Button } from "./ui/button"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  right: keyof UserRights | null
}

const navItems: NavItem[] = [
  { href: "/", label: "Build", icon: Hammer, right: null },
  {
    href: "/packages",
    label: "Packages",
    icon: Package,
    right: "canReadPackages",
  },
  {
    href: "/explorer",
    label: "Explorateur",
    icon: FolderOpen,
    right: "canReadExplorer",
  },
  {
    href: "/history",
    label: "Historique",
    icon: History,
    right: "canViewHistory",
  },
  {
    href: "/releases",
    label: "Releases",
    icon: Archive,
    right: "canReadReleases",
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()

  const visibleItems = navItems.filter(
    (item) => item.right === null || (user?.rights[item.right] ?? false)
  )

  const initials =
    user?.profile.initials ||
    user?.profile.uid?.slice(0, 2).toUpperCase() ||
    "?"

  return (
    <TooltipProvider>
      <Sidebar>
        <SidebarHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Anvil className="size-5" />
            <span className="text-base font-semibold tracking-tight">
              Talos
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {loading
                  ? null
                  : visibleItems.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.href}
                        >
                          <Link href={item.href}>
                            <item.icon className="size-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-1">
          {/* User info */}
          {user && (
            <>
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-tight font-medium">
                    {user.profile.displayName || user.profile.uid}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.profile.mail}
                  </p>
                </div>
                {user.isAdmin && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ShieldCheck className="size-4 shrink-0 text-primary" />
                    </TooltipTrigger>
                    <TooltipContent>Administrateur</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <SidebarSeparator />
            </>
          )}

          <SettingsPopover />

          <Button onClick={logout} variant="outline">
            <LogOut className="size-4" />
            Se déconnecter
          </Button>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  )
}
