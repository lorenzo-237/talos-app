import { NextResponse } from "next/server"
import { getHistory } from "@/lib/history"

export async function GET(): Promise<NextResponse> {
  try {
    const builds = await getHistory()
    return NextResponse.json({ builds })
  } catch (err) {
    console.error("[GET /api/history]", err)
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 })
  }
}
