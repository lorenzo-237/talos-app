"use client"

import * as React from "react"
import { toast } from "sonner"
import { CalendarX2, Loader2, RefreshCw, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { BuildTable } from "@/components/history/build-table"
import { LogsDialog } from "@/components/history/logs-dialog"
import { useRights } from "@/contexts/auth-context"
import type { BuildRecord } from "@/types/build"

/** Format a Date as YYYY-MM-DD for <input type="date"> */
function toDateValue(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Default cutoff: 30 days ago */
function defaultCutoff(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return toDateValue(d)
}

export default function HistoryPage() {
  const [builds, setBuilds] = React.useState<BuildRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedBuild, setSelectedBuild] = React.useState<BuildRecord | null>(
    null
  )

  // ── Selection ──────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  function toggleId(buildId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(buildId)) next.delete(buildId)
      else next.add(buildId)
      return next
    })
  }

  function toggleAll() {
    const selectable = builds
      .filter((b) => b.status !== "running")
      .map((b) => b.buildId)
    const allSelected = selectable.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectable))
    }
  }

  // ── Deletion by date ───────────────────────────────────────────────────────
  const [cutoffDate, setCutoffDate] = React.useState(defaultCutoff)

  // ── Confirm state — "selection" | "date" | null ────────────────────────────
  const [confirming, setConfirming] = React.useState<
    "selection" | "date" | null
  >(null)
  const [deleting, setDeleting] = React.useState(false)

  const rights = useRights()

  // ── Load ───────────────────────────────────────────────────────────────────
  async function loadHistory() {
    setLoading(true)
    setSelectedIds(new Set())
    setConfirming(null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Delete helpers ─────────────────────────────────────────────────────────
  async function deleteBySelection() {
    if (selectedIds.size === 0) return
    setDeleting(true)
    try {
      const res = await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildIds: [...selectedIds] }),
      })
      const data = (await res.json()) as { deleted?: number; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la suppression")
        return
      }
      toast.success(
        `${data.deleted} entrée${data.deleted !== 1 ? "s" : ""} supprimée${data.deleted !== 1 ? "s" : ""}`
      )
      await loadHistory()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setDeleting(false)
      setConfirming(null)
    }
  }

  async function deleteByDate() {
    if (!cutoffDate) return
    setDeleting(true)
    try {
      // Send midnight UTC for the chosen date
      const before = new Date(cutoffDate + "T23:59:59.999Z").toISOString()
      const res = await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before }),
      })
      const data = (await res.json()) as { deleted?: number; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la suppression")
        return
      }
      if (data.deleted === 0) {
        toast.info("Aucune entrée à supprimer avant cette date")
      } else {
        toast.success(
          `${data.deleted} entrée${data.deleted !== 1 ? "s" : ""} supprimée${data.deleted !== 1 ? "s" : ""}`
        )
      }
      await loadHistory()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setDeleting(false)
      setConfirming(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
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

      {/* Deletion toolbar — only for users who can build */}
      {rights.canBuild && !loading && builds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          {/* ── By selection ── */}
          <div className="flex items-center gap-2">
            {confirming === "selection" ? (
              <>
                <span className="text-sm">
                  Supprimer{" "}
                  <strong>{selectedIds.size}</strong>{" "}
                  entrée{selectedIds.size !== 1 ? "s" : ""} ?
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={deleteBySelection}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Confirmer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirming(null)}
                  disabled={deleting}
                >
                  <X className="size-3.5" />
                  Annuler
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={selectedIds.size === 0}
                onClick={() => setConfirming("selection")}
              >
                <Trash2 className="size-3.5" />
                Supprimer la sélection
                {selectedIds.size > 0 && (
                  <span className="ml-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-xs font-medium text-destructive">
                    {selectedIds.size}
                  </span>
                )}
              </Button>
            )}
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* ── By date ── */}
          <div className="flex items-center gap-2">
            <CalendarX2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Supprimer avant le
            </span>
            <Input
              type="date"
              value={cutoffDate}
              max={toDateValue(new Date())}
              onChange={(e) => {
                setCutoffDate(e.target.value)
                setConfirming(null)
              }}
              className="h-8 w-36 text-sm"
            />
            {confirming === "date" ? (
              <>
                <span className="text-sm text-muted-foreground">Confirmer ?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={deleteByDate}
                  disabled={deleting || !cutoffDate}
                >
                  {deleting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Oui
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirming(null)}
                  disabled={deleting}
                >
                  <X className="size-3.5" />
                  Non
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirming("date")}
                disabled={!cutoffDate}
              >
                <Trash2 className="size-3.5" />
                Supprimer
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
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
        <BuildTable
          builds={builds}
          onOpenLogs={setSelectedBuild}
          selectedIds={selectedIds}
          onToggle={toggleId}
          onToggleAll={toggleAll}
        />
      )}

      <LogsDialog
        build={selectedBuild}
        onClose={() => setSelectedBuild(null)}
      />
    </div>
  )
}
