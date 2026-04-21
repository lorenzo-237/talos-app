"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Package,
  Hammer,
  FolderOpen,
  History,
  LogOut,
  ShieldCheck,
  Archive,
  LayoutDashboard,
  Layers,
  Puzzle,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Construction",
    items: [
      { href: "/build", label: "Build", icon: Hammer, right: null },
      { href: "/history", label: "Historique", icon: History, right: "canViewHistory" },
      { href: "/releases", label: "Releases", icon: Archive, right: "canReadReleases" },
    ],
  },
  {
    label: "Ressources",
    items: [
      { href: "/packages", label: "Packages", icon: Package, right: "canReadPackages" },
      { href: "/explorer", label: "Explorateur", icon: FolderOpen, right: "canReadExplorer" },
    ],
  },
  {
    label: "Publication",
    items: [
      { href: "/logiciels", label: "Logiciels", icon: Layers, right: null },
      { href: "/elements", label: "Éléments", icon: Puzzle, right: null },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()

  const initials =
    user?.profile.initials ||
    user?.profile.uid?.slice(0, 2).toUpperCase() ||
    "?"

  function isVisible(item: NavItem): boolean {
    if (loading) return false
    return item.right === null || (user?.rights[item.right] ?? false)
  }

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <TooltipProvider>
      <Sidebar>
        <SidebarHeader className="border-b px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded bg-foreground text-background">
              <LayoutDashboard className="size-3.5" />
            </div>
            <span className="text-base font-semibold tracking-tight">
              Talos
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(isVisible)
            if (visibleItems.length === 0) return null
            return (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.href)}
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
            )
          })}
        </SidebarContent>

        <SidebarFooter className="gap-1">
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
