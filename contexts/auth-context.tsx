"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { hasAnyRight, type AuthUser, type UserRights } from "@/lib/auth"

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
})

export function useAuth(): AuthContextValue {
  return React.useContext(AuthContext)
}

// Convenience hook — redirect to /unauthorized if right is missing
export function useRequireRight(right: keyof UserRights): boolean {
  const { user, loading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading && user && !user.rights[right]) {
      router.replace("/unauthorized")
    }
  }, [loading, user, right, router])

  if (loading || !user) return false
  return user.rights[right]
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    // Skip auth check on public pages
    if (pathname === "/login" || pathname === "/unauthorized") {
      setLoading(false)
      return
    }

    async function fetchMe(): Promise<AuthUser | null> {
      const res = await fetch("/api/auth/me")
      if (res.ok) {
        const data = (await res.json()) as { user: AuthUser }
        return data.user
      }

      // Token expired — try refresh
      if (res.status === 401) {
        const data = await res.json().catch(() => null)
        if (data?.error === "TOKEN_EXPIRED") {
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
          })
          if (refreshRes.ok) {
            const retryRes = await fetch("/api/auth/me")
            if (retryRes.ok) {
              const retryData = (await retryRes.json()) as { user: AuthUser }
              return retryData.user
            }
          }
        }
      }

      return null
    }

    async function init() {
      try {
        const u = await fetchMe()
        if (!u) {
          router.replace("/login")
          return
        }
        // No talos rights at all → forge interdite
        if (!hasAnyRight(u.rights)) {
          setUser(u)
          router.replace("/unauthorized")
          return
        }
        setUser(u)
      } catch {
        router.replace("/login")
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [pathname, router])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    router.replace("/login")
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
