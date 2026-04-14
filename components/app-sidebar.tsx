"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Package, Hammer, FolderOpen, History, Anvil } from "lucide-react"
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
} from "@/components/ui/sidebar"

import SettingsPopover from "./settings-popover"

const navItems = [
  { href: "/", label: "Build", icon: Hammer },
  { href: "/packages", label: "Packages", icon: Package },
  { href: "/explorer", label: "Explorateur", icon: FolderOpen },
  { href: "/history", label: "Historique", icon: History },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex gap-1">
          <Anvil />
          <span className="text-base font-semibold tracking-tight">Talos</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SettingsPopover />
      </SidebarFooter>
    </Sidebar>
  )
}
