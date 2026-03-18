"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, RefreshCw } from "lucide-react"
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
import type { BuildRecord, BuildStatus } from "@/types/build"

const STATUS_VARIANT: Record<BuildStatus, "default" | "secondary" | "destructive" | "outline"> = {
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
}

export default function HistoryPage() {
  const [builds, setBuilds] = React.useState<BuildRecord[]>([])
  const [loading, setLoading] = React.useState(true)

  async function loadHistory() {
    setLoading(true)
    try {
      const res = await fetch("/api/history")
      if (!res.ok) {
        toast.error("Impossible de charger l'historique")
        return
      }
      const data = await res.json() as { builds: BuildRecord[] }
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
        <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading}>
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
        <p className="text-sm text-muted-foreground">Aucun build enregistré.</p>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {builds.map((build) => (
                <TableRow key={build.buildId}>
                  <TableCell className="font-mono text-sm">{build.version}</TableCell>
                  <TableCell className="font-mono text-sm">{build.resolvedVersion}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {build.packages.map((pkg) => (
                        <Badge key={pkg} variant="secondary" className="text-xs">
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
