"use client"

import * as React from "react"
import { ChevronRight, Folder, Home, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  isOu,
  isVersion,
  type BaseLdapModel,
  type LdapOrganizationalUnit,
  type OuNodeDto,
} from "@/types/pilot"

interface OuBrowserProps {
  path: string[]
  onNavigate: (path: string[]) => void
  onHasVersions: (hasVersions: boolean) => void
}

export function OuBrowser({ path, onNavigate, onHasVersions }: OuBrowserProps) {
  const [ouChildren, setOuChildren] = React.useState<BaseLdapModel[]>([])
  const [node, setNode] = React.useState<LdapOrganizationalUnit | null>(null)
  const [loading, setLoading] = React.useState(false)

  const slug = path.join("/")

  const load = React.useCallback(async () => {
    setLoading(true)
    setOuChildren([])
    setNode(null)
    onHasVersions(false)
    try {
      const url =
        path.length === 0
          ? "/api/pilot/logiciels"
          : `/api/pilot/logiciels/${slug}`
      const res = await fetch(url)
      if (!res.ok) {
        toast.error("Impossible de charger les logiciels")
        return
      }
      const data = (await res.json()) as OuNodeDto | { error: string }
      if ("error" in data) {
        toast.error(data.error)
        return
      }

      const ous = data.children.filter(isOu)
      const versions = data.children.filter(isVersion)

      setNode(data.node)
      setOuChildren(ous)
      onHasVersions(versions.length > 0)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  React.useEffect(() => {
    load()
  }, [load])

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
          return (
            <React.Fragment key={i}>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              {isLast ? (
                <span className="max-w-xs truncate font-medium">{segment}</span>
              ) : (
                <button
                  onClick={() => onNavigate(path.slice(0, i + 1))}
                  className="max-w-xs cursor-pointer truncate text-muted-foreground transition-colors hover:text-foreground"
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

      {/* Current node description */}
      {node && (node.ou[0] || node.description[0]) && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-0.5">
          {node.ou[0] && (
            <p className="text-sm font-medium truncate">{node.ou[0]}</p>
          )}
          {node.description[0] && (
            <p className="text-xs text-muted-foreground">{node.description[0]}</p>
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
        path.length > 0 ? null : (
          <p className="py-4 text-sm text-muted-foreground">Aucun logiciel.</p>
        )
      ) : (
        <div className="flex flex-wrap gap-2">
          {ouChildren.map((ou) => (
            <button
              key={ou.dn}
              onClick={() => onNavigate([...path, ou.id])}
              className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted/60 hover:border-foreground/20 active:bg-muted"
            >
              <Folder className="size-4 shrink-0 text-blue-500" />
              {ou.id}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
