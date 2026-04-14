"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, RefreshCw, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BuildRecord, BuildStatus, LogEntry, LogType } from "@/types/build"

const STATUS_VARIANT: Record<
  BuildStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  success: "default",
  partial: "secondary",
  error: "destructive",
  running: "outline",
}

const STATUS_LABEL: Record<BuildStatus, string> = {
  success: "Succès",
  partial: "Partiel",
  error: "Erreur",
  running: "En cours",
}

const LOG_CLASS: Record<LogType, string> = {
  log: "text-foreground",
  warning: "text-amber-400",
  error: "text-red-400",
  done: "text-green-400",
  progress: "text-muted-foreground",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { timeStyle: "medium" })
}

export default function HistoryPage() {
  const [builds, setBuilds] = React.useState<BuildRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [logsDialog, setLogsDialog] = React.useState<{
    build: BuildRecord
    logs: LogEntry[] | null
    loading: boolean
  } | null>(null)
  const logsEndRef = React.useRef<HTMLDivElement>(null)

  async function loadHistory() {
    setLoading(true)
    try {
      const res = await fetch("/api/history")
      if (!res.ok) {
        toast.error("Impossible de charger l'historique")
        return
      }
      const data = (await res.json()) as { builds: BuildRecord[] }
      setBuilds(data.builds)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadHistory()
  }, [])

  React.useEffect(() => {
    if (logsDialog?.logs) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [logsDialog?.logs])

  async function openLogs(build: BuildRecord) {
    setLogsDialog({ build, logs: null, loading: true })
    try {
      const res = await fetch(`/api/history/${build.buildId}`)
      if (!res.ok) {
        setLogsDialog((prev) =>
          prev ? { ...prev, loading: false, logs: [] } : null
        )
        toast.error("Logs introuvables pour ce build")
        return
      }
      const data = (await res.json()) as { logs: LogEntry[] }
      setLogsDialog((prev) =>
        prev ? { ...prev, loading: false, logs: data.logs } : null
      )
    } catch {
      setLogsDialog((prev) =>
        prev ? { ...prev, loading: false, logs: [] } : null
      )
      toast.error("Erreur réseau")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Historique</h1>
          <p className="text-sm text-muted-foreground">
            Tous les builds générés sur cet outil.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadHistory}
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Chargement...
        </div>
      ) : builds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun build enregistré.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version saisie</TableHead>
                <TableHead>Version résolue</TableHead>
                <TableHead>Packages</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Démarré</TableHead>
                <TableHead>Terminé</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {builds.map((build) => (
                <TableRow key={build.buildId}>
                  <TableCell className="font-mono text-sm">
                    {build.version}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {build.resolvedVersion}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {build.packages.map((pkg) => (
                        <Badge
                          key={pkg}
                          variant="secondary"
                          className="text-xs"
                        >
                          {pkg}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[build.status]}>
                      {STATUS_LABEL[build.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(build.startedAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {build.endedAt ? formatDate(build.endedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs"
                      disabled={build.status === "running"}
                      onClick={() => openLogs(build)}
                    >
                      <ScrollText className="size-3.5" />
                      Logs
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Logs dialog */}
      <Dialog
        open={!!logsDialog}
        onOpenChange={(open) => !open && setLogsDialog(null)}
      >
        <DialogContent className="flex max-w-3xl flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="size-4" />
              Logs —{" "}
              <span className="font-mono text-sm font-normal text-muted-foreground">
                {logsDialog?.build.version} ·{" "}
                {logsDialog?.build.packages.join(", ")}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1">
            {logsDialog?.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !logsDialog?.logs || logsDialog.logs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aucun log disponible.
              </p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto rounded-md bg-black p-3 font-mono text-xs">
                {logsDialog.logs.map((entry, i) => (
                  <div key={i} className="flex gap-2 py-0.5">
                    <span className="shrink-0 text-muted-foreground">
                      {formatTime(entry.timestamp)}
                    </span>
                    <span className={LOG_CLASS[entry.type]}>
                      {entry.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
