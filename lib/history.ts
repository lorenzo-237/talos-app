import fs from "fs/promises"
import path from "path"
import type { BuildRecord } from "@/types/build"

const HISTORY_FILE = path.join(process.cwd(), "data", "history.json")

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
