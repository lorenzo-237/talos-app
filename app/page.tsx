"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useRights } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api-fetch"
import { useBuildStream } from "@/hooks/useBuildStream"
import { usePackageSearch } from "@/hooks/usePackageSearch"
import { PackageSelector } from "@/components/build/PackageSelector"
import { BuildLogs } from "@/components/build/BuildLogs"

export default function BuildPage() {
  const [version, setVersion] = React.useState("")
  const [selectedPackages, setSelectedPackages] = React.useState<Set<string>>(
    new Set()
  )
  const [keepTemp, setKeepTemp] = React.useState(false)

  const rights = useRights()
  const versionValid = /^\d+(\.\d+){2,3}$/.test(version.trim())

  const {
    logs,
    progress,
    buildDone,
    hasErrors,
    building,
    activeBuild,
    cancelRequested,
    connectToStream,
    resetBuild,
    cancelActiveBuild,
    setActiveBuild,
    setBuilding,
  } = useBuildStream()

  const { packagesResult, searching, search } = usePackageSearch()

  // When the stream reconnects on mount, restore the version input
  React.useEffect(() => {
    if (activeBuild) {
      setVersion(activeBuild.version)
    }
  }, [activeBuild])

  // ─── Search ──────────────────────────────────────────────────────────────────
  async function handleSearch() {
    if (!versionValid) return
    setSelectedPackages(new Set())
    setBuilding(false)
    setActiveBuild(null)
    resetBuild()
    const result = await search(version.trim())
    // Auto-select all packages after a successful search
    if (result) {
      setSelectedPackages(new Set(result.packages.map((p) => p.name)))
    }
  }

  // ─── Build ───────────────────────────────────────────────────────────────────
  async function handleBuild() {
    if (!packagesResult || selectedPackages.size === 0 || building) return

    resetBuild()
    setBuilding(true)

    try {
      const res = await apiFetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: version.trim(),
          packages: [...selectedPackages],
          keepTemp,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error: string }
        toast.error(data.error ?? "Erreur lors du lancement du build")
        setBuilding(false)
        return
      }

      const { buildId, resolvedVersion } = (await res.json()) as {
        buildId: string
        resolvedVersion: string
      }

      setActiveBuild({
        buildId,
        version: version.trim(),
        resolvedVersion,
        packages: [...selectedPackages],
        startedAt: new Date().toISOString(),
      })

      connectToStream(buildId)
    } catch {
      toast.error("Erreur réseau")
      setBuilding(false)
    }
  }

  // ─── Package selection helpers ────────────────────────────────────────────────
  function togglePackage(name: string) {
    setSelectedPackages((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function selectAll() {
    if (!packagesResult) return
    setSelectedPackages(new Set(packagesResult.packages.map((p) => p.name)))
  }

  function deselectAll() {
    setSelectedPackages(new Set())
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Générer des packages</h1>
        <p className="text-sm text-muted-foreground">
          Saisissez un numéro de version pour lister les packages disponibles.
        </p>
      </div>

      {/* ── Build in progress summary ──────────────────────────────────────── */}
      {building && activeBuild ? (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">Build en cours…</span>
            </div>
            {rights.canBuild && (
              <Button
                variant="ghost"
                size="xs"
                onClick={cancelActiveBuild}
                className="text-muted-foreground hover:text-destructive"
                title="Annuler le build"
              >
                <X className="h-3.5 w-3.5" />
                Annuler
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Version :</span>
            <Badge variant="secondary">
              {activeBuild.resolvedVersion !== activeBuild.version
                ? `${activeBuild.version} → ${activeBuild.resolvedVersion}`
                : activeBuild.version}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Packages :</span>
            {activeBuild.packages.map((p) => (
              <Badge key={p} variant="outline">
                {p}
              </Badge>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Démarré à{" "}
            {new Date(activeBuild.startedAt).toLocaleTimeString("fr-FR")}
          </p>

          {cancelRequested && (
            <p className="text-xs font-medium text-destructive">
              Annulation demandée — le package en cours se terminera, les
              suivants seront ignorés.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* ── Version search form ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="version">Version</Label>
            <div className="flex gap-2">
              <Input
                id="version"
                placeholder="ex. 3.3.3.1"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="max-w-xs"
              />
              {rights.canReadPackages && (
                <Button
                  onClick={handleSearch}
                  disabled={!versionValid || searching}
                >
                  {searching ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Search />
                  )}
                  Rechercher
                </Button>
              )}
            </div>
          </div>

          {packagesResult && (
            <PackageSelector
              packagesResult={packagesResult}
              selectedPackages={selectedPackages}
              keepTemp={keepTemp}
              building={building}
              canBuild={rights.canBuild}
              onToggle={togglePackage}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onKeepTempChange={setKeepTemp}
              onBuild={handleBuild}
            />
          )}
        </>
      )}

      {logs.length > 0 && (
        <>
          <Separator />
          <BuildLogs
            logs={logs}
            progress={progress}
            buildDone={buildDone}
            hasErrors={hasErrors}
          />
        </>
      )}
    </div>
  )
}
