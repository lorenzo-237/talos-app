import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { runningBuilds } from "@/lib/running-builds"
import { requireAuth } from "@/lib/api-auth"
import { requestCancellation } from "@/lib/build-cancellation"

/**
 * GET /api/build/active
 *
 * Returns all currently running builds so any client can detect an ongoing
 * build and connect to its log stream — regardless of who launched it.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req)
  if (auth instanceof NextResponse) return auth

  return NextResponse.json({ builds: await runningBuilds.getAll() })
}

const cancelSchema = z.object({ buildId: z.string().min(1) })

/**
 * DELETE /api/build/active
 *
 * Request a cooperative cancellation of the running build.
 * The build loop checks for cancellation between packages and stops early.
 * The SSE stream will still emit a "done" event once cleanup completes.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { rights } = auth
  if (!rights.canBuildProd && !rights.canBuildTest && !rights.canBuildDev) {
    return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "buildId requis" }, { status: 400 })
    }

    const { buildId } = parsed.data
    const builds = await runningBuilds.getAll()
    const running = builds.find((b) => b.buildId === buildId)

    if (!running) {
      return NextResponse.json(
        { error: "Aucun build actif avec cet identifiant" },
        { status: 404 }
      )
    }

    requestCancellation(buildId)
    await runningBuilds.requestCancel(buildId)
    return NextResponse.json({ cancelled: true })
  } catch (err) {
    console.error("[DELETE /api/build/active]", err)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }
}
