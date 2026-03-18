import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { env } from "@/lib/env"

export async function GET(): Promise<NextResponse> {
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
