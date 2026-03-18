import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { z } from "zod"
import { env } from "@/lib/env"

function safePath(relativePath: string): string | null {
  const resolved = path.resolve(path.join(env.SRC_DIR, relativePath))
  const base = path.resolve(env.SRC_DIR)
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    return null
  }
  return resolved
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const rel = request.nextUrl.searchParams.get("path") ?? ""
    const target = safePath(rel)
    if (!target) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    const entries = await fs.readdir(target, { withFileTypes: true })
    const items = await Promise.all(
      entries.map(async (e) => {
        const fullPath = path.join(target, e.name)
        let size: number | undefined
        let modifiedAt: string | undefined
        try {
          const stat = await fs.stat(fullPath)
          size = stat.isFile() ? stat.size : undefined
          modifiedAt = stat.mtime.toISOString()
        } catch {}
        return {
          name: e.name,
          type: e.isDirectory() ? ("directory" as const) : ("file" as const),
          size,
          modifiedAt,
        }
      })
    )

    return NextResponse.json({ path: rel, entries: items })
  } catch (err) {
    console.error("[GET /api/explorer]", err)
    return NextResponse.json({ error: "Failed to list directory" }, { status: 500 })
  }
}

const deleteSchema = z.object({ path: z.string() })

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json()
    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const target = safePath(parsed.data.path)
    if (!target) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    await fs.rm(target, { recursive: true, force: true })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/explorer]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const mkdirSchema = z.object({ path: z.string() })

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json()
    const parsed = mkdirSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const target = safePath(parsed.data.path)
    if (!target) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    await fs.mkdir(target, { recursive: true })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[POST /api/explorer]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
