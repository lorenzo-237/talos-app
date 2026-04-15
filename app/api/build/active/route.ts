import { NextRequest, NextResponse } from "next/server"
import { runningBuilds } from "@/lib/running-builds"
import { requireAuth } from "@/lib/api-auth"

/**
 * GET /api/build/active
 *
 * Returns all currently running builds so any client can detect an ongoing
 * build and connect to its log stream — regardless of who launched it.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req, "canBuild")
  if (auth instanceof NextResponse) return auth

  return NextResponse.json({ builds: await runningBuilds.getAll() })
}
