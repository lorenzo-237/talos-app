import type { LogEntry, LogType } from "@/types/build"

export class BuildLogger {
  private entries: LogEntry[] = []
  private listeners: Array<(entry: LogEntry) => void> = []
  private _isDone = false
  private createdAt = Date.now()

  get isDone(): boolean {
    return this._isDone
  }

  get allEntries(): LogEntry[] {
    return [...this.entries]
  }

  get ageMs(): number {
    return Date.now() - this.createdAt
  }

  private emit(type: LogType, message: string, progress?: { current: number; total: number }): void {
    const entry: LogEntry = {
      type,
      message,
      timestamp: new Date().toISOString(),
      ...(progress !== undefined ? { progress } : {}),
    }
    this.entries.push(entry)
    for (const listener of this.listeners) {
      listener(entry)
    }
  }

  log(message: string): void {
    this.emit("log", message)
  }

  warn(message: string): void {
    this.emit("warning", message)
  }

  error(message: string): void {
    this.emit("error", message)
  }

  progress(current: number, total: number): void {
    this.emit("progress", `${current}/${total}`, { current, total })
  }

  done(): void {
    this._isDone = true
    this.emit("done", "Build complete")
  }

  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }
}

// Anchor the registry on globalThis so it survives Turbopack/HMR module
// re-instantiation in development — each route gets its own module instance
// but they all share the same globalThis.
declare global {
  // eslint-disable-next-line no-var
  var __buildRegistry: Map<string, BuildLogger> | undefined
}

const registry: Map<string, BuildLogger> =
  globalThis.__buildRegistry ?? new Map()
globalThis.__buildRegistry = registry

export const buildRegistry = {
  set(id: string, logger: BuildLogger): void {
    registry.set(id, logger)
    // Clean up entries older than 1 hour
    const ONE_HOUR = 60 * 60 * 1000
    for (const [key, value] of registry.entries()) {
      if (value.ageMs > ONE_HOUR) {
        registry.delete(key)
      }
    }
  },
  get(id: string): BuildLogger | undefined {
    return registry.get(id)
  },
  delete(id: string): void {
    registry.delete(id)
  },
}
