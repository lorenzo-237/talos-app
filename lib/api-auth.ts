import { type NextRequest, NextResponse } from "next/server"
import { AUTH_TOKEN_COOKIE, type UserRights } from "@/lib/auth"

export const RIGHTS_COOKIE = "talos_rights"

export const RIGHTS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24, // 24h — aligned with auth token lifetime
  path: "/",
}

export function serializeRights(rights: UserRights): string {
  return JSON.stringify(rights)
}

export function parseRights(raw: string): UserRights | null {
  try {
    return JSON.parse(raw) as UserRights
  } catch {
    return null
  }
}

/**
 * Checks that the request has a valid session and optionally that the user
 * has a specific right.
 *
 * Returns `{ rights }` on success, or a `NextResponse` error to return early.
 *
 * Usage:
 *   const auth = requireAuth(req, "canBuild")
 *   if (auth instanceof NextResponse) return auth
 */
export function requireAuth(
  req: NextRequest,
  right?: keyof UserRights
): { rights: UserRights } | NextResponse {
  const token = req.cookies.get(AUTH_TOKEN_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const rawRights = req.cookies.get(RIGHTS_COOKIE)?.value
  if (!rawRights) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const rights = parseRights(rawRights)
  if (!rights) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 })
  }

  if (right && !rights[right]) {
    return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 })
  }

  return { rights }
}
