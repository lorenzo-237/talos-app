import { NextRequest, NextResponse } from "next/server"
import { getBuildLogs } from "@/lib/history"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
): Promise<NextResponse> {
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
