import { NextRequest, NextResponse } from "next/server"
import { AUTH_TOKEN_COOKIE } from "@/lib/auth"

// Paths that don't require authentication
const PUBLIC_PREFIXES = [
  "/login",
  "/unauthorized",
  "/api/auth",
  "/_next",
  "/favicon.ico",
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get(AUTH_TOKEN_COOKIE)?.value
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
