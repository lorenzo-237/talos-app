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
  version: z
    .string()
    .min(1)
    .regex(/^[^/\\]+$/, "Version invalide"),
  /** Omit to move the entire version folder */
  name: z
    .string()
    .min(1)
    .regex(/^[^/\\]+$/, "Nom de dossier invalide")
    .optional(),
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
      { error: "Paramètres invalides", details: parsed.error.issues },
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

  // ── Move a single package ────────────────────────────────────────────────────
  if (name !== undefined) {
    const srcPath = path.resolve(srcDir, version, name)
    const dstVersionDir = path.resolve(dstDir, version)
    const dstPath = path.resolve(dstVersionDir, name)

    if (!srcPath.startsWith(path.resolve(srcDir) + path.sep)) {
      return NextResponse.json(
        { error: "Chemin source invalide" },
        { status: 400 }
      )
    }
    if (!dstPath.startsWith(path.resolve(dstDir) + path.sep)) {
      return NextResponse.json(
        { error: "Chemin destination invalide" },
        { status: 400 }
      )
    }

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

    await fs.mkdir(dstVersionDir, { recursive: true })
    const result = await moveDir(srcPath, dstPath)
    if (result !== null) return result
    return NextResponse.json({ ok: true })
  }

  // ── Move entire version folder (all packages inside) ────────────────────────
  const srcVersionPath = path.resolve(srcDir, version)
  const dstVersionPath = path.resolve(dstDir, version)

  if (!srcVersionPath.startsWith(path.resolve(srcDir) + path.sep)) {
    return NextResponse.json(
      { error: "Chemin source invalide" },
      { status: 400 }
    )
  }
  if (!dstVersionPath.startsWith(path.resolve(dstDir) + path.sep)) {
    return NextResponse.json(
      { error: "Chemin destination invalide" },
      { status: 400 }
    )
  }

  let packages: string[]
  try {
    const entries = await fs.readdir(srcVersionPath, { withFileTypes: true })
    packages = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return NextResponse.json(
      { error: "Dossier version source introuvable" },
      { status: 404 }
    )
  }

  if (packages.length === 0) {
    return NextResponse.json(
      { error: "Aucun package à déplacer dans cette version" },
      { status: 400 }
    )
  }

  await fs.mkdir(dstVersionPath, { recursive: true })

  for (const pkg of packages) {
    const srcPkg = path.join(srcVersionPath, pkg)
    const dstPkg = path.join(dstVersionPath, pkg)
    const result = await moveDir(srcPkg, dstPkg)
    if (result !== null) return result
  }

  // Remove source version dir if now empty
  try {
    await fs.rmdir(srcVersionPath)
  } catch {
    // Not empty or already gone — ignore
  }

  return NextResponse.json({ ok: true })
}

/** Move srcPath → dstPath. Returns a NextResponse on error, null on success. */
async function moveDir(
  srcPath: string,
  dstPath: string
): Promise<NextResponse | null> {
  try {
    await fs.rename(srcPath, dstPath)
    return null
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
      return null
    } catch (copyErr) {
      await fs
        .rm(dstPath, { recursive: true, force: true })
        .catch(() => undefined)
      console.error("[POST /api/releases/move] copy+delete failed", copyErr)
      return NextResponse.json(
        { error: "Erreur lors du déplacement (cross-volume)" },
        { status: 500 }
      )
    }
  }
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
