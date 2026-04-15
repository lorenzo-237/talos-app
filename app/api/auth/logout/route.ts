import { NextResponse } from "next/server"
import { AUTH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth"
import { RIGHTS_COOKIE } from "@/lib/api-auth"

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(AUTH_TOKEN_COOKIE)
  response.cookies.delete(REFRESH_TOKEN_COOKIE)
  response.cookies.delete(RIGHTS_COOKIE)
  return response
}
