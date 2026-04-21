"use client"

import * as React from "react"
import { ChevronRight, Folder, Home, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  isOu,
  type BaseLdapModel,
  type LdapOrganizationalUnit,
  type OuNodeDto,
} from "@/types/pilot"

// ── Pivot detection ───────────────────────────────────────────────────────────
//
// LDAP tree: /elements/{env}/{logiciel}/elements/{type}/…
// The fixed node "elements" is the pivot below which /versions is available.
// We activate the versions panel when:
//   • the current node id is "elements" (we just arrived at the pivot)
//   • OR the path already contains "elements" (we're in a sub-node, e.g. a type)

function atOrPastPivot(node: LdapOrganizationalUnit, path: string[]): boolean {
  return node.id === "elements" || path.includes("elements")
}

// ── API ───────────────────────────────────────────────────────────────────────

function apiUrl(path: string[]): string {
  if (path.length === 0) return "/api/pilot/elements"
  return `/api/pilot/elements/${path.join("/")}`
}

/** URL for the SUBTREE versions search — valid at pivot node or below */
export function versionsUrl(path: string[]): string {
  return `/api/pilot/elements/${path.join("/")}/versions`
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ElementBrowserProps {
  path: string[]
  onNavigate: (path: string[]) => void
  /** Called after each fetch: true when /versions can be queried */
  onHasVersions: (has: boolean) => void
}

export function ElementBrowser({
  path,
  onNavigate,
  onHasVersions,
}: ElementBrowserProps) {
  const [ouChildren, setOuChildren] = React.useState<BaseLdapModel[]>([])
  const [node, setNode] = React.useState<LdapOrganizationalUnit | null>(null)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setOuChildren([])
    setNode(null)
    onHasVersions(false)
    try {
      const res = await fetch(apiUrl(path))
      if (!res.ok) {
        toast.error("Impossible de charger les éléments")
        return
      }
      const data = (await res.json()) as OuNodeDto | { error: string }
      if ("error" in data) {
        toast.error(data.error)
        return
      }

      setNode(data.node)
      setOuChildren(data.children.filter(isOu))
      onHasVersions(atOrPastPivot(data.node, path))
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.join("/")])

  React.useEffect(() => {
    load()
  }, [load])

  // Visual hint: are we past the pivot (at a type leaf)?
  const isPivot = node?.id === "elements"
  const isPastPivot = !isPivot && path.includes("elements")

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        <button
          onClick={() => onNavigate([])}
          className="flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Racine"
        >
          <Home className="size-3.5" />
        </button>
        {path.map((segment, i) => {
          const isLast = i === path.length - 1
          const isPivotSegment = segment === "elements"
          return (
            <React.Fragment key={i}>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              {isLast ? (
                <span
                  className={`max-w-xs truncate font-medium ${isPivotSegment ? "text-amber-600 dark:text-amber-400" : ""}`}
                >
                  {segment}
                </span>
              ) : (
                <button
                  onClick={() => onNavigate(path.slice(0, i + 1))}
                  className={`max-w-xs cursor-pointer truncate transition-colors hover:text-foreground ${
                    isPivotSegment
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {segment}
                </button>
              )}
            </React.Fragment>
          )
        })}
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto shrink-0"
          onClick={load}
          disabled={loading}
          aria-label="Actualiser"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
        </Button>
      </div>

      {/* Current node info */}
      {node && (node.ou?.[0] || node.description?.[0]) && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-0.5">
          {node.ou?.[0] && (
            <p className="text-sm font-medium truncate">{node.ou[0]}</p>
          )}
          {node.description?.[0] && (
            <p className="text-xs text-muted-foreground">
              {node.description[0]}
            </p>
          )}
        </div>
      )}

      {/* OU children — chip grid */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Chargement…
        </div>
      ) : ouChildren.length === 0 ? (
        // At a leaf (type node): no sub-OUs, versions shown in panel below
        (isPivot || isPastPivot) ? null : (
          path.length > 0 ? null : (
            <p className="py-4 text-sm text-muted-foreground">
              Aucun élément racine.
            </p>
          )
        )
      ) : (
        <div className="flex flex-wrap gap-2">
          {ouChildren.map((ou) => {
            const isFolderPivot = ou.id === "elements"
            return (
              <button
                key={ou.dn}
                onClick={() => onNavigate([...path, ou.id])}
                className={`flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted/60 hover:border-foreground/20 active:bg-muted ${
                  isFolderPivot
                    ? "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                    : ""
                }`}
              >
                <Folder
                  className={`size-4 shrink-0 ${isFolderPivot ? "text-amber-500" : "text-blue-500"}`}
                />
                {ou.id}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
