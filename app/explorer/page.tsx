"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Folder,
  Loader2,
  Trash2,
  FolderPlus,
  ChevronRight,
  Upload,
  AlertTriangle,
  Play,
  Puzzle,
  Database,
  BookMarked,
  HardDrive,
  Layers,
  FileText,
  FileCode2,
  Settings2,
  Archive,
  Eye,
  Download,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useRights } from "@/contexts/auth-context"

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
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

const FILE_ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  exe: { icon: Play, className: "text-orange-400" },
  wdk: { icon: Puzzle, className: "text-green-500" },
  fic: { icon: Database, className: "text-cyan-400" },
  ndx: { icon: BookMarked, className: "text-violet-400" },
  mmo: { icon: HardDrive, className: "text-blue-400" },
  dll: { icon: Layers, className: "text-amber-400" },
  pdf: { icon: FileText, className: "text-red-500" },
  txt: { icon: FileText, className: "text-muted-foreground" },
  rtf: { icon: FileText, className: "text-blue-400" },
  doc: { icon: FileText, className: "text-blue-500" },
  docx: { icon: FileText, className: "text-blue-500" },
  ini: { icon: Settings2, className: "text-muted-foreground" },
  zip: { icon: Archive, className: "text-yellow-500" },
  "7z": { icon: Archive, className: "text-yellow-500" },
}

function getFileIcon(name: string): { icon: LucideIcon; className: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  return FILE_ICONS[ext] ?? { icon: FileCode2, className: "text-muted-foreground" }
}

const PREVIEWABLE_EXTS = new Set(["txt", "ini", "pdf"])
const DOWNLOADABLE_EXTS = new Set([
  "exe", "wdk", "fic", "ndx", "mmo", "dll",
  "rtf", "doc", "docx", "zip", "7z",
])

function getFileAction(name: string): "preview" | "download" | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (PREVIEWABLE_EXTS.has(ext)) return "preview"
  if (DOWNLOADABLE_EXTS.has(ext)) return "download"
  return null
}

type PreviewContent =
  | { kind: "text"; name: string; content: string }
  | { kind: "pdf"; name: string; url: string }

