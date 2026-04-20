import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import fs from "fs/promises"
import path from "path"
import { getOutputDir } from "@/lib/env"
import { requireAuth } from "@/lib/api-auth"
import type { Environment } from "@/types/build"

const moveSchema = z.object({
  from: z.enum(["prod", "test", "dev"]),
  to: z.enum(["prod", "test", "dev"]),
  version: z.string().min(1),
  name: z.string().min(1).regex(/^[^/\\]+$/, "Nom de dossier invalide"),
})

// ── POST /api/releases/move ───────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req, "canMoveReleases")
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 })
  }

  const parsed = moveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides", details: parsed.error.format() },
      { status: 400 }
    )
  }

  const { from, to, version, name } = parsed.data

  if (from === to) {
    return NextResponse.json(
      { error: "Les environnements source et destination sont identiques" },
      { status: 400 }
    )
  }

  const srcDir = getOutputDir(from as Environment)
  const dstDir = getOutputDir(to as Environment)

  const srcPath = path.resolve(srcDir, version, name)
  const dstVersionDir = path.resolve(dstDir, version)
  const dstPath = path.resolve(dstVersionDir, name)

  // Path traversal guards
  if (!srcPath.startsWith(path.resolve(srcDir) + path.sep)) {
    return NextResponse.json({ error: "Chemin source invalide" }, { status: 400 })
  }
  if (!dstPath.startsWith(path.resolve(dstDir) + path.sep)) {
    return NextResponse.json(
      { error: "Chemin destination invalide" },
      { status: 400 }
    )
  }

  // Ensure source exists and is a directory
  try {
    const stat = await fs.stat(srcPath)
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "La source n'est pas un dossier" },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: "Dossier source introuvable" },
      { status: 404 }
    )
  }

  // Ensure destination version directory exists
  await fs.mkdir(dstVersionDir, { recursive: true })

  // Try atomic rename first (same volume); fall back to recursive copy+delete
  try {
    await fs.rename(srcPath, dstPath)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "EXDEV") {
      console.error("[POST /api/releases/move] rename failed", err)
      return NextResponse.json(
        { error: "Erreur lors du déplacement" },
        { status: 500 }
      )
    }

    // Cross-device: recursive copy then delete source
    try {
      await copyDirRecursive(srcPath, dstPath)
      await fs.rm(srcPath, { recursive: true, force: true })
    } catch (copyErr) {
      await fs.rm(dstPath, { recursive: true, force: true }).catch(() => undefined)
      console.error("[POST /api/releases/move] copy+delete failed", copyErr)
      return NextResponse.json(
        { error: "Erreur lors du déplacement (cross-volume)" },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true })
}

async function copyDirRecursive(src: string, dst: string): Promise<void> {
  await fs.mkdir(dst, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcEntry = path.join(src, entry.name)
    const dstEntry = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      await copyDirRecursive(srcEntry, dstEntry)
    } else {
      await fs.copyFile(srcEntry, dstEntry)
    }
  }
}
