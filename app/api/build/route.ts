import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { v4 as uuidv4 } from "uuid"
import fs from "fs/promises"
import path from "path"
import { env } from "@/lib/env"
import { resolvePackageFolder } from "@/lib/version-resolver"
import { BuildLogger, buildRegistry } from "@/lib/build-logger"
import { buildPackage } from "@/lib/archive-builder"
import { appendHistory, updateHistoryRecord, saveBuildLogs } from "@/lib/history"
import { requireAuth } from "@/lib/api-auth"
import type { BuildStatus } from "@/types/build"

// Simple concurrency guard — prevents double-building same version+package
const activeBuilds = new Set<string>()

const buildSchema = z.object({
  version: z.string().min(1),
  packages: z.array(z.string()).min(1),
  keepTemp: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req, "canBuild")
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const parsed = buildSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { version, packages, keepTemp } = parsed.data

    let resolved
    try {
      resolved = await resolvePackageFolder(version, env.PACKAGES_DIR)
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 })
    }

    if (!resolved) {
      return NextResponse.json(
        { error: `No package folder found for version "${version}"` },
        { status: 404 }
      )
    }

    const buildId = uuidv4()
    const logger = new BuildLogger()
    buildRegistry.set(buildId, logger)

    const record = {
      buildId,
      version,
      resolvedVersion: resolved.resolvedVersion,
      packages,
      status: "running" as BuildStatus,
      startedAt: new Date().toISOString(),
      outputDir: env.OUTPUT_DIR,
    }
    await appendHistory(record)

    // Run build in background (no await)
    ;(async () => {
      let finalStatus: BuildStatus = "success"
      const lockKey = `${resolved.resolvedVersion}:${packages.join(",")}`

      if (activeBuilds.has(lockKey)) {
        logger.error(
          `Build already running for version ${resolved.resolvedVersion} with these packages`
        )
        logger.done()
        await updateHistoryRecord(buildId, {
          status: "error",
          endedAt: new Date().toISOString(),
        })
        return
      }

      activeBuilds.add(lockKey)
      try {
        for (const pkgName of packages) {
          const pkgFile = path.join(resolved.folder, `${pkgName}.json`)
          let pkgDef
          try {
            const raw = await fs.readFile(pkgFile, "utf-8")
            pkgDef = JSON.parse(raw)
          } catch (err) {
            logger.error(`Could not read package "${pkgName}": ${err}`)
            finalStatus = "partial"
            continue
          }

          try {
            const output = path.join(env.OUTPUT_DIR, version)
            await buildPackage(
              pkgDef,
              resolved.resolvedVersion,
              version,
              env.SRC_DIR,
              output,
              logger,
              keepTemp
            )
          } catch (err) {
            logger.error(`Package "${pkgName}" failed: ${err}`)
            if (finalStatus === "success") finalStatus = "partial"
          }
        }
      } finally {
        activeBuilds.delete(lockKey)
        logger.done()
        await updateHistoryRecord(buildId, {
          status: finalStatus,
          endedAt: new Date().toISOString(),
        })
        await saveBuildLogs(buildId, logger.allEntries)
      }
    })()

    return NextResponse.json({
      buildId,
      resolvedVersion: resolved.resolvedVersion,
    })
  } catch (err) {
    console.error("[POST /api/build]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
