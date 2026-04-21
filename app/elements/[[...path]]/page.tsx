"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { ElementBrowser } from "@/components/pilot/element-browser"
import { ElementPanel } from "@/components/pilot/element-panel"

// ── URL conventions ───────────────────────────────────────────────────────────
//
//   /elements                        → racine
//   /elements/prod/Medoc             → env=prod, logiciel=Medoc
//   /elements/prod/Medoc/update      → env=prod, logiciel=Medoc, type=update
//
// ElementBrowser navigue l'arbre OU.
// ElementPanel charge GET /elements/{path}/versions → tableau d'éléments.
// Le panneau droit s'affiche dès que path.length >= 2 (env + logiciel minimum).

export default function ElementsPage() {
  const params = useParams<{ path?: string[] }>()
  const router = useRouter()

  const navPath: string[] = params.path ?? []
  const hasElements = navPath.length >= 2

  // Notified by ElementBrowser after each fetch
  const [browserHasElements, setBrowserHasElements] = React.useState(false)

  function handleNavigate(path: string[]) {
    const href =
      path.length === 0 ? "/elements" : `/elements/${path.join("/")}`
    router.push(href)
  }

  const showPanel = hasElements || browserHasElements

  return (
    <div className="space-y-4">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold">Éléments</h1>
        <p className="text-sm text-muted-foreground">
          Parcourir les éléments par environnement, logiciel et type.
        </p>
      </div>

      <Separator />

      {/* ── Arborescence (full width) ─────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Arborescence
        </p>
        <ElementBrowser
          path={navPath}
          onNavigate={handleNavigate}
          onHasVersions={setBrowserHasElements}
        />
      </div>

      {/* ── Content panel ─────────────────────────────────────────────────── */}
      {showPanel ? (
        <>
          <Separator />
          <ElementPanel path={navPath} />
        </>
      ) : (
        !hasElements && (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              Naviguez jusqu'à un logiciel pour voir ses éléments.
            </p>
          </div>
        )
      )}
    </div>
  )
}
