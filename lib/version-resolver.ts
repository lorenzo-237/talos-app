import path from "path"
import fs from "fs/promises"

export interface ResolvedVersion {
  folder: string
  resolvedVersion: string
}

/**
 * Validates that the version string contains only numeric segments.
 */
function validateVersion(version: string): boolean {
  return /^\d+(\.\d+)*$/.test(version)
}

export async function resolvePackageFolder(
  version: string,
  packagesDir: string
): Promise<ResolvedVersion | null> {
  if (!validateVersion(version)) {
    throw new Error(`Invalid version format: "${version}". Use numeric segments only (e.g. 3.3.3.1).`)
  }

  const segments = version.split(".")

  for (let len = segments.length; len >= 1; len--) {
    const candidate = segments.slice(0, len).join(".")
    const folderPath = path.join(packagesDir, candidate)
    try {
      const stat = await fs.stat(folderPath)
      if (stat.isDirectory()) {
        return { folder: folderPath, resolvedVersion: candidate }
      }
    } catch {
      // not found, try shorter version
    }
  }

  return null
}
