import { NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"
import {
  AUTH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  AUTH_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  buildAuthUser,
  type UserMeResponse,
} from "@/lib/auth"
import { RIGHTS_COOKIE, RIGHTS_COOKIE_OPTIONS, serializeRights } from "@/lib/api-auth"

function setCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value
    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 })
    }

    const refreshRes = await fetch(`${env.LDAP_API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${refreshToken}` },
    })

    if (!refreshRes.ok) {
      const response = NextResponse.json(
        { error: "SESSION_EXPIRED" },
        { status: 401 }
      )
      response.cookies.delete(AUTH_TOKEN_COOKIE)
      response.cookies.delete(REFRESH_TOKEN_COOKIE)
      response.cookies.delete(RIGHTS_COOKIE)
      return response
    }

    const data = (await refreshRes.json()) as {
      token: string
      refresh_token: string
    }

    // Fetch fresh rights with new token
    const meRes = await fetch(`${env.LDAP_API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${data.token}` },
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set(AUTH_TOKEN_COOKIE, data.token, setCookieOptions(AUTH_TOKEN_MAX_AGE))
    response.cookies.set(REFRESH_TOKEN_COOKIE, data.refresh_token, setCookieOptions(REFRESH_TOKEN_MAX_AGE))

    if (meRes.ok) {
      const me = (await meRes.json()) as UserMeResponse
      const user = buildAuthUser(me)
      response.cookies.set(RIGHTS_COOKIE, serializeRights(user.rights), RIGHTS_COOKIE_OPTIONS)
    }

    return response
  } catch (err) {
    console.error("[POST /api/auth/refresh]", err)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
