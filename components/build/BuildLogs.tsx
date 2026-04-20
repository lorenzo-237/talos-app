"use client"

import * as React from "react"
import { ArrowDownToLine, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { LOG_COLORS } from "@/lib/log-colors"
import type { LogEntry } from "@/types/build"

type LogFilter = "all" | "error" | "warning"

interface BuildLogsProps {
  logs: LogEntry[]
  progress: { current: number; total: number } | null
  buildDone: boolean
  hasErrors: boolean
}

export function BuildLogs({
  logs,
  progress,
  buildDone,
  hasErrors,
}: BuildLogsProps) {
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [logFilter, setLogFilter] = React.useState<LogFilter>("all")

  const logScrollRef = React.useRef<HTMLDivElement>(null)
  // Prevents the programmatic scroll from triggering the "user scrolled up" path
  const isProgrammaticScroll = React.useRef(false)

  // Reset filter when a new build starts
  React.useEffect(() => {
    if (logs.length === 0) {
      setLogFilter("all")
      setAutoScroll(true)
    }
  }, [logs.length])

  // Auto-scroll to bottom when new log entries arrive
  React.useEffect(() => {
    if (!autoScroll) return
    const el = logScrollRef.current
    if (!el) return
    isProgrammaticScroll.current = true
    el.scrollTop = el.scrollHeight
    requestAnimationFrame(() => {
      isProgrammaticScroll.current = false
    })
  }, [logs, autoScroll])

  function handleLogScroll() {
    if (isProgrammaticScroll.current) return
    const el = logScrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  async function copyLogs() {
    const text = logs
      .map(
        (e) =>
          `[${new Date(e.timestamp).toLocaleTimeString()}] [${e.type.toUpperCase()}] ${e.message}`
      )
      .join("\n")
    await navigator.clipboard.writeText(text)
    toast.success("Logs copiés dans le presse-papier")
  }

  const errorCount = logs.filter((e) => e.type === "error").length
  const warningCount = logs.filter((e) => e.type === "warning").length
  const filteredLogs =
    logFilter === "all" ? logs : logs.filter((e) => e.type === logFilter)
  const progressPct = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label>Logs</Label>
          {buildDone && (
            <Badge variant={hasErrors ? "destructive" : "secondary"}>
              {hasErrors ? "Terminé avec erreurs" : "Terminé"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={copyLogs}
            title="Copier les logs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copier
          </Button>
          <Button
            variant={autoScroll ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setAutoScroll((v) => !v)}
            title="Suivi automatique"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Suivi
          </Button>
        </div>
      </div>

      {/* Filter buttons — shown only when there are errors or warnings */}
      {(errorCount > 0 || warningCount > 0) && (
        <div className="flex gap-1">
          <Button
            variant={logFilter === "all" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setLogFilter("all")}
          >
            Tous ({logs.length})
          </Button>
          {errorCount > 0 && (
            <Button
              variant={logFilter === "error" ? "destructive" : "ghost"}
              size="xs"
              onClick={() => setLogFilter("error")}
              className={
                logFilter !== "error" ? "text-red-700 dark:text-red-400" : ""
              }
            >
              Erreurs ({errorCount})
            </Button>
          )}
          {warningCount > 0 && (
            <Button
              variant={logFilter === "warning" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setLogFilter("warning")}
              className={
                logFilter !== "warning"
                  ? "text-yellow-700 dark:text-yellow-400"
                  : ""
              }
            >
              Avertissements ({warningCount})
            </Button>
          )}
        </div>
      )}

      {/* Progress bar */}
      {progress && <Progress value={progressPct} className="h-2" />}

      {/* Log area */}
      <div
        ref={logScrollRef}
        onScroll={handleLogScroll}
        className="rounded-md border bg-muted/30 p-3 font-mono text-xs"
        style={{
          resize: "vertical",
          overflow: "auto",
          height: "24rem",
          minHeight: "8rem",
        }}
      >
        <div className="space-y-0.5">
          {filteredLogs.map((entry, i) => (
            <div
              key={i}
              className={LOG_COLORS[entry.type] ?? "text-foreground"}
            >
              <span className="mr-2 opacity-50">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              {entry.message}
            </div>
          ))}
        </div>
      </div>

      {/* Build summary */}
      {buildDone && (
        <p className="text-xs text-muted-foreground">
          {errorCount === 0 && warningCount === 0
            ? "Aucune erreur ni avertissement"
            : [
                errorCount > 0 &&
                  `${errorCount} erreur${errorCount > 1 ? "s" : ""}`,
                warningCount > 0 &&
                  `${warningCount} avertissement${warningCount > 1 ? "s" : ""}`,
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
      )}
    </div>
  )
}
