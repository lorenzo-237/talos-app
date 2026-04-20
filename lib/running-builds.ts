/**
 * File-based registry of the currently running build.
 *
 * Persisted to data/running-build.json so any page reload — or any
 * client — can detect an ongoing build without relying on in-memory state.
 *
 * The PID is stored alongside the build info so that a stale file left over
 * from a previous server process is detected and discarded automatically.
 */

import fs from "fs/promises"
import path from "path"

export interface RunningBuildInfo {
  buildId: string
  version: string
  resolvedVersion: string
  packages: string[]
  startedAt: string // ISO string
  cancelRequested?: boolean
}

interface PersistedState {
  pid: number
  build: RunningBuildInfo
}

const DATA_DIR = path.join(process.cwd(), "data")
const STATE_FILE = path.join(DATA_DIR, "running-build.json")

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readState(): Promise<PersistedState | null> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8")
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

async function writeState(state: PersistedState | null): Promise<void> {
  await ensureDataDir()
  if (state === null) {
    try {
      await fs.unlink(STATE_FILE)
    } catch {
      // File may not exist — ignore
    }
  } else {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8")
  }
}

export const runningBuilds = {
  /** Register a build as started. Call this right after creating the buildId. */
  async add(info: RunningBuildInfo): Promise<void> {
    await writeState({ pid: process.pid, build: info })
  },

  /** Mark the build as cancel-requested in the persisted state. */
  async requestCancel(buildId: string): Promise<void> {
    const state = await readState()
    if (state?.build.buildId === buildId) {
      await writeState({ ...state, build: { ...state.build, cancelRequested: true } })
    }
  },

  /** Unregister a build. Call this in the finally block of the build task. */
  async remove(buildId: string): Promise<void> {
    const state = await readState()
    if (state?.build.buildId === buildId) {
      await writeState(null)
    }
  },

  /**
   * Returns the currently running build (if any).
   * Returns [] when no build is running or when the persisted build belongs
   * to a previous server process (server restart → build is gone).
   */
  async getAll(): Promise<RunningBuildInfo[]> {
    const state = await readState()
    if (!state) return []
    // Stale file from a previous server process
    if (state.pid !== process.pid) {
      await writeState(null)
      return []
    }
    return [state.build]
  },
}
