import fs from "fs/promises"
import path from "path"
import type { BuildRecord, LogEntry } from "@/types/build"

const HISTORY_FILE = path.join(process.cwd(), "data", "history.json")

function buildLogsPath(buildId: string): string {
  return path.join(process.cwd(), "data", buildId, "logs.json")
}

async function ensureFile(): Promise<void> {
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true })
  try {
    await fs.access(HISTORY_FILE)
  } catch {
    await fs.writeFile(HISTORY_FILE, JSON.stringify({ builds: [] }), "utf-8")
  }
}

export async function getHistory(): Promise<BuildRecord[]> {
  await ensureFile()
  const raw = await fs.readFile(HISTORY_FILE, "utf-8")
  const data = JSON.parse(raw) as { builds: BuildRecord[] }
  return data.builds
}

export async function appendHistory(record: BuildRecord): Promise<void> {
  await ensureFile()
  const builds = await getHistory()
  builds.unshift(record) // newest first
  await fs.writeFile(HISTORY_FILE, JSON.stringify({ builds }, null, 2), "utf-8")
}

export async function saveBuildLogs(
  buildId: string,
  entries: LogEntry[]
): Promise<void> {
  const logsFile = buildLogsPath(buildId)
  await fs.mkdir(path.dirname(logsFile), { recursive: true })
  await fs.writeFile(logsFile, JSON.stringify(entries, null, 2), "utf-8")
}

export async function getBuildLogs(
  buildId: string
): Promise<LogEntry[] | null> {
  const logsFile = buildLogsPath(buildId)
  try {
    const raw = await fs.readFile(logsFile, "utf-8")
    return JSON.parse(raw) as LogEntry[]
  } catch {
    return null
  }
}

export async function updateHistoryRecord(
  buildId: string,
  patch: Partial<BuildRecord>
): Promise<void> {
  await ensureFile()
  const builds = await getHistory()
  const idx = builds.findIndex((b) => b.buildId === buildId)
  if (idx !== -1) {
    builds[idx] = { ...builds[idx], ...patch }
    await fs.writeFile(HISTORY_FILE, JSON.stringify({ builds }, null, 2), "utf-8")
  }
}

/**
 * Remove builds from history.json and delete their per-build data directories.
 * Silently skips IDs that do not exist.
 */
export async function deleteBuilds(buildIds: string[]): Promise<void> {
  await ensureFile()
  const builds = await getHistory()
  const idSet = new Set(buildIds)
  const remaining = builds.filter((b) => !idSet.has(b.buildId))
  await fs.writeFile(
    HISTORY_FILE,
    JSON.stringify({ builds: remaining }, null, 2),
    "utf-8"
  )
  // Remove per-build data directories (logs.json, etc.) — ignore errors
  await Promise.allSettled(
    buildIds.map((id) =>
      fs.rm(path.join(process.cwd(), "data", id), {
        recursive: true,
        force: true,
      })
    )
  )
}
