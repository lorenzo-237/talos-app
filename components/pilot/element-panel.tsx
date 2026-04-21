"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ElementsTable } from "@/components/pilot/elements-table"
import { versionsUrl } from "@/components/pilot/element-browser"
import {
  ETAT_LABELS,
  type ElementModel,
  type ElementResponseDto,
  type EtatVersion,
} from "@/types/pilot"

// ── Filters ───────────────────────────────────────────────────────────────────

const ETAT_FILTERS: Array<{ value: EtatVersion | "all"; label: string }> = [
  { value: "all", label: "Tous" },
  { value: 2, label: ETAT_LABELS[2] },
  { value: 1, label: ETAT_LABELS[1] },
  { value: 0, label: ETAT_LABELS[0] },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface ElementPanelProps {
  /** Current navigation path, e.g. ["prod", "Medoc"] or ["prod", "Medoc", "update"] */
  path: string[]
}

export function ElementPanel({ path }: ElementPanelProps) {
  const [elements, setElements] = React.useState<ElementModel[]>([])
  const [loading, setLoading] = React.useState(false)
  const [etatFilter, setEtatFilter] = React.useState<EtatVersion | "all">("all")

  const load = React.useCallback(async () => {
    setLoading(true)
    setElements([])
    try {
      const params = new URLSearchParams()
      if (etatFilter !== "all") params.set("etat_version", String(etatFilter))
      const res = await fetch(`${versionsUrl(path)}?${params}`)
      if (!res.ok) {
        toast.error("Impossible de charger les éléments")
        return
      }
      const data = (await res.json()) as ElementResponseDto | { error: string }
      if ("error" in data) {
        toast.error(data.error)
        return
      }
      setElements(data.rows)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.join("/"), etatFilter])

  React.useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Éléments</h2>
          <p className="text-xs text-muted-foreground">
            {path.join(" / ")}
          </p>
        </div>

        {/* État filter pills */}
        <div className="flex items-center gap-1">
          {ETAT_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setEtatFilter(f.value)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                etatFilter === f.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Chargement…
        </div>
      ) : elements.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Aucun élément pour ce chemin.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {elements.length} élément{elements.length !== 1 ? "s" : ""}
          </p>
          <ElementsTable elements={elements} />
        </>
      )}
    </div>
  )
}
