import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { requireAuth } from "@/lib/api-auth"

const DATA_DIR = path.join(process.cwd(), "data")

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
): Promise<NextResponse> {
  const auth = requireAuth(req, "canViewHistory")
  if (auth instanceof NextResponse) return auth

  try {
    const { buildId } = await params

    // Sanitize buildId — only allow UUID-like strings
    if (!/^[\w-]+$/.test(buildId)) {
      return NextResponse.json({ error: "Invalid buildId" }, { status: 400 })
    }

    const buildDataDir = path.join(DATA_DIR, buildId)
    const fileParam = req.nextUrl.searchParams.get("file")

    if (!fileParam) {
      // List available .log files
      try {
        const entries = await fs.readdir(buildDataDir, { withFileTypes: true })
        const files = entries
          .filter((e) => e.isFile() && e.name.endsWith(".log"))
          .map((e) => e.name)
        return NextResponse.json({ files })
      } catch {
        return NextResponse.json({ files: [] })
      }
    }

    // Return file content — validate no path traversal
    if (fileParam.includes("/") || fileParam.includes("\\") || !fileParam.endsWith(".log")) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 })
    }

    const filePath = path.join(buildDataDir, fileParam)
    // Ensure resolved path stays within buildDataDir
    if (!filePath.startsWith(buildDataDir + path.sep) && filePath !== buildDataDir) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    try {
      const content = await fs.readFile(filePath, "utf-8")
      return NextResponse.json({ content })
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
  } catch (err) {
    console.error("[GET /api/history/[buildId]/data-logs]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
