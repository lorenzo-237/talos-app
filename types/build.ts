export type LogType = "log" | "error" | "warning" | "done" | "progress"

export interface LogEntry {
  type: LogType
  message: string
  timestamp: string
  progress?: { current: number; total: number }
}

export type BuildStatus = "running" | "success" | "error" | "partial" | "cancelled"

export interface BuildRecord {
  buildId: string
  version: string
  resolvedVersion: string
  packages: string[]
  status: BuildStatus
  startedAt: string
  endedAt?: string
  outputDir: string
}
