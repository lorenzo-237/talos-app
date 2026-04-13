"use client"

import * as React from "react"
import { toast } from "sonner"
import { ArrowDownToLine, Copy, Loader2, PlayCircle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import type { LogEntry } from "@/types/build"

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

const LOG_COLORS: Record<string, string> = {
  log: "text-foreground",
  warning: "text-yellow-500",
  error: "text-red-500",
  done: "text-green-500",
  progress: "text-blue-500",
}

type LogFilter = "all" | "error" | "warning"

export default function BuildPage() {
  const [version, setVersion] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [packagesResult, setPackagesResult] = React.useState<PackagesResult | null>(null)
  const [selectedPackages, setSelectedPackages] = React.useState<Set<string>>(new Set())
  const [building, setBuilding] = React.useState(false)
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [progress, setProgress] = React.useState<{ current: number; total: number } | null>(null)
  const [buildDone, setBuildDone] = React.useState(false)
  const [hasErrors, setHasErrors] = React.useState(false)
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [logFilter, setLogFilter] = React.useState<LogFilter>("all")
  const [keepTemp, setKeepTemp] = React.useState(false)
  const logScrollRef = React.useRef<HTMLDivElement>(null)
  // Prevents the programmatic scroll from triggering the "user scrolled up" path
  const isProgrammaticScroll = React.useRef(false)

  const versionValid = /^\d+(\.\d+){2,3}$/.test(version.trim())

  // Auto-scroll to bottom when new logs arrive
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
      const res = await fetch(`/api/packages?version=${encodeURIComponent(version.trim())}`)
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

      const { buildId } = (await res.json()) as { buildId: string }

      const es = new EventSource(
        `/api/build-stream?buildId=${encodeURIComponent(buildId)}`
      )

      es.onmessage = (event) => {
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
          es.close()
          setHasErrors((prev) => {
            if (prev) toast.warning("Build terminé avec des erreurs — voir les logs")
            else toast.success("Build terminé")
            return prev
          })
        }
      }

      es.onerror = () => {
        es.close()
        setBuilding(false)
        setBuildDone(true)
      }
    } catch {
      toast.error("Erreur réseau")
      setBuilding(false)
    }
  }

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

  const progressPct = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  const errorCount = logs.filter((e) => e.type === "error").length
  const warningCount = logs.filter((e) => e.type === "warning").length

  const filteredLogs =
    logFilter === "all" ? logs : logs.filter((e) => e.type === logFilter)

  const allSelected =
    !!packagesResult && selectedPackages.size === packagesResult.packages.length

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Générer des packages</h1>
        <p className="text-sm text-muted-foreground">
          Saisissez un numéro de version pour lister les packages disponibles.
        </p>
      </div>

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
          <Button onClick={handleSearch} disabled={!versionValid || searching}>
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            Rechercher
          </Button>
        </div>
      </div>

      {packagesResult && (
        <div className="space-y-3">
          {packagesResult.resolvedVersion !== packagesResult.inputVersion && (
            <p className="text-sm text-muted-foreground">
              Version résolue :{" "}
              <Badge variant="secondary">
                {packagesResult.inputVersion} → {packagesResult.resolvedVersion}
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
                <label htmlFor={pkg.name} className="cursor-pointer text-sm">
                  {pkg.output || pkg.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {pkg.filename}
                  </span>
                </label>
              </div>
            ))}
          </div>

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
            {building ? <Loader2 className="animate-spin" /> : <PlayCircle />}
            Générer
          </Button>
        </div>
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
                    className={logFilter !== "error" ? "text-red-500" : ""}
                  >
                    Erreurs ({errorCount})
                  </Button>
                )}
                {warningCount > 0 && (
                  <Button
                    variant={logFilter === "warning" ? "secondary" : "ghost"}
                    size="xs"
                    onClick={() => setLogFilter("warning")}
                    className={logFilter !== "warning" ? "text-yellow-500" : ""}
                  >
                    Avertissements ({warningCount})
                  </Button>
                )}
              </div>
            )}

            {/* Progress bar */}
            {progress && <Progress value={progressPct} className="h-2" />}

            {/* Log area — resizable, h-96 by default */}
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
