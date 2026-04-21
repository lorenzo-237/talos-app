"use client"

import * as React from "react"
import { ArrowLeft, Fingerprint, Loader2, Server } from "lucide-react"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { EtatBadge, ElementsTable, first } from "@/components/pilot/elements-table"
import {
  type ElementModel,
  type ElementResponseDto,
  type VersionModel,
} from "@/types/pilot"

// ── Version detail ────────────────────────────────────────────────────────────

interface VersionDetailProps {
  /** OU slug, e.g. "Medoc" or "Medoc/SousDossier" */
  slug: string
  /** Version uid — the component fetches the full VersionModel itself */
  uid: string
  onBack: () => void
}

export function VersionDetail({ slug, uid, onBack }: VersionDetailProps) {
  const [version, setVersion] = React.useState<VersionModel | null>(null)
  const [elements, setElements] = React.useState<ElementModel[]>([])
  const [loadingVersion, setLoadingVersion] = React.useState(false)
  const [loadingElements, setLoadingElements] = React.useState(false)

  // Fetch version
  React.useEffect(() => {
    async function loadVersion() {
      setLoadingVersion(true)
      setVersion(null)
      try {
        const res = await fetch(`/api/pilot/logiciels/${slug}/versions/${uid}`)
        if (!res.ok) {
          toast.error("Impossible de charger la version")
          return
        }
        const data = (await res.json()) as VersionModel | { error: string }
        if ("error" in data) {
          toast.error(data.error)
          return
        }
        setVersion(data)
      } catch {
        toast.error("Erreur réseau")
      } finally {
        setLoadingVersion(false)
      }
    }
    loadVersion()
  }, [slug, uid])

  // Fetch elements
  React.useEffect(() => {
    async function loadElements() {
      setLoadingElements(true)
      setElements([])
      try {
        const res = await fetch(
          `/api/pilot/logiciels/${slug}/versions/${uid}/elements`
        )
        if (!res.ok) {
          toast.error("Impossible de charger les éléments")
          return
        }
        const data = (await res.json()) as
          | ElementResponseDto
          | { error: string }
        if ("error" in data) {
          toast.error(data.error)
          return
        }
        setElements(data.rows)
      } catch {
        toast.error("Erreur réseau")
      } finally {
        setLoadingElements(false)
      }
    }
    loadElements()
  }, [slug, uid])

  const numVer = version ? first(version.adsion_numVersion) : uid
  const etat = version?.adsion_etatVersion[0]
  const ftpAddr = version?.adsion_adresseFTP[0]
  const ftpPath = version?.adsion_cheminFTP[0]
  const ftpLogin = version?.adsion_loginFTP[0]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="xs" onClick={onBack} className="-ml-1">
          <ArrowLeft className="size-3.5" />
          Retour aux versions
        </Button>
      </div>

      {/* Version summary */}
      <div className="space-y-3 rounded-lg border bg-card p-4">
        {loadingVersion ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Chargement…
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">{numVer}</h2>
                <p className="font-mono text-xs text-muted-foreground">{uid}</p>
              </div>
              {etat !== undefined && <EtatBadge etat={etat} />}
            </div>

            {(ftpAddr || ftpPath) && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <Server className="size-3.5" />
                    FTP
                  </p>
                  <div className="space-y-0.5 font-mono text-xs text-muted-foreground">
                    {ftpAddr && (
                      <p>
                        <span className="text-foreground">{ftpAddr}</span>
                        {ftpPath ? `/${ftpPath}` : ""}
                      </p>
                    )}
                    {ftpLogin && (
                      <p className="flex items-center gap-1">
                        <Fingerprint className="size-3" />
                        {ftpLogin}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Elements */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Éléments</h3>
          {!loadingElements && elements.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {elements.length} élément{elements.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loadingElements ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Chargement…
          </div>
        ) : elements.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Aucun élément associé.
          </p>
        ) : (
          <ElementsTable elements={elements} />
        )}
      </div>
    </div>
  )
}
