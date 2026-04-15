"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BuildTable } from "@/components/history/build-table"
import { LogsDialog } from "@/components/history/logs-dialog"
import type { BuildRecord } from "@/types/build"

export default function HistoryPage() {
  const [builds, setBuilds] = React.useState<BuildRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedBuild, setSelectedBuild] = React.useState<BuildRecord | null>(
    null
  )

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
        <BuildTable builds={builds} onOpenLogs={setSelectedBuild} />
      )}

      <LogsDialog
        build={selectedBuild}
        onClose={() => setSelectedBuild(null)}
      />
    </div>
  )
}
