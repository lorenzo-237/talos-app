"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { Loader2, Save, Trash2, FileJson } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Monaco editor loaded client-side only
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

interface PackageInfo {
  name: string
  filename: string
  output: string
}

export default function PackagesPage() {
  const [versions, setVersions] = React.useState<string[]>([])
  const [selectedVersion, setSelectedVersion] = React.useState<string>("")
  const [packages, setPackages] = React.useState<PackageInfo[]>([])
  const [selectedPackage, setSelectedPackage] = React.useState<string>("")
  const [editorContent, setEditorContent] = React.useState<string>("")
  const [originalContent, setOriginalContent] = React.useState<string>("")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const isDirty = editorContent !== originalContent

  // Load versions on mount
  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/versions")
        if (!res.ok) return
        const data = await res.json() as { versions: string[] }
        setVersions(data.versions)
        if (data.versions.length > 0) {
          setSelectedVersion(data.versions[data.versions.length - 1])
        }
      } catch {
        toast.error("Impossible de charger les versions")
      }
    }
    load()
  }, [])

  // Load packages when version changes
  React.useEffect(() => {
    if (!selectedVersion) return
    async function load() {
      setLoading(true)
      setPackages([])
      setSelectedPackage("")
      setEditorContent("")
      setOriginalContent("")
      try {
        const res = await fetch(`/api/packages?version=${encodeURIComponent(selectedVersion)}`)
        if (!res.ok) return
        const data = await res.json() as { packages: PackageInfo[] }
        setPackages(data.packages)
      } catch {
        toast.error("Impossible de charger les packages")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedVersion])

  // Load package JSON when package is selected
  async function handleSelectPackage(pkgName: string) {
    if (isDirty) {
      const confirmed = window.confirm("Des modifications non sauvegardées seront perdues. Continuer ?")
      if (!confirmed) return
    }
    setSelectedPackage(pkgName)
    setLoading(true)
    try {
      const res = await fetch(`/api/packages/${encodeURIComponent(selectedVersion)}/${encodeURIComponent(pkgName)}`)
      if (!res.ok) {
        toast.error("Impossible de charger le package")
        return
      }
      const data = await res.json()
      const str = JSON.stringify(data, null, 2)
      setEditorContent(str)
      setOriginalContent(str)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!selectedPackage || !isDirty) return
    setSaving(true)
    try {
      const parsed = JSON.parse(editorContent)
      const res = await fetch(
        `/api/packages/${encodeURIComponent(selectedVersion)}/${encodeURIComponent(selectedPackage)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        }
      )
      if (!res.ok) {
        const data = await res.json() as { error: string }
        toast.error(data.error ?? "Erreur lors de la sauvegarde")
        return
      }
      setOriginalContent(editorContent)
      toast.success("Package sauvegardé")
    } catch {
      toast.error("JSON invalide — corrigez les erreurs avant de sauvegarder")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/packages/${encodeURIComponent(selectedVersion)}/${encodeURIComponent(deleteTarget)}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        toast.error("Erreur lors de la suppression")
        return
      }
      toast.success(`Package "${deleteTarget}" supprimé`)
      setPackages((prev) => prev.filter((p) => p.name !== deleteTarget))
      if (selectedPackage === deleteTarget) {
        setSelectedPackage("")
        setEditorContent("")
        setOriginalContent("")
      }
      setDeleteTarget(null)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Packages</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les fichiers JSON de définition des packages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label>Version</Label>
          <Select value={selectedVersion} onValueChange={setSelectedVersion}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Package list */}
        <aside className="flex w-56 shrink-0 flex-col gap-1">
          {loading && !selectedPackage && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement...
            </div>
          )}
          {packages.map((pkg) => (
            <div
              key={pkg.name}
              className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                selectedPackage === pkg.name ? "bg-muted font-medium" : ""
              }`}
              onClick={() => handleSelectPackage(pkg.name)}
            >
              <FileJson className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{pkg.output || pkg.name}</span>
              <button
                className="ml-auto shrink-0 rounded p-0.5 opacity-0 hover:text-red-500 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(pkg.name)
                }}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          {!loading && packages.length === 0 && selectedVersion && (
            <p className="text-xs text-muted-foreground">Aucun package trouvé.</p>
          )}
        </aside>

        <Separator orientation="vertical" />

        {/* Monaco editor */}
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
          {selectedPackage ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{selectedPackage}.json</span>
                  {isDirty && (
                    <Badge variant="secondary" className="text-xs">
                      Modifié
                    </Badge>
                  )}
                </div>
                <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  Sauvegarder
                </Button>
              </div>
              <div className="flex-1 overflow-hidden rounded-md border">
                <MonacoEditor
                  height="100%"
                  language="json"
                  value={editorContent}
                  onChange={(val) => setEditorContent(val ?? "")}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    tabSize: 2,
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Sélectionnez un package pour l&apos;éditer.
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le package</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer{" "}
              <strong>{deleteTarget}</strong> ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : null}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
