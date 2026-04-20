"use client"

import * as React from "react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"

export interface PackageInfo {
  name: string
  filename: string
  output: string
}

export interface PackagesResult {
  resolvedVersion: string
  inputVersion: string
  packages: PackageInfo[]
}

interface UsePackageSearch {
  packagesResult: PackagesResult | null
  searching: boolean
  search: (version: string) => Promise<PackagesResult | null>
  clearResult: () => void
}

export function usePackageSearch(): UsePackageSearch {
  const [packagesResult, setPackagesResult] =
    React.useState<PackagesResult | null>(null)
  const [searching, setSearching] = React.useState(false)

  async function search(version: string): Promise<PackagesResult | null> {
    setSearching(true)
    setPackagesResult(null)
    try {
      const res = await apiFetch(
        `/api/packages?version=${encodeURIComponent(version)}`
      )
      if (!res.ok) {
        const data = (await res.json()) as { error: string }
        toast.error(data.error ?? "Erreur lors de la recherche")
        return null
      }
      const data = (await res.json()) as PackagesResult
      setPackagesResult(data)
      return data
    } catch {
      toast.error("Erreur réseau")
      return null
    } finally {
      setSearching(false)
    }
  }

  function clearResult() {
    setPackagesResult(null)
  }

  return { packagesResult, searching, search, clearResult }
}
