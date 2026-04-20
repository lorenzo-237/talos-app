import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import fs from "fs/promises"
import path from "path"
import { getOutputDir } from "@/lib/env"
import { requireAuth } from "@/lib/api-auth"
import type { Environment } from "@/types/build"

export interface BrowseEntry {
  name: string
  isDir: boolean
  size?: number
  updatedAt: string
}

const querySchema = z.object({
  env: z.enum(["prod", "test", "dev"]),
  // relative path segments joined with "/", e.g. "3.3.3.1/Medoc_3.3.3.1/subdir"
  // empty string = root of output dir
  path: z.string().default(""),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req, "canReadReleases")
  if (auth instanceof NextResponse) return auth

  const { searchParams } = req.nextUrl
  const parsed = querySchema.safeParse({
    env: searchParams.get("env"),
    path: searchParams.get("path") ?? "",
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides" },
      { status: 400 }
    )
  }

  const { env, path: relPath } = parsed.data
  const outputDir = getOutputDir(env as Environment)

  // Build and validate the target path
  const segments = relPath
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)

  const targetPath = segments.length
    ? path.resolve(outputDir, ...segments)
    : path.resolve(outputDir)

  // Path traversal guard
  const base = path.resolve(outputDir)
  if (targetPath !== base && !targetPath.startsWith(base + path.sep)) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 })
  }

  try {
    await fs.access(targetPath)
  } catch {
    return NextResponse.json({ entries: [] })
  }

  let dirEntries: Awaited<ReturnType<typeof fs.readdir>>
  try {
    dirEntries = await fs.readdir(targetPath, { withFileTypes: true })
  } catch {
    return NextResponse.json({ entries: [] })
  }

  const entries: BrowseEntry[] = []
  for (const entry of dirEntries) {
    try {
      const stat = await fs.stat(path.join(targetPath, entry.name))
      entries.push({
        name: entry.name,
        isDir: entry.isDirectory(),
        size: entry.isFile() ? stat.size : undefined,
        updatedAt: stat.mtime.toISOString(),
      })
    } catch {
      // Skip unreadable entries
    }
  }

  // Directories first, then files — each group sorted alphabetically
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return NextResponse.json({ entries })
}
