"use client"

import { useRouter } from "next/navigation"
import { Anvil, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function UnauthorizedPage() {
  const router = useRouter()

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 text-center">
      {/* Forge illustration */}
      <div className="relative flex flex-col items-center">
        <div className="flex size-28 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
          <Anvil className="size-12 text-muted-foreground/50" strokeWidth={1.2} />
        </div>
        <div className="mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent" />
      </div>

      {/* Lore text */}
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Accès à la forge refusé
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Votre âme n&apos;est pas gravée dans les registres de la forge.
          <br />
          Contactez un <span className="font-medium text-foreground">forgeur admin</span> pour
          obtenir les droits d&apos;accès à la forge de Talos.
        </p>
      </div>

      <Button variant="outline" size="sm" onClick={handleLogout}>
        <LogOut className="size-4" />
        Se déconnecter
      </Button>
    </div>
  )
}
