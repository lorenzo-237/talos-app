"use client"

import { ScrollText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BuildRecord, BuildStatus } from "@/types/build"

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

interface BuildTableProps {
  builds: BuildRecord[]
  onOpenLogs: (build: BuildRecord) => void
}

export function BuildTable({ builds, onOpenLogs }: BuildTableProps) {
  return (
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
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs"
                  disabled={build.status === "running"}
                  onClick={() => onOpenLogs(build)}
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
  )
}
