"use client"

import * as React from "react"
import { toast } from "sonner"
import { Folder, File, Loader2, Trash2, FolderPlus, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ExplorerEntry {
  name: string
  type: "file" | "directory"
  size?: number
  modifiedAt?: string
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso?: string): string {
  if (!iso) return ""
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
}

export default function ExplorerPage() {
  const [currentPath, setCurrentPath] = React.useState("")
  const [entries, setEntries] = React.useState<ExplorerEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<ExplorerEntry | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [showNewFolder, setShowNewFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [creatingFolder, setCreatingFolder] = React.useState(false)

  const segments = currentPath ? currentPath.split("/").filter(Boolean) : []

  async function loadPath(path: string) {
    setLoading(true)
    setCurrentPath(path)
    try {
      const res = await fetch(`/api/explorer?path=${encodeURIComponent(path)}`)
      if (!res.ok) {
        toast.error("Impossible de charger ce dossier")
        return
      }
      const data = await res.json() as { entries: ExplorerEntry[] }
      setEntries(data.entries.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1
        return a.name.localeCompare(b.name)
      }))
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadPath("")
  }, [])

  function navigateTo(index: number) {
    const newPath = segments.slice(0, index + 1).join("/")
    loadPath(newPath)
  }

  function handleEntryClick(entry: ExplorerEntry) {
    if (entry.type === "directory") {
      const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
      loadPath(newPath)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const targetPath = currentPath ? `${currentPath}/${deleteTarget.name}` : deleteTarget.name
    try {
      const res = await fetch("/api/explorer", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath }),
      })
      if (!res.ok) {
        toast.error("Erreur lors de la suppression")
        return
      }
      toast.success(`"${deleteTarget.name}" supprimé`)
      setEntries((prev) => prev.filter((e) => e.name !== deleteTarget.name))
      setDeleteTarget(null)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setDeleting(false)
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    setCreatingFolder(true)
    const targetPath = currentPath ? `${currentPath}/${name}` : name
    try {
      const res = await fetch("/api/explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath }),
      })
      if (!res.ok) {
        toast.error("Erreur lors de la création du dossier")
        return
      }
      toast.success(`Dossier "${name}" créé`)
      setShowNewFolder(false)
      setNewFolderName("")
      loadPath(currentPath)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setCreatingFolder(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Explorateur SRC_DIR</h1>
            <p className="text-sm text-muted-foreground">
              Naviguez dans le répertoire source des ressources.
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" onClick={() => setShowNewFolder(true)}>
                <FolderPlus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nouveau dossier</TooltipContent>
          </Tooltip>
        </div>

        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {segments.length === 0 ? (
                <BreadcrumbPage>Racine</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  className="cursor-pointer"
                  onClick={() => loadPath("")}
                >
                  Racine
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {segments.map((seg, idx) => (
              <React.Fragment key={idx}>
                <BreadcrumbSeparator>
                  <ChevronRight className="size-3" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  {idx === segments.length - 1 ? (
                    <BreadcrumbPage>{seg}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="cursor-pointer"
                      onClick={() => navigateTo(idx)}
                    >
                      {seg}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        {/* File list */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Chargement...
          </div>
        ) : (
          <div className="rounded-md border">
            {entries.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Dossier vide.</p>
            ) : (
              <div className="divide-y">
                {entries.map((entry) => (
                  <div
                    key={entry.name}
                    className={`group flex items-center gap-3 px-4 py-2 transition-colors ${
                      entry.type === "directory"
                        ? "cursor-pointer hover:bg-muted/50"
                        : "hover:bg-muted/20"
                    }`}
                    onClick={() => handleEntryClick(entry)}
                  >
                    {entry.type === "directory" ? (
                      <Folder className="size-4 shrink-0 text-blue-500" />
                    ) : (
                      <File className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{entry.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatSize(entry.size)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(entry.modifiedAt)}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="shrink-0 rounded p-1 opacity-0 hover:text-red-500 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(entry)
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Supprimer</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delete dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer</DialogTitle>
              <DialogDescription>
                Supprimer <strong>{deleteTarget?.name}</strong> ?{" "}
                {deleteTarget?.type === "directory" && "Le dossier et tout son contenu seront supprimés. "}
                Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="animate-spin" />}
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New folder dialog */}
        <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau dossier</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Nom du dossier"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewFolder(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || creatingFolder}>
                {creatingFolder && <Loader2 className="animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
