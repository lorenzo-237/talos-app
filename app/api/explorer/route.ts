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

const CONTENT_TYPES: Record<string, string> = {
  txt: "text/plain; charset=utf-8",
  ini: "text/plain; charset=utf-8",
  pdf: "application/pdf",
  exe: "application/octet-stream",
  dll: "application/octet-stream",
  wdk: "application/octet-stream",
  fic: "application/octet-stream",
  ndx: "application/octet-stream",
  mmo: "application/octet-stream",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  rtf: "application/rtf",
}

function getContentType(ext: string): string {
  return CONTENT_TYPES[ext] ?? "application/octet-stream"
}

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  try {
    const rel = request.nextUrl.searchParams.get("path") ?? ""
    const forceDownload =
      request.nextUrl.searchParams.get("download") === "1"

    const target = safePath(rel)
    if (!target) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    const stat = await fs.stat(target)

    if (stat.isFile()) {
      const ext = path.extname(target).slice(1).toLowerCase()
      const contentType = getContentType(ext)
      const filename = path.basename(target)
      const buffer = await fs.readFile(target)

      const headers = new Headers()
      headers.set("Content-Type", contentType)
      headers.set(
        "Content-Disposition",
        forceDownload
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`
      )
      return new Response(buffer, { headers })
    }

    // Directory listing
    const entries = await fs.readdir(target, { withFileTypes: true })
    const items = await Promise.all(
      entries.map(async (e) => {
        const fullPath = path.join(target, e.name)
        let size: number | undefined
        let modifiedAt: string | undefined
        try {
          const s = await fs.stat(fullPath)
          size = s.isFile() ? s.size : undefined
          modifiedAt = s.mtime.toISOString()
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
    return NextResponse.json(
      { error: "Failed to list directory" },
      { status: 500 }
    )
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData()
    const dir = (formData.get("path") as string) ?? ""
    const files = formData.getAll("files") as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const target = safePath(dir)
    if (!target) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    await fs.mkdir(target, { recursive: true })

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(target, file.name)
        const buffer = Buffer.from(await file.arrayBuffer())
        await fs.writeFile(filePath, buffer)
        return file.name
      })
    )

    return NextResponse.json({ success: true, uploaded })
  } catch (err) {
    console.error("[PUT /api/explorer]", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
