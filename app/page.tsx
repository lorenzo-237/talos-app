"use client"

import * as React from "react"
import Link from "next/link"
import {
  Hammer,
  Archive,
  Package,
  FolderOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Ban,
  Clock,
  ArrowRight,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useRights } from "@/contexts/auth-context"
import type { BuildRecord, BuildStatus, Environment } from "@/types/build"

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENV_CLASS: Record<Environment, string> = {
  prod: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  test: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  dev: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
}

const ENV_LABELS: Record<Environment, string> = {
  prod: "PROD",
  test: "TEST",
  dev: "DEV",
}

function StatusIcon({ status }: { status: BuildStatus }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="size-4 text-green-500" />
    case "error":
      return <XCircle className="size-4 text-red-500" />
    case "partial":
      return <AlertTriangle className="size-4 text-yellow-500" />
    case "cancelled":
      return <Ban className="size-4 text-muted-foreground" />
    case "running":
      return <Loader2 className="size-4 animate-spin text-primary" />
  }
}

const STATUS_LABELS: Record<BuildStatus, string> = {
  success: "Succès",
  error: "Échec",
  partial: "Partiel",
  cancelled: "Annulé",
  running: "En cours",
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `Il y a ${days} j`
}

// ── Quick actions ─────────────────────────────────────────────────────────────

interface QuickAction {
  href: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  right: keyof ReturnType<typeof useRights> | null
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    href: "/build",
    label: "Nouveau build",
    description: "Générer des packages depuis une version",
    icon: Hammer,
    right: null,
  },
  {
    href: "/releases",
    label: "Releases",
    description: "Parcourir et déplacer les archives générées",
    icon: Archive,
    right: "canReadReleases",
  },
  {
    href: "/packages",
    label: "Packages",
    description: "Éditer les définitions JSON",
    icon: Package,
    right: "canReadPackages",
  },
  {
    href: "/explorer",
    label: "Explorateur",
    description: "Parcourir les fichiers source",
    icon: FolderOpen,
    right: "canReadExplorer",
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const rights = useRights()
  const [recentBuilds, setRecentBuilds] = React.useState<BuildRecord[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/history")
        if (!res.ok) return
        const data = (await res.json()) as { builds: BuildRecord[] }
        setRecentBuilds(data.builds.slice(0, 5))
      } finally {
        setLoading(false)
      }
    }
    if (rights.canViewHistory) load()
    else setLoading(false)
  }, [rights.canViewHistory])

  const visibleActions = QUICK_ACTIONS.filter(
    (a) => a.right === null || rights[a.right]
  )

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble de l'activité Talos.
        </p>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {visibleActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-between">
              <action.icon className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <p className="text-sm font-medium leading-tight">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {action.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Recent builds ────────────────────────────────────────────────────── */}
      {rights.canViewHistory && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Builds récents</h2>
              <Link
                href="/history"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Voir tout
                <ArrowRight className="size-3" />
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Chargement…
              </div>
            ) : recentBuilds.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Aucun build pour le moment.
              </p>
            ) : (
              <div className="divide-y rounded-md border overflow-hidden">
                {recentBuilds.map((build) => (
                  <div
                    key={build.buildId}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <StatusIcon status={build.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {build.version}
                        </span>
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${ENV_CLASS[build.environment]}`}
                        >
                          {ENV_LABELS[build.environment]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {STATUS_LABELS[build.status]}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {build.packages.join(", ")}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {formatRelative(build.startedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
