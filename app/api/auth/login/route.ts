import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/lib/env"
import {
  AUTH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  AUTH_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  buildAuthUser,
  type UserMeResponse,
} from "@/lib/auth"
import {
  RIGHTS_COOKIE,
  RIGHTS_COOKIE_OPTIONS,
  serializeRights,
} from "@/lib/api-auth"
import setCookie from "set-cookie-parser"

const loginSchema = z.object({
  uid: z.string().min(1),
  password: z.string().min(1),
  remember_me: z.boolean().default(false),
})

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
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 })
    }

    const { uid, password, remember_me } = parsed.data

    const loginRes = await fetch(`${env.LDAP_API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, password, remember_me }),
    })

    const cookies = setCookie.parse(loginRes.headers.getSetCookie())
    let refresh_token
    if (remember_me) {
      refresh_token = cookies.find((c) => c.name === "refresh_token")?.value
    }

    if (!loginRes.ok) {
      const data = await loginRes.json().catch(() => null)
      if (loginRes.status === 422 && data?.detail?.[0]?.msg) {
        return NextResponse.json({ error: data.detail[0].msg }, { status: 401 })
      }
      return NextResponse.json(
        { error: "Identifiants invalides" },
        { status: 401 }
      )
    }

    const loginData = (await loginRes.json()) as {
      success: boolean
      token: string
      refresh_token?: string
    }

    loginData.refresh_token = refresh_token

    // Fetch profile + rights
    const meRes = await fetch(`${env.LDAP_API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    })

    if (!meRes.ok) {
      return NextResponse.json(
        { error: "Impossible de récupérer le profil" },
        { status: 500 }
      )
    }

    const me = (await meRes.json()) as UserMeResponse
    const user = buildAuthUser(me)

    const response = NextResponse.json({ user })

    response.cookies.set(
      AUTH_TOKEN_COOKIE,
      loginData.token,
      setCookieOptions(AUTH_TOKEN_MAX_AGE)
    )

    response.cookies.set(
      RIGHTS_COOKIE,
      serializeRights(user.rights),
      RIGHTS_COOKIE_OPTIONS
    )

    if (remember_me && loginData.refresh_token) {
      response.cookies.set(
        REFRESH_TOKEN_COOKIE,
        loginData.refresh_token,
        setCookieOptions(REFRESH_TOKEN_MAX_AGE)
      )
    }

    return response
  } catch (err) {
    console.error("[POST /api/auth/login]", err)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