export default function ExplorerPage() {
  const rights = useRights()
  const [currentPath, setCurrentPath] = React.useState("")
  const [entries, setEntries] = React.useState<ExplorerEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<ExplorerEntry | null>(
    null
  )
  const [deleting, setDeleting] = React.useState(false)
  const [showNewFolder, setShowNewFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [creatingFolder, setCreatingFolder] = React.useState(false)

  // Preview state
  const [preview, setPreview] = React.useState<PreviewContent | null>(null)
  const [previewLoading, setPreviewLoading] = React.useState(false)

  // Upload state
  const [showUpload, setShowUpload] = React.useState(false)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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
      const data = (await res.json()) as { entries: ExplorerEntry[] }
      setEntries(
        data.entries.sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      )
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
      const newPath = currentPath
        ? `${currentPath}/${entry.name}`
        : entry.name
      loadPath(newPath)
    }
  }

  async function handlePreview(entry: ExplorerEntry) {
    const filePath = currentPath
      ? `${currentPath}/${entry.name}`
      : entry.name
    const url = `/api/explorer?path=${encodeURIComponent(filePath)}`
    const ext = entry.name.split(".").pop()?.toLowerCase() ?? ""

    if (ext === "pdf") {
      setPreview({ kind: "pdf", name: entry.name, url })
      return
    }

    setPreviewLoading(true)
    try {
      const res = await fetch(url)
      if (!res.ok) {
        toast.error("Impossible de charger le fichier")
        return
      }
      const content = await res.text()
      setPreview({ kind: "text", name: entry.name, content })
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const targetPath = currentPath
      ? `${currentPath}/${deleteTarget.name}`
      : deleteTarget.name
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

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setSelectedFiles(files)
  }

  function openUploadDialog() {
    setSelectedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ""
    setShowUpload(true)
  }

  function closeUploadDialog() {
    setShowUpload(false)
    setSelectedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const existingFileNames = React.useMemo(
    () =>
      new Set(
        entries.filter((e) => e.type === "file").map((e) => e.name)
      ),
    [entries]
  )

  const conflictCount = selectedFiles.filter((f) =>
    existingFileNames.has(f.name)
  ).length

  async function handleUpload() {
    if (selectedFiles.length === 0) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("path", currentPath)
      for (const file of selectedFiles) {
        formData.append("files", file)
      }
      const res = await fetch("/api/explorer", {
        method: "PUT",
        body: formData,
      })
      if (!res.ok) {
        toast.error("Erreur lors de l'upload")
        return
      }
      const count = selectedFiles.length
      toast.success(
        `${count} fichier${count > 1 ? "s" : ""} ajouté${count > 1 ? "s" : ""}`
      )
      closeUploadDialog()
      loadPath(currentPath)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setUploading(false)
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
          {rights.canWriteExplorer && (
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={openUploadDialog}
                  >
                    <Upload />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ajouter des fichiers</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setShowNewFolder(true)}
                  >
                    <FolderPlus />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Nouveau dossier</TooltipContent>
              </Tooltip>
            </div>
          )}
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
                    ) : (() => {
                      const { icon: Icon, className } = getFileIcon(entry.name)
                      return <Icon className={`size-4 shrink-0 ${className}`} />
                    })()}
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {entry.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatSize(entry.size)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(entry.modifiedAt)}
                    </span>
                    {/* Fixed-width action area — always 2 slots wide */}
                    <div className="flex w-14 shrink-0 items-center justify-end">
                      {entry.type === "file" && (() => {
                        const action = getFileAction(entry.name)
                        const filePath = currentPath
                          ? `${currentPath}/${entry.name}`
                          : entry.name
                        if (action === "preview") {
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="rounded p-1 opacity-0 hover:text-primary group-hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handlePreview(entry)
                                  }}
                                >
                                  <Eye className="size-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Aperçu</TooltipContent>
                            </Tooltip>
                          )
                        }
                        if (action === "download") {
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={`/api/explorer?path=${encodeURIComponent(filePath)}&download=1`}
                                  download={entry.name}
                                  className="rounded p-1 opacity-0 hover:text-primary group-hover:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download className="size-3.5" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>Télécharger</TooltipContent>
                            </Tooltip>
                          )
                        }
                        return null
                      })()}
                      {rights.canDeleteExplorer && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="rounded p-1 opacity-0 hover:text-red-500 group-hover:opacity-100"
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delete dialog */}
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer</DialogTitle>
              <DialogDescription>
                Supprimer <strong>{deleteTarget?.name}</strong> ?{" "}
                {deleteTarget?.type === "directory" &&
                  "Le dossier et tout son contenu seront supprimés. "}
                Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
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
              <Button
                variant="outline"
                onClick={() => setShowNewFolder(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
              >
                {creatingFolder && <Loader2 className="animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload dialog */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
        <Dialog open={showUpload} onOpenChange={(open) => !open && closeUploadDialog()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ajouter des fichiers</DialogTitle>
              <DialogDescription>
                Les fichiers seront ajoutés dans{" "}
                <strong>{currentPath || "la racine"}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 size-4" />
                Sélectionner des fichiers
              </Button>

              {selectedFiles.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {selectedFiles.length} fichier
                    {selectedFiles.length > 1 ? "s" : ""} sélectionné
                    {selectedFiles.length > 1 ? "s" : ""}
                    {conflictCount > 0 && (
                      <span className="ml-1 text-amber-500">
                        · {conflictCount} remplacement
                        {conflictCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
                    {selectedFiles.map((file) => {
                      const isConflict = existingFileNames.has(file.name)
                      return (
                        <div
                          key={file.name}
                          className="flex items-center gap-2 px-3 py-2"
                        >
                          {(() => {
                            const { icon: Icon, className } = getFileIcon(file.name)
                            return <Icon className={`size-3.5 shrink-0 ${className}`} />
                          })()}
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {file.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatSize(file.size)}
                          </span>
                          {isConflict && (
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 border-amber-500 text-amber-500 text-xs"
                            >
                              <AlertTriangle className="size-3" />
                              Remplacé
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeUploadDialog}>
                Annuler
              </Button>
              <Button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || uploading}
              >
                {uploading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Upload />
                )}
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Preview loading overlay */}
        {previewLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Preview dialog */}
        <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
          <DialogContent
            className={
              preview?.kind === "pdf"
                ? "flex max-w-5xl flex-col"
                : "max-w-2xl"
            }
          >
            <DialogHeader>
              <DialogTitle className="truncate">{preview?.name}</DialogTitle>
            </DialogHeader>
            {preview?.kind === "text" && (
              <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed whitespace-pre-wrap wrap-break-word">
                {preview.content}
              </pre>
            )}
            {preview?.kind === "pdf" && (
              <iframe
                src={preview.url}
                className="h-[75vh] w-full rounded-md border"
                title={preview.name}
              />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Fermer
              </Button>
              {preview && (() => {
                const filePath = currentPath
                  ? `${currentPath}/${preview.name}`
                  : preview.name
                return (
                  <a
                    href={`/api/explorer?path=${encodeURIComponent(filePath)}&download=1`}
                    download={preview.name}
                  >
                    <Button variant="secondary">
                      <Download className="mr-2 size-4" />
                      Télécharger
                    </Button>
                  </a>
                )
              })()}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
