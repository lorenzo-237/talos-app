"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { OuBrowser } from "@/components/pilot/ou-browser"
import { VersionList } from "@/components/pilot/version-list"
import { VersionDetail } from "@/components/pilot/version-detail"
import type { VersionModel } from "@/types/pilot"

// ── URL conventions ───────────────────────────────────────────────────────────
//
//   /logiciels                         → racine
//   /logiciels/Medoc                   → OU "Medoc"
//   /logiciels/Medoc/SousDossier       → sous-OU "SousDossier"
//   /logiciels/Medoc?v=uid123          → détail version uid123 dans Medoc
//
// Stratégie :
//   GET /logiciels/{slug} retourne un OuNodeDto avec node + children.
//   OuBrowser sépare les enfants par type et notifie hasVersions.
//   Si hasVersions=true → VersionList dans le panneau droit.
//   Si ?v= → VersionDetail dans le panneau droit.

function LogicielsContent() {
  const params = useParams<{ slug?: string[] }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const ouPath: string[] = params.slug ?? []
  const slug = ouPath.join("/")
  const hasSlug = ouPath.length > 0

  const versionUid = searchParams.get("v")

  // Set by OuBrowser when the current node has versionMedocAdsion children
  const [hasVersions, setHasVersions] = React.useState(false)

  // Reset version panel when path changes (new navigation)
  React.useEffect(() => {
    setHasVersions(false)
  }, [slug])

  function handleNavigate(path: string[]) {
    const href =
      path.length === 0 ? "/logiciels" : `/logiciels/${path.join("/")}`
    router.push(href)
  }

  function handleSelectVersion(version: VersionModel) {
    router.push(`/logiciels/${slug}?v=${version.id}`)
  }

  function handleBack() {
    router.push(`/logiciels/${slug}`)
  }

  // Decide what to render in the right panel
  function renderRightPanel() {
    if (!hasSlug) {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">
            Sélectionnez un logiciel pour voir ses versions.
          </p>
        </div>
      )
    }

    if (versionUid) {
      return (
        <VersionDetail slug={slug} uid={versionUid} onBack={handleBack} />
      )
    }

    if (hasVersions) {
      return (
        <VersionList
          slug={slug}
          selectedUid={versionUid}
          onSelect={handleSelectVersion}
        />
      )
    }

    // Has slug but no versions detected yet (loading) or leaf with only sub-OUs
    return null
  }

  const rightPanel = renderRightPanel()

  return (
    <div className="space-y-4">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold">Logiciels</h1>
        <p className="text-sm text-muted-foreground">
          Parcourir les logiciels, leurs versions et leurs éléments.
        </p>
      </div>

      <Separator />

      {/* ── Arborescence (full width) ─────────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Arborescence
        </p>
        <OuBrowser
          path={ouPath}
          onNavigate={handleNavigate}
          onHasVersions={setHasVersions}
        />
      </div>

      {/* ── Content panel ─────────────────────────────────────────────────── */}
      {rightPanel && (
        <>
          <Separator />
          {rightPanel}
        </>
      )}
    </div>
  )
}

export default function LogicielsPage() {
  return (
    <React.Suspense>
      <LogicielsContent />
    </React.Suspense>
  )
}
