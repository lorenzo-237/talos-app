import { NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"
import { AUTH_TOKEN_COOKIE } from "@/lib/auth"
import { requireAuth } from "@/lib/api-auth"

/**
 * Catch-all read-only proxy for the LDAP Pilot API.
 *
 * Forwards GET requests to:
 *   {LDAP_API_URL}/api/v1/pilot/{path}
 *
 * Auth: the talos_token cookie (LDAP JWT) is forwarded as Bearer.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const auth = requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const token = req.cookies.get(AUTH_TOKEN_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { path } = await params
  const apiPath = path.join("/")
  const upstream = new URL(`${env.LDAP_API_URL}/api/v1/pilot/${apiPath}`)

  // Forward all query params
  req.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value)
  })

  try {
    const res = await fetch(upstream.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    const data: unknown = await res.json().catch(() => ({ error: "Réponse invalide" }))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error("[GET /api/pilot]", upstream.toString(), err)
    return NextResponse.json({ error: "Erreur proxy LDAP" }, { status: 502 })
  }
}
