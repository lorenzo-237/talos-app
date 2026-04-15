import { NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"
import { AUTH_TOKEN_COOKIE, buildAuthUser, type UserMeResponse } from "@/lib/auth"
import { RIGHTS_COOKIE, RIGHTS_COOKIE_OPTIONS, serializeRights } from "@/lib/api-auth"

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.cookies.get(AUTH_TOKEN_COOKIE)?.value
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const meRes = await fetch(`${env.LDAP_API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!meRes.ok) {
      if (meRes.status === 401) {
        return NextResponse.json({ error: "TOKEN_EXPIRED" }, { status: 401 })
      }
      return NextResponse.json(
        { error: "Impossible de récupérer le profil" },
        { status: 500 }
      )
    }

    const me = (await meRes.json()) as UserMeResponse
    const user = buildAuthUser(me)

    // Refresh rights cookie with latest data from remote
    const response = NextResponse.json({ user })
    response.cookies.set(RIGHTS_COOKIE, serializeRights(user.rights), RIGHTS_COOKIE_OPTIONS)
    return response
  } catch (err) {
    console.error("[GET /api/auth/me]", err)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
