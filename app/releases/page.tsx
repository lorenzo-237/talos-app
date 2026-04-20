"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Archive,
  ArrowRightLeft,
  ChevronRight,
  File,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Home,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { useRights } from "@/contexts/auth-context"
import type { Environment } from "@/types/build"
import type { BrowseEntry } from "@/app/api/releases/browse/route"

// ── Constants ─────────────────────────────────────────────────────────────────

const ENVIRONMENTS: Environment[] = ["prod", "test", "dev"]

const ENV_LABELS: Record<Environment, string> = {
  prod: "PROD",
  test: "TEST",
  dev: "DEV",
}

const ENV_CLASS: Record<Environment, string> = {
  prod: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  test: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  dev: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

type LucideIcon = React.ComponentType<{ className?: string }>

function getFileIcon(name: string): LucideIcon {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  switch (ext) {
    case "7z":
    case "zip":
    case "tar":
      return Archive
    case "ini":
    case "cfg":
    case "json":
    case "xml":
    case "toml":
      return FileCode
    case "txt":
    case "log":
    case "md":
      return FileText
    default:
      return File
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * depth 0 = version list (root of outputDir)
 * depth 1 = package list (inside a version dir)
 * depth 2+ = package contents
 */
type ExplorerPath = string[] // e.g. ["3.3.3.1", "Medoc_3.3.3.1", "subdir"]

interface ConfirmDelete {
  version: string
  name: string
}

// ── Per-env explorer state ────────────────────────────────────────────────────

interface EnvState {
  path: ExplorerPath
  entries: BrowseEntry[]
  loading: boolean
}

const initialEnvState = (): EnvState => ({
  path: [],
  entries: [],
  loading: false,
})

// ── Main component ────────────────────────────────────────────────────────────

export default function ReleasesPage() {
  const rights = useRights()

  const [activeTab, setActiveTab] = React.useState<Environment>("prod")
  const [envStates, setEnvStates] = React.useState<
    Record<Environment, EnvState>
  >({
    prod: initialEnvState(),
    test: initialEnvState(),
    dev: initialEnvState(),
  })
  const [confirmDelete, setConfirmDelete] =
    React.useState<ConfirmDelete | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [moving, setMoving] = React.useState<string | null>(null)

  function updateEnv(
    env: Environment,
    patch: Partial<EnvState> | ((prev: EnvState) => Partial<EnvState>)
  ) {
    setEnvStates((prev) => ({
      ...prev,
      [env]: {
        ...prev[env],
        ...(typeof patch === "function" ? patch(prev[env]) : patch),
      },
    }))
  }

  // ── Browse ──────────────────────────────────────────────────────────────────

  async function browse(env: Environment, segments: ExplorerPath) {
    updateEnv(env, { loading: true })
    try {
      const params = new URLSearchParams({
        env,
        path: segments.join("/"),
      })
      const res = await fetch(`/api/releases/browse?${params}`)
      if (!res.ok) {
        toast.error("Impossible de charger le dossier")
        return
      }
      const data = (await res.json()) as { entries: BrowseEntry[] }
      updateEnv(env, { path: segments, entries: data.entries, loading: false })
    } catch {
      toast.error("Erreur réseau")
      updateEnv(env, { loading: false })
    }
  }

  // Load root on mount for all envs
  React.useEffect(() => {
    ENVIRONMENTS.forEach((e) => browse(e, []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function navigateTo(env: Environment, segments: ExplorerPath) {
    setConfirmDelete(null)
    browse(env, segments)
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(env: Environment) {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const res = await fetch("/api/releases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          env,
          version: confirmDelete.version,
          name: confirmDelete.name,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la suppression")
        return
      }
      toast.success(`${confirmDelete.name} supprimé`)
      const { path: currentPath } = envStates[env]
      // If we're inside the deleted package, go up to version level
      if (
        currentPath.length >= 2 &&
        currentPath[0] === confirmDelete.version &&
        currentPath[1] === confirmDelete.name
      ) {
        await browse(env, [confirmDelete.version])
      } else {
        await browse(env, currentPath)
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  // ── Move ────────────────────────────────────────────────────────────────────

  async function handleMove(
    from: Environment,
    to: Environment,
    version: string,
    name: string
  ) {
    const key = `${from}/${version}/${name}`
    setMoving(key)
    try {
      const res = await fetch("/api/releases/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, version, name }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors du déplacement")
        return
      }
      toast.success(
        `${name} déplacé de ${ENV_LABELS[from]} vers ${ENV_LABELS[to]}`
      )
      await Promise.all([
        browse(from, envStates[from].path),
        browse(to, envStates[to].path),
      ])
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setMoving(null)
    }
  }

  const otherEnvs = (env: Environment): Environment[] =>
    ENVIRONMENTS.filter((e) => e !== env)

  // ── Render explorer for one env ─────────────────────────────────────────────

  function renderExplorer(env: Environment) {
    const { path: currentPath, entries, loading } = envStates[env]
    const depth = currentPath.length

    // At depth 1+, the "active package" is currentPath[1] (if we're browsing inside)
    // At depth 1, each row is a package → show move/delete
    // At depth >= 2, we're inside a package → show package action bar
    const insidePackage = depth >= 2
    const packageVersion = insidePackage ? currentPath[0] : null
    const packageName = insidePackage ? currentPath[1] : null

    return (
      <div className="space-y-3">
        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => navigateTo(env, [])}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="size-3.5" />
          </button>
          {currentPath.map((segment, i) => {
            const isLast = i === currentPath.length - 1
            const targetPath = currentPath.slice(0, i + 1)
            return (
              <React.Fragment key={i}>
                <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                {isLast ? (
                  <span className="font-medium truncate max-w-48">
                    {segment}
                  </span>
                ) : (
                  <button
                    onClick={() => navigateTo(env, targetPath)}
                    className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-48"
                  >
                    {segment}
                  </button>
                )}
              </React.Fragment>
            )
          })}

          <div className="ml-auto shrink-0">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => browse(env, currentPath)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* ── Package action bar (when inside a package) ──────────────────── */}
        {insidePackage && packageVersion && packageName && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Folder className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{packageName}</span>
            <span className="text-xs text-muted-foreground">
              ({packageVersion})
            </span>
            <div className="ml-auto flex items-center gap-1">
              {rights.canMoveReleases && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs"
                      disabled={
                        moving ===
                        `${env}/${packageVersion}/${packageName}`
                      }
                    >
                      {moving ===
                      `${env}/${packageVersion}/${packageName}` ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <ArrowRightLeft className="size-3" />
                      )}
                      Déplacer vers…
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {otherEnvs(env).map((target) => (
                      <DropdownMenuItem
                        key={target}
                        onClick={() =>
                          handleMove(
                            env,
                            target,
                            packageVersion,
                            packageName
                          )
                        }
                      >
                        <span
                          className={`mr-2 inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${ENV_CLASS[target]}`}
                        >
                          {ENV_LABELS[target]}
                        </span>
                        {ENV_LABELS[target]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {rights.canDeleteReleases &&
                (confirmDelete?.version === packageVersion &&
                confirmDelete.name === packageName ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      Supprimer ?
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7"
                      onClick={() => handleDelete(env)}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                      Oui
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={() => setConfirmDelete(null)}
                      disabled={deleting}
                    >
                      <X className="size-3" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setConfirmDelete({
                        version: packageVersion,
                        name: packageName,
                      })
                    }
                  >
                    <Trash2 className="size-3" />
                    Supprimer
                  </Button>
                ))}
            </div>
          </div>
        )}

        <Separator />

        {/* ── Entries ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Chargement…
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Dossier vide.
          </p>
        ) : (
          <div className="divide-y rounded-md border overflow-hidden">
            {entries.map((entry) => {
              const isPackageRow = depth === 1 && entry.isDir
              const moveKey = isPackageRow
                ? `${env}/${currentPath[0]}/${entry.name}`
                : null
              const isMoving = moveKey !== null && moving === moveKey
              const isConfirmingDelete =
                isPackageRow &&
                confirmDelete?.version === currentPath[0] &&
                confirmDelete.name === entry.name

              const Icon: LucideIcon = entry.isDir
                ? depth === 0
                  ? Folder
                  : FolderOpen
                : getFileIcon(entry.name)

              return (
                <div
                  key={entry.name}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors group"
                >
                  {/* Icon */}
                  <Icon
                    className={`size-4 shrink-0 ${
                      entry.isDir
                        ? "text-amber-500 dark:text-amber-400"
                        : "text-muted-foreground"
                    }`}
                  />

                  {/* Name — clickable for dirs */}
                  {entry.isDir ? (
                    <button
                      className="flex-1 truncate text-left text-sm font-medium hover:underline"
                      onClick={() =>
                        navigateTo(env, [...currentPath, entry.name])
                      }
                    >
                      {entry.name}
                    </button>
                  ) : (
                    <span className="flex-1 truncate text-sm font-mono">
                      {entry.name}
                    </span>
                  )}

                  {/* Meta */}
                  <span className="shrink-0 text-xs text-muted-foreground hidden sm:block">
                    {entry.size !== undefined
                      ? formatSize(entry.size)
                      : ""}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground hidden md:block w-32 text-right">
                    {formatDate(entry.updatedAt)}
                  </span>

                  {/* Package-level actions (depth === 1, dirs only) */}
                  {isPackageRow && (
                    <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isConfirmingDelete ? (
                        <>
                          <span className="text-xs text-muted-foreground">
                            Supprimer ?
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 text-xs"
                            onClick={() => handleDelete(env)}
                            disabled={deleting}
                          >
                            {deleting ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Trash2 className="size-3" />
                            )}
                            Oui
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6"
                            onClick={() => setConfirmDelete(null)}
                            disabled={deleting}
                          >
                            <X className="size-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {rights.canMoveReleases && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 gap-1 text-xs"
                                  disabled={isMoving}
                                >
                                  {isMoving ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <ArrowRightLeft className="size-3" />
                                  )}
                                  Déplacer
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {otherEnvs(env).map((target) => (
                                  <DropdownMenuItem
                                    key={target}
                                    onClick={() =>
                                      handleMove(
                                        env,
                                        target,
                                        currentPath[0],
                                        entry.name
                                      )
                                    }
                                  >
                                    <span
                                      className={`mr-2 inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${ENV_CLASS[target]}`}
                                    >
                                      {ENV_LABELS[target]}
                                    </span>
                                    {ENV_LABELS[target]}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {rights.canDeleteReleases && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 gap-1 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setConfirmDelete({
                                  version: currentPath[0],
                                  name: entry.name,
                                })
                              }
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Page render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Releases</h1>
        <p className="text-sm text-muted-foreground">
          Packages générés par environnement.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as Environment)}
      >
        <TabsList>
          {ENVIRONMENTS.map((env) => (
            <TabsTrigger key={env} value={env}>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-semibold ${ENV_CLASS[env]}`}
              >
                {ENV_LABELS[env]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {ENVIRONMENTS.map((env) => (
          <TabsContent key={env} value={env} className="mt-4">
            {renderExplorer(env)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
