"use client"

import * as React from "react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type { LogEntry } from "@/types/build"
import type { RunningBuildInfo } from "@/lib/running-builds"

interface BuildStreamState {
  logs: LogEntry[]
  progress: { current: number; total: number } | null
  buildDone: boolean
  hasErrors: boolean
  building: boolean
  activeBuild: RunningBuildInfo | null
  cancelRequested: boolean
}

interface UseBuildStream extends BuildStreamState {
  connectToStream: (buildId: string) => void
  resetBuild: () => void
  cancelActiveBuild: () => Promise<void>
  setActiveBuild: React.Dispatch<React.SetStateAction<RunningBuildInfo | null>>
  setBuilding: React.Dispatch<React.SetStateAction<boolean>>
}

export function useBuildStream(): UseBuildStream {
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [progress, setProgress] = React.useState<{
    current: number
    total: number
  } | null>(null)
  const [buildDone, setBuildDone] = React.useState(false)
  const [hasErrors, setHasErrors] = React.useState(false)
  const [building, setBuilding] = React.useState(false)
  const [activeBuild, setActiveBuild] =
    React.useState<RunningBuildInfo | null>(null)
  const [cancelRequested, setCancelRequested] = React.useState(false)

  // Holds the current EventSource so we can close it on unmount / reconnect
  const esRef = React.useRef<EventSource | null>(null)

  function connectToStream(buildId: string) {
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
        setCancelRequested(false)
        es.close()
        esRef.current = null
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
      setCancelRequested(false)

      if (!receivedAnyMessage) {
        toast.error("Build introuvable — le serveur a peut-être redémarré")
      }
    }
  }

  async function cancelActiveBuild() {
    if (!activeBuild) return
    try {
      const res = await apiFetch("/api/build/active", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId: activeBuild.buildId }),
      })
      if (res.ok) {
        setCancelRequested(true)
      } else {
        const data = (await res.json()) as { error: string }
        toast.error(data.error ?? "Impossible d'annuler le build")
      }
    } catch {
      toast.error("Erreur réseau lors de l'annulation")
    }
  }

  // Resets only log-related state. building and activeBuild are managed
  // explicitly by the caller so they are not cleared here.
  function resetBuild() {
    setLogs([])
    setProgress(null)
    setBuildDone(false)
    setHasErrors(false)
    setCancelRequested(false)
  }

  // On mount: check if a build is already running and reconnect to its stream
  React.useEffect(() => {
    async function checkForRunningBuild() {
      try {
        const res = await apiFetch("/api/build/active")
        if (!res.ok) return
        const { builds } = (await res.json()) as { builds: RunningBuildInfo[] }
        if (builds.length === 0) return

        const build = builds.at(-1)!
        setActiveBuild(build)
        setBuilding(true)
        setCancelRequested(build.cancelRequested ?? false)
        setLogs([])
        setProgress(null)
        setBuildDone(false)
        setHasErrors(false)
        connectToStream(build.buildId)
      } catch {
        // Network error on mount — silently ignore
      }
    }

    checkForRunningBuild()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — runs once on mount

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      esRef.current?.close()
    }
  }, [])

  return {
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
  }
}
