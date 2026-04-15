import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { env } from "@/lib/env"
import { requireAuth } from "@/lib/api-auth"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = requireAuth(req)
  if (auth instanceof NextResponse) return auth
  try {
    const entries = await fs.readdir(env.PACKAGES_DIR, { withFileTypes: true })
    const versions = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
    return NextResponse.json({ versions })
  } catch (err) {
    console.error("[GET /api/versions]", err)
    return NextResponse.json({ error: "Failed to list versions" }, { status: 500 })
  }
}
