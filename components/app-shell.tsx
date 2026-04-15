"use client"

import { usePathname } from "next/navigation"
import { AuthProvider } from "@/contexts/auth-context"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

const NO_SHELL_PATHS = ["/login", "/unauthorized"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showShell = !NO_SHELL_PATHS.includes(pathname)

  if (!showShell) {
    return <AuthProvider>{children}</AuthProvider>
  }

  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 items-center border-b px-4">
            <SidebarTrigger className="-ml-1" />
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}
