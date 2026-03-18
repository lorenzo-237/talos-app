import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { env } from "@/lib/env"
import { resolvePackageFolder } from "@/lib/version-resolver"

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const version = request.nextUrl.searchParams.get("version")
    if (!version) {
      return NextResponse.json({ error: "Missing 'version' query parameter" }, { status: 400 })
    }

    let resolved
    try {
      resolved = await resolvePackageFolder(version, env.PACKAGES_DIR)
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 })
    }

    if (!resolved) {
      return NextResponse.json(
        { error: `No package folder found for version "${version}"` },
        { status: 404 }
      )
    }

    const entries = await fs.readdir(resolved.folder, { withFileTypes: true })
    const packages = entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => {
        const filename = e.name
        const name = path.basename(filename, ".json")
        return { name, filename }
      })

    // Read each package to get the output name
    const packagesWithOutput = await Promise.all(
      packages.map(async (pkg) => {
        try {
          const raw = await fs.readFile(path.join(resolved.folder, pkg.filename), "utf-8")
          const def = JSON.parse(raw) as { output: string }
          return { ...pkg, output: def.output ?? "" }
        } catch {
          return { ...pkg, output: "" }
        }
      })
    )

    return NextResponse.json({
      resolvedVersion: resolved.resolvedVersion,
      inputVersion: version,
      packages: packagesWithOutput,
    })
  } catch (err) {
    console.error("[GET /api/packages]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
