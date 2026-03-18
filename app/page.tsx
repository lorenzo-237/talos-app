"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, PlayCircle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
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

export default function BuildPage() {
  const [version, setVersion] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [packagesResult, setPackagesResult] = React.useState<PackagesResult | null>(null)
  const [selectedPackages, setSelectedPackages] = React.useState<Set<string>>(new Set())
  const [building, setBuilding] = React.useState(false)
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [progress, setProgress] = React.useState<{ current: number; total: number } | null>(null)
  const [buildDone, setBuildDone] = React.useState(false)
  const logsEndRef = React.useRef<HTMLDivElement>(null)

  const versionValid = /^\d+(\.\d+){2,3}$/.test(version.trim())

  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  async function handleSearch() {
    if (!versionValid) return
    setSearching(true)
    setPackagesResult(null)
    setLogs([])
    setProgress(null)
    setBuildDone(false)
    try {
      const res = await fetch(`/api/packages?version=${encodeURIComponent(version.trim())}`)
      if (!res.ok) {
        const data = await res.json() as { error: string }
        toast.error(data.error ?? "Erreur lors de la recherche")
        return
      }
      const data = await res.json() as PackagesResult
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

    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: version.trim(),
          packages: [...selectedPackages],
        }),
      })

      if (!res.ok) {
        const data = await res.json() as { error: string }
        toast.error(data.error ?? "Erreur lors du lancement du build")
        setBuilding(false)
        return
      }

      const { buildId } = await res.json() as { buildId: string }

      const es = new EventSource(`/api/build-stream?buildId=${encodeURIComponent(buildId)}`)

      es.onmessage = (event) => {
        const entry = JSON.parse(event.data) as LogEntry
        setLogs((prev) => [...prev, entry])
        if (entry.type === "progress" && entry.progress) {
          setProgress(entry.progress)
        }
        if (entry.type === "done") {
          setBuildDone(true)
          setBuilding(false)
          es.close()
          toast.success("Build terminé")
        }
        if (entry.type === "error") {
          toast.error(entry.message)
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

  const progressPct = progress ? Math.round((progress.current / progress.total) * 100) : 0

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
            <Label>Packages</Label>
            {packagesResult.packages.map((pkg) => (
              <div key={pkg.name} className="flex items-center gap-2">
                <Checkbox
                  id={pkg.name}
                  checked={selectedPackages.has(pkg.name)}
                  onCheckedChange={() => togglePackage(pkg.name)}
                />
                <label htmlFor={pkg.name} className="cursor-pointer text-sm">
                  {pkg.output || pkg.name}
                  <span className="ml-2 text-xs text-muted-foreground">{pkg.filename}</span>
                </label>
              </div>
            ))}
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
            <div className="flex items-center justify-between">
              <Label>Logs</Label>
              {buildDone && <Badge variant="secondary">Terminé</Badge>}
            </div>
            {progress && <Progress value={progressPct} className="h-2" />}
            <ScrollArea className="h-72 rounded-md border bg-muted/30 p-3">
              <div className="space-y-0.5 font-mono text-xs">
                {logs.map((entry, i) => (
                  <div key={i} className={LOG_COLORS[entry.type] ?? "text-foreground"}>
                    <span className="mr-2 opacity-50">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {entry.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  )
}
