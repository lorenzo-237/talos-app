"use client"

import { Loader2, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { PackagesResult } from "@/hooks/usePackageSearch"

interface PackageSelectorProps {
  packagesResult: PackagesResult
  selectedPackages: Set<string>
  keepTemp: boolean
  building: boolean
  canBuild: boolean
  onToggle: (name: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onKeepTempChange: (value: boolean) => void
  onBuild: () => void
}

export function PackageSelector({
  packagesResult,
  selectedPackages,
  keepTemp,
  building,
  canBuild,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onKeepTempChange,
  onBuild,
}: PackageSelectorProps) {
  const allSelected =
    selectedPackages.size === packagesResult.packages.length

  return (
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
              onClick={onSelectAll}
              disabled={allSelected}
            >
              Tout sélectionner
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onDeselectAll}
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
              onCheckedChange={() => onToggle(pkg.name)}
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

      {canBuild && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox
              id="keep-temp"
              checked={keepTemp}
              onCheckedChange={(v) => onKeepTempChange(v === true)}
            />
            <label
              htmlFor="keep-temp"
              className="cursor-pointer text-sm text-muted-foreground"
            >
              Conserver les dossiers temporaires
            </label>
          </div>

          <Button
            onClick={onBuild}
            disabled={building || selectedPackages.size === 0}
            className="gap-2"
          >
            {building ? <Loader2 className="animate-spin" /> : <PlayCircle />}
            Générer
          </Button>
        </>
      )}
    </div>
  )
}
