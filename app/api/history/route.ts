import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getHistory, deleteBuilds } from "@/lib/history"
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

const deleteSchema = z.union([
  z.object({ buildIds: z.array(z.string().min(1)).min(1) }),
  z.object({ before: z.string().datetime() }),
])

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req, "canBuild")
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      )
    }

    let buildIds: string[]

    if ("buildIds" in parsed.data) {
      buildIds = parsed.data.buildIds
    } else {
      const before = new Date(parsed.data.before)
      const builds = await getHistory()
      buildIds = builds
        .filter((b) => new Date(b.startedAt) < before)
        .map((b) => b.buildId)
    }

    if (buildIds.length > 0) {
      await deleteBuilds(buildIds)
    }

    return NextResponse.json({ deleted: buildIds.length })
  } catch (err) {
    console.error("[DELETE /api/history]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
