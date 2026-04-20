import { createHmac, timingSafeEqual } from "crypto"
import { type NextRequest, NextResponse } from "next/server"
import { AUTH_TOKEN_COOKIE, type UserRights } from "@/lib/auth"
import { env } from "@/lib/env"

export const RIGHTS_COOKIE = "talos_rights"

export const RIGHTS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24, // 24h — aligned with auth token lifetime
  path: "/",
}

/**
 * Serialize and HMAC-sign the rights object.
 * Format: base64url(json).base64url(hmac)
 */
export function serializeRights(rights: UserRights): string {
  const payload = Buffer.from(JSON.stringify(rights)).toString("base64url")
  const sig = createHmac("sha256", env.RIGHTS_SECRET)
    .update(payload)
    .digest("base64url")
  return `${payload}.${sig}`
}

/**
 * Verify the HMAC signature and return the rights, or null if invalid.
 */
export function parseRights(raw: string): UserRights | null {
  try {
    const dot = raw.lastIndexOf(".")
    if (dot === -1) return null
    const payload = raw.slice(0, dot)
    const sig = raw.slice(dot + 1)
    const expected = createHmac("sha256", env.RIGHTS_SECRET)
      .update(payload)
      .digest("base64url")
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null
    }
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as UserRights
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
