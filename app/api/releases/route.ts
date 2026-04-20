import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import fs from "fs/promises"
import path from "path"
import { getOutputDir } from "@/lib/env"
import { requireAuth } from "@/lib/api-auth"
import type { Environment } from "@/types/build"

export interface ReleasePackage {
  /** Package output folder name, e.g. "Medoc_3.3.3.1" */
  name: string
  /** Input version the package was built for, e.g. "3.3.3.1" */
  version: string
  /** Folder last-modified time */
  updatedAt: string
}

const environmentSchema = z.enum(["prod", "test", "dev"])

// ── GET /api/releases?env=prod&version=3.3.3.1 ────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req, "canReadReleases")
  if (auth instanceof NextResponse) return auth

  const { searchParams } = req.nextUrl
  const envParam = searchParams.get("env")
  const versionFilter = searchParams.get("version") ?? null

  const envParsed = environmentSchema.safeParse(envParam)
  if (!envParsed.success) {
    return NextResponse.json(
      { error: "Paramètre env invalide (prod | test | dev)" },
      { status: 400 }
    )
  }

  const environment = envParsed.data as Environment
  const outputDir = getOutputDir(environment)

  try {
    await fs.access(outputDir)
  } catch {
    return NextResponse.json({ packages: [] })
  }

  const packages: ReleasePackage[] = []

  if (versionFilter) {
    // Scan only the requested version subdirectory
    const versionDir = path.join(outputDir, versionFilter)
    try {
      const entries = await fs.readdir(versionDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const stat = await fs.stat(path.join(versionDir, entry.name))
        packages.push({
          name: entry.name,
          version: versionFilter,
          updatedAt: stat.mtime.toISOString(),
        })
      }
    } catch {
      // Version dir doesn't exist — return empty list
    }
  } else {
    // Scan all version subdirectories
    let versionDirs: string[]
    try {
      const entries = await fs.readdir(outputDir, { withFileTypes: true })
      versionDirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    } catch {
      return NextResponse.json({ packages: [] })
    }

    for (const version of versionDirs) {
      const versionDir = path.join(outputDir, version)
      try {
        const entries = await fs.readdir(versionDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const stat = await fs.stat(path.join(versionDir, entry.name))
          packages.push({
            name: entry.name,
            version,
            updatedAt: stat.mtime.toISOString(),
          })
        }
      } catch {
        // Skip unreadable dirs
      }
    }
  }

  // Sort: version desc (numeric), then package name asc
  packages.sort((a, b) =>
    a.version !== b.version
      ? b.version.localeCompare(a.version, undefined, { numeric: true })
      : a.name.localeCompare(b.name)
  )

  return NextResponse.json({ packages })
}

// ── DELETE /api/releases ──────────────────────────────────────────────────────
const deleteSchema = z.object({
  env: z.enum(["prod", "test", "dev"]),
  version: z.string().min(1),
  name: z.string().min(1).regex(/^[^/\\]+$/, "Nom de dossier invalide"),
})

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req, "canDeleteReleases")
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 })
  }

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides", details: parsed.error.format() },
      { status: 400 }
    )
  }

  const { env: environment, version, name } = parsed.data
  const outputDir = getOutputDir(environment as Environment)

  // Path traversal guard
  const pkgPath = path.resolve(outputDir, version, name)
  const expectedBase = path.resolve(outputDir)
  if (!pkgPath.startsWith(expectedBase + path.sep)) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 })
  }

  // Ensure it's a directory, not a file
  try {
    const stat = await fs.stat(pkgPath)
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "La cible n'est pas un dossier" },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 })
  }

  try {
    await fs.rm(pkgPath, { recursive: true, force: true })
  } catch (err) {
    console.error("[DELETE /api/releases]", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
