"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, ScrollText } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BuildRecord, LogEntry, LogType } from "@/types/build"

const LOG_CLASS: Record<LogType, string> = {
  log: "text-foreground",
  warning: "text-amber-400",
  error: "text-red-400",
  done: "text-green-400",
  progress: "text-muted-foreground",
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { timeStyle: "medium" })
}

interface DialogState {
  logs: LogEntry[] | null
  loading: boolean
  dataFiles: string[]
  activeTab: string
  fileContent: string | null
  fileLoading: boolean
}

interface LogsDialogProps {
  build: BuildRecord | null
  onClose: () => void
}

export function LogsDialog({ build, onClose }: LogsDialogProps) {
  const [state, setState] = React.useState<DialogState>({
    logs: null,
    loading: false,
    dataFiles: [],
    activeTab: "build",
    fileContent: null,
    fileLoading: false,
  })
  const logsEndRef = React.useRef<HTMLDivElement>(null)

  // Load logs + data files whenever a new build is selected
  React.useEffect(() => {
    if (!build) return
    setState({
      logs: null,
      loading: true,
      dataFiles: [],
      activeTab: "build",
      fileContent: null,
      fileLoading: false,
    })
    Promise.all([
      fetch(`/api/history/${build.buildId}`),
      fetch(`/api/history/${build.buildId}/data-logs`),
    ])
      .then(async ([logsRes, filesRes]) => {
        const logs = logsRes.ok
          ? ((await logsRes.json()) as { logs: LogEntry[] }).logs
          : []
        const dataFiles = filesRes.ok
          ? ((await filesRes.json()) as { files: string[] }).files
          : []
        if (!logsRes.ok) toast.error("Logs introuvables pour ce build")
        setState((prev) => ({ ...prev, loading: false, logs, dataFiles }))
      })
      .catch(() => {
        setState((prev) => ({
          ...prev,
          loading: false,
          logs: [],
          dataFiles: [],
        }))
        toast.error("Erreur réseau")
      })
  }, [build])

  // Scroll to bottom when build logs are loaded
  React.useEffect(() => {
    if (state.logs) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [state.logs])

  async function selectTab(tab: string) {
    if (tab === "build") {
      setState((prev) => ({ ...prev, activeTab: "build" }))
      return
    }
    setState((prev) => ({
      ...prev,
      activeTab: tab,
      fileContent: null,
      fileLoading: true,
    }))
    try {
      const res = await fetch(
        `/api/history/${build!.buildId}/data-logs?file=${encodeURIComponent(tab)}`
      )
      const content = res.ok
        ? ((await res.json()) as { content: string }).content
        : "Impossible de charger le fichier."
      setState((prev) => ({ ...prev, fileContent: content, fileLoading: false }))
    } catch {
      setState((prev) => ({
        ...prev,
        fileContent: "Erreur réseau.",
        fileLoading: false,
      }))
    }
  }

  return (
    <Dialog open={!!build} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="size-4" />
            Logs —{" "}
            <span className="font-mono text-sm font-normal text-muted-foreground">
              {build?.version} · {build?.packages.join(", ")}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Tab pills */}
        {!state.loading && (
          <div className="flex flex-wrap gap-1.5 border-b pb-2">
            <TabPill
              label="Build"
              active={state.activeTab === "build"}
              onClick={() => selectTab("build")}
            />
            {state.dataFiles.map((file) => (
              <TabPill
                key={file}
                label={file}
                active={state.activeTab === file}
                onClick={() => selectTab(file)}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="min-h-0 flex-1">
          {state.loading ? (
            <Spinner />
          ) : state.activeTab === "build" ? (
            <BuildLogsView logs={state.logs} logsEndRef={logsEndRef} />
          ) : state.fileLoading ? (
            <Spinner />
          ) : (
            <div className="max-h-[55vh] overflow-y-auto rounded-md bg-black p-3 font-mono text-xs whitespace-pre-wrap text-foreground">
              {state.fileContent ?? ""}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function BuildLogsView({
  logs,
  logsEndRef,
}: {
  logs: LogEntry[] | null
  logsEndRef: React.RefObject<HTMLDivElement | null>
}) {
  if (!logs || logs.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Aucun log disponible.
      </p>
    )
  }
  return (
    <div className="max-h-[55vh] overflow-y-auto rounded-md bg-black p-3 font-mono text-xs">
      {logs.map((entry, i) => (
        <div key={i} className="flex gap-2 py-0.5">
          <span className="shrink-0 text-muted-foreground">
            {formatTime(entry.timestamp)}
          </span>
          <span className={LOG_CLASS[entry.type]}>{entry.message}</span>
        </div>
      ))}
      <div ref={logsEndRef} />
    </div>
  )
}
