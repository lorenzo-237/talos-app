import { NextRequest, NextResponse } from "next/server"
import { getBuildLogs } from "@/lib/history"
import { requireAuth } from "@/lib/api-auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
): Promise<NextResponse> {
  const auth = requireAuth(_req, "canViewHistory")
  if (auth instanceof NextResponse) return auth

  try {
    const { buildId } = await params
    const logs = await getBuildLogs(buildId)
    if (!logs) {
      return NextResponse.json({ error: "Logs not found" }, { status: 404 })
    }
    return NextResponse.json({ logs })
  } catch (err) {
    console.error("[GET /api/history/[buildId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
