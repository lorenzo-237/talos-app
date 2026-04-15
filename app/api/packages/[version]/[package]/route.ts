import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { z } from "zod"
import { env } from "@/lib/env"
import { resolvePackageFolder } from "@/lib/version-resolver"
import { requireAuth } from "@/lib/api-auth"

type Params = { version: string; package: string }

async function resolveFilePath(
  versionParam: string,
  packageParam: string
): Promise<{ filePath: string; folderPath: string } | null> {
  const resolved = await resolvePackageFolder(versionParam, env.PACKAGES_DIR)
  if (!resolved) return null
  const filename = packageParam.endsWith(".json") ? packageParam : `${packageParam}.json`
  const filePath = path.join(resolved.folder, filename)
  return { filePath, folderPath: resolved.folder }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
): Promise<NextResponse> {
  const auth = requireAuth(req, "canReadPackages")
  if (auth instanceof NextResponse) return auth

  try {
    const { version, package: pkg } = await params
    const result = await resolveFilePath(version, pkg)
    if (!result) return NextResponse.json({ error: "Version not found" }, { status: 404 })

    const raw = await fs.readFile(result.filePath, "utf-8")
    return NextResponse.json(JSON.parse(raw))
  } catch (err) {
    console.error("[GET /api/packages/[version]/[package]]", err)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<Params> }
): Promise<NextResponse> {
  const auth = requireAuth(req, "canWritePackages")
  if (auth instanceof NextResponse) return auth

  try {
    const { version, package: pkg } = await params
    const result = await resolveFilePath(version, pkg)
    if (!result) return NextResponse.json({ error: "Version not found" }, { status: 404 })

    const body = await req.json()

    // Basic schema validation with Zod
    const schema = z.object({
      output: z.string().min(1),
      archives: z.array(z.unknown()).min(1),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid package schema", details: parsed.error.format() }, { status: 400 })
    }

    await fs.writeFile(result.filePath, JSON.stringify(body, null, 2), "utf-8")
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[PUT /api/packages/[version]/[package]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<Params> }
): Promise<NextResponse> {
  const auth = requireAuth(req, "canDeletePackages")
  if (auth instanceof NextResponse) return auth

  try {
    const { version, package: pkg } = await params
    const result = await resolveFilePath(version, pkg)
    if (!result) return NextResponse.json({ error: "Version not found" }, { status: 404 })

    await fs.unlink(result.filePath)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/packages/[version]/[package]]", err)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
