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
import { PackageDefinitionSchema } from "@/types/package-schema"
import { runningBuilds } from "@/lib/running-builds"
import { requireAuth } from "@/lib/api-auth"
import { isCancelled, clearCancellation } from "@/lib/build-cancellation"
import type { BuildStatus } from "@/types/build"

// Simple concurrency guard — prevents double-building same version+package
// Anchored on globalThis so Turbopack hot-reloads don't create a fresh instance
declare global {
  var __activeBuilds: Set<string> | undefined
}
const activeBuilds: Set<string> =
  globalThis.__activeBuilds ?? new Set()
globalThis.__activeBuilds = activeBuilds

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

    // Check concurrency BEFORE any registration to avoid orphaned history records
    const lockKey = `${resolved.resolvedVersion}:${packages.join(",")}`
    if (activeBuilds.has(lockKey)) {
      return NextResponse.json(
        {
          error: `Build already running for version ${resolved.resolvedVersion} with these packages`,
        },
        { status: 409 }
      )
    }

    const buildId = uuidv4()
    const startedAt = new Date().toISOString()
    const logger = new BuildLogger()
    buildRegistry.set(buildId, logger)

    // Register as running so every client can detect it via GET /api/build/active
    await runningBuilds.add({
      buildId,
      version,
      resolvedVersion: resolved.resolvedVersion,
      packages,
      startedAt,
    })

    const record = {
      buildId,
      version,
      resolvedVersion: resolved.resolvedVersion,
      packages,
      status: "running" as BuildStatus,
      startedAt,
      outputDir: env.OUTPUT_DIR,
    }
    await appendHistory(record)

    // Run build in background (no await)
    ;(async () => {
      let finalStatus: BuildStatus = "success"

      activeBuilds.add(lockKey)
      try {
        for (const pkgName of packages) {
          if (isCancelled(buildId)) {
            logger.warn("Build annulé par l'opérateur")
            finalStatus = "cancelled"
            break
          }

          const pkgFile = path.join(resolved.folder, `${pkgName}.json`)
          let pkgDef
          try {
            const raw = await fs.readFile(pkgFile, "utf-8")
            const parsed = PackageDefinitionSchema.safeParse(JSON.parse(raw))
            if (!parsed.success) {
              logger.error(
                `Package "${pkgName}" invalide : ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`
              )
              finalStatus = "partial"
              continue
            }
            pkgDef = parsed.data
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
              buildId,
              keepTemp
            )
          } catch (err) {
            logger.error(`Package "${pkgName}" failed: ${err}`)
            if (finalStatus === "success") finalStatus = "partial"
          }
        }
      } finally {
        clearCancellation(buildId)
        activeBuilds.delete(lockKey)
        await runningBuilds.remove(buildId)
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
