"use client"

import * as React from "react"
import { Loader2, Tag } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  ETAT_CLASS,
  ETAT_LABELS,
  type EtatVersion,
  type VersionModel,
  type VersionResponseDto,
} from "@/types/pilot"

const ETAT_FILTERS: Array<{ value: EtatVersion | "all"; label: string }> = [
  { value: "all", label: "Tous" },
  { value: 2, label: "Prod" },
  { value: 1, label: "Test" },
  { value: 0, label: "Bêta" },
]

interface VersionListProps {
  /** OU slug, e.g. "Medoc" or "Medoc/SousDossier" */
  slug: string
  selectedUid: string | null
  onSelect: (version: VersionModel) => void
}

export function VersionList({ slug, selectedUid, onSelect }: VersionListProps) {
  const [versions, setVersions] = React.useState<VersionModel[]>([])
  const [loading, setLoading] = React.useState(false)
  const [etatFilter, setEtatFilter] = React.useState<EtatVersion | "all">("all")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (etatFilter !== "all") params.set("etatVersion", String(etatFilter))
      const res = await fetch(
        `/api/pilot/logiciels/${slug}/versions?${params}`
      )
      if (!res.ok) {
        toast.error("Impossible de charger les versions")
        return
      }
      const data = (await res.json()) as VersionResponseDto | { error: string }
      if ("error" in data) {
        toast.error(data.error)
        return
      }
      setVersions(data.rows)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }, [slug, etatFilter])

  React.useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Versions</h2>
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

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Chargement…
        </div>
      ) : versions.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Aucune version trouvée.
        </p>
      ) : (
        <div className="divide-y rounded-md border overflow-hidden">
          {versions.map((v) => {
            const numVer = v.adsion_numVersion[0] ?? v.id
            const etat = v.adsion_etatVersion[0]
            const isSelected = selectedUid === v.id

            return (
              <button
                key={v.id}
                onClick={() => onSelect(v)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  isSelected ? "bg-muted" : "hover:bg-muted/40"
                }`}
              >
                <Tag className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{numVer}</p>
                  {v.adsion_element.length > 0 && (
                    <p className="text-xs text-muted-foreground truncate">
                      {v.adsion_element.length} élément
                      {v.adsion_element.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                {etat !== undefined && (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${ETAT_CLASS[etat]}`}
                  >
                    {ETAT_LABELS[etat]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
