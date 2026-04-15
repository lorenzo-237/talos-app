"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ArrowDownToLine,
  Copy,
  Loader2,
  PlayCircle,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useRights } from "@/contexts/auth-context"
import { LOG_COLORS } from "@/lib/log-colors"
import type { LogEntry } from "@/types/build"
import type { RunningBuildInfo } from "@/lib/running-builds"

interface PackageInfo {
  name: string
  filename: string
  output: string
}

interface PackagesResult {
  resolvedVersion: string
  inputVersion: string
  packages: PackageInfo[]
}

type LogFilter = "all" | "error" | "warning"

export default function BuildPage() {
  const [version, setVersion] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [packagesResult, setPackagesResult] =
    React.useState<PackagesResult | null>(null)
  const [selectedPackages, setSelectedPackages] = React.useState<Set<string>>(
    new Set()
  )
  const [building, setBuilding] = React.useState(false)
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [progress, setProgress] = React.useState<{
    current: number
    total: number
  } | null>(null)
  const [buildDone, setBuildDone] = React.useState(false)
  const [hasErrors, setHasErrors] = React.useState(false)
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [logFilter, setLogFilter] = React.useState<LogFilter>("all")
  const [keepTemp, setKeepTemp] = React.useState(false)
  const [activeBuild, setActiveBuild] = React.useState<RunningBuildInfo | null>(
    null
  )

  const logScrollRef = React.useRef<HTMLDivElement>(null)
  // Prevents the programmatic scroll from triggering the "user scrolled up" path
  const isProgrammaticScroll = React.useRef(false)
  // Holds the current EventSource so we can close it on unmount or reconnect
  const esRef = React.useRef<EventSource | null>(null)

  const rights = useRights()
  const versionValid = /^\d+(\.\d+){2,3}$/.test(version.trim())

  // ─── SSE connection ────────────────────────────────────────────────────────
  //
  // Opens (or re-opens) a connection to the build-stream endpoint.
  // The endpoint replays ALL accumulated log entries on every new connection,
  // so calling this function after a navigation or reload recovers the full log.
  //
  // React state setters (setLogs, setBuilding…) are guaranteed to be stable
  // across renders, so it is safe to define this outside of useCallback.
  function connectToStream(buildId: string) {
    // Close any existing connection before opening a new one
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    let receivedAnyMessage = false
    const es = new EventSource(
      `/api/build-stream?buildId=${encodeURIComponent(buildId)}`
    )
    esRef.current = es

    es.onmessage = (event) => {
      receivedAnyMessage = true
      const entry = JSON.parse(event.data) as LogEntry

      setLogs((prev) => [...prev, entry])

      if (entry.type === "progress" && entry.progress) {
        setProgress(entry.progress)
      }
      if (entry.type === "error") {
        setHasErrors(true)
      }
      if (entry.type === "done") {
        setBuildDone(true)
        setBuilding(false)
        setActiveBuild(null)
        es.close()
        esRef.current = null
        // Read hasErrors via the functional updater to avoid stale closure
        setHasErrors((prev) => {
          if (prev)
            toast.warning("Build terminé avec des erreurs — voir les logs")
          else toast.success("Build terminé")
          return prev
        })
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      setBuilding(false)
      setBuildDone(true)
      setActiveBuild(null)

      if (!receivedAnyMessage) {
        // The build logger was not found — server likely restarted
        toast.error("Build introuvable — le serveur a peut-être redémarré")
      }
    }
  }

  // ─── Reconnect on mount ────────────────────────────────────────────────────
  //
  // On mount we ask the server if any build is currently running.
  // This works for every client — not just the one that launched the build.
  // If a build is found we restore the version label and connect to its stream,
  // which replays all accumulated log entries before resuming live streaming.
  React.useEffect(() => {
    async function checkForRunningBuild() {
      try {
        const res = await fetch("/api/build/active")
        if (!res.ok) return
        const { builds } = (await res.json()) as { builds: RunningBuildInfo[] }
        if (builds.length === 0) return

        // If multiple builds are running, connect to the most recent one
        const build = builds.at(-1)!

        setActiveBuild(build)
        setVersion(build.version)
        setBuilding(true)
        setLogs([])
        setProgress(null)
        setBuildDone(false)
        setHasErrors(false)
        setAutoScroll(true)
        setLogFilter("all")

        connectToStream(build.buildId)
      } catch {
        // Network error on mount — silently ignore, user can start fresh
      }
    }

    checkForRunningBuild()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — runs once on mount

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  React.useEffect(() => {
    return () => {
      esRef.current?.close()
    }
  }, [])

  // ─── Auto-scroll ───────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!autoScroll) return
    const el = logScrollRef.current
    if (!el) return
    isProgrammaticScroll.current = true
    el.scrollTop = el.scrollHeight
    requestAnimationFrame(() => {
      isProgrammaticScroll.current = false
    })
  }, [logs, autoScroll])

  function handleLogScroll() {
    if (isProgrammaticScroll.current) return
    const el = logScrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  // ─── Search ────────────────────────────────────────────────────────────────
  async function handleSearch() {
    if (!versionValid) return
    setSearching(true)
    setPackagesResult(null)
    setSelectedPackages(new Set())
    setLogs([])
    setProgress(null)
    setBuildDone(false)
    setBuilding(false)
    try {
      const res = await fetch(
        `/api/packages?version=${encodeURIComponent(version.trim())}`
      )
      if (!res.ok) {
        const data = (await res.json()) as { error: string }
        toast.error(data.error ?? "Erreur lors de la recherche")
        return
      }
      const data = (await res.json()) as PackagesResult
      setPackagesResult(data)
      setSelectedPackages(new Set(data.packages.map((p) => p.name)))
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSearching(false)
    }
  }

  // ─── Build ─────────────────────────────────────────────────────────────────
  async function handleBuild() {
    if (!packagesResult || selectedPackages.size === 0 || building) return

    setBuilding(true)
    setLogs([])
    setProgress(null)
    setBuildDone(false)
    setHasErrors(false)
    setLogFilter("all")
    setAutoScroll(true)

    try {
      const res = await fetch("/api/build", {
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

      // The server registers this build in runningBuilds automatically.
      // Any client that mounts now will find it via GET /api/build/active.
      connectToStream(buildId)
    } catch {
      toast.error("Erreur réseau")
      setBuilding(false)
    }
  }

  // ─── Package selection helpers ─────────────────────────────────────────────
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

  async function copyLogs() {
    const text = logs
      .map(
        (e) =>
          `[${new Date(e.timestamp).toLocaleTimeString()}] [${e.type.toUpperCase()}] ${e.message}`
      )
      .join("\n")
    await navigator.clipboard.writeText(text)
    toast.success("Logs copiés dans le presse-papier")
  }

  // ─── Derived values ────────────────────────────────────────────────────────
  const progressPct = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  const errorCount = logs.filter((e) => e.type === "error").length
  const warningCount = logs.filter((e) => e.type === "warning").length
  const filteredLogs =
    logFilter === "all" ? logs : logs.filter((e) => e.type === logFilter)
  const allSelected =
    !!packagesResult && selectedPackages.size === packagesResult.packages.length

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Générer des packages</h1>
        <p className="text-sm text-muted-foreground">
          Saisissez un numéro de version pour lister les packages disponibles.
        </p>
      </div>

      {/* ── Build in progress summary — replaces the form ─────────────────── */}
      {building && activeBuild ? (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">Build en cours…</span>
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
        </div>
      ) : (
        <>
          {/* ── Version search form ────────────────────────────────────────── */}
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
            <div className="space-y-3">
              {packagesResult.resolvedVersion !==
                packagesResult.inputVersion && (
                <p className="text-sm text-muted-foreground">
                  Version résolue :{" "}
                  <Badge variant="secondary">
                    {packagesResult.inputVersion} →{" "}
                    {packagesResult.resolvedVersion}
                  </Badge>
                </p>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Packages</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={selectAll}
                      disabled={allSelected}
                    >
                      Tout sélectionner
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={deselectAll}
                      disabled={selectedPackages.size === 0}
                    >
                      Tout désélectionner
                    </Button>
                  </div>
                </div>
                {packagesResult.packages.map((pkg) => (
                  <div key={pkg.name} className="flex items-center gap-2">
                    <Checkbox
                      id={pkg.name}
                      checked={selectedPackages.has(pkg.name)}
                      onCheckedChange={() => togglePackage(pkg.name)}
                    />
                    <label
                      htmlFor={pkg.name}
                      className="cursor-pointer text-sm"
                    >
                      {pkg.output || pkg.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {pkg.filename}
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              {rights.canBuild && (
                <>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="keep-temp"
                      checked={keepTemp}
                      onCheckedChange={(v) => setKeepTemp(v === true)}
                    />
                    <label
                      htmlFor="keep-temp"
                      className="cursor-pointer text-sm text-muted-foreground"
                    >
                      Conserver les dossiers temporaires
                    </label>
                  </div>

                  <Button
                    onClick={handleBuild}
                    disabled={building || selectedPackages.size === 0}
                    className="gap-2"
                  >
                    {building ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <PlayCircle />
                    )}
                    Générer
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {logs.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Logs</Label>
                {buildDone && (
                  <Badge variant={hasErrors ? "destructive" : "secondary"}>
                    {hasErrors ? "Terminé avec erreurs" : "Terminé"}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={copyLogs}
                  title="Copier les logs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copier
                </Button>
                <Button
                  variant={autoScroll ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setAutoScroll((v) => !v)}
                  title="Suivi automatique"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  Suivi
                </Button>
              </div>
            </div>

            {/* Filter buttons — shown only when there are errors or warnings */}
            {(errorCount > 0 || warningCount > 0) && (
              <div className="flex gap-1">
                <Button
                  variant={logFilter === "all" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setLogFilter("all")}
                >
                  Tous ({logs.length})
                </Button>
                {errorCount > 0 && (
                  <Button
                    variant={logFilter === "error" ? "destructive" : "ghost"}
                    size="xs"
                    onClick={() => setLogFilter("error")}
                    className={
                      logFilter !== "error"
                        ? "text-red-700 dark:text-red-400"
                        : ""
                    }
                  >
                    Erreurs ({errorCount})
                  </Button>
                )}
                {warningCount > 0 && (
                  <Button
                    variant={logFilter === "warning" ? "secondary" : "ghost"}
                    size="xs"
                    onClick={() => setLogFilter("warning")}
                    className={
                      logFilter !== "warning"
                        ? "text-yellow-700 dark:text-yellow-400"
                        : ""
                    }
                  >
                    Avertissements ({warningCount})
                  </Button>
                )}
              </div>
            )}

            {/* Progress bar */}
            {progress && <Progress value={progressPct} className="h-2" />}

            {/* Log area */}
            <div
              ref={logScrollRef}
              onScroll={handleLogScroll}
              className="rounded-md border bg-muted/30 p-3 font-mono text-xs"
              style={{
                resize: "vertical",
                overflow: "auto",
                height: "24rem",
                minHeight: "8rem",
              }}
            >
              <div className="space-y-0.5">
                {filteredLogs.map((entry, i) => (
                  <div
                    key={i}
                    className={LOG_COLORS[entry.type] ?? "text-foreground"}
                  >
                    <span className="mr-2 opacity-50">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {entry.message}
                  </div>
                ))}
              </div>
            </div>

            {/* Build summary */}
            {buildDone && (
              <p className="text-xs text-muted-foreground">
                {errorCount === 0 && warningCount === 0
                  ? "Aucune erreur ni avertissement"
                  : [
                      errorCount > 0 &&
                        `${errorCount} erreur${errorCount > 1 ? "s" : ""}`,
                      warningCount > 0 &&
                        `${warningCount} avertissement${warningCount > 1 ? "s" : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
