import { NextRequest, NextResponse } from "next/server"
import { getHistory } from "@/lib/history"
import { requireAuth } from "@/lib/api-auth"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req, "canViewHistory")
  if (auth instanceof NextResponse) return auth

  try {
    const builds = await getHistory()
    return NextResponse.json({ builds })
  } catch (err) {
    console.error("[GET /api/history]", err)
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 })
  }
}
