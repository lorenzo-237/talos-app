import React, { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Settings2 } from "lucide-react"
import { Button } from "./ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
] as const

function SettingsPopover() {
  const { theme, setTheme } = useTheme()
  // Éviter le mismatch hydration (next-themes n'est pas dispo côté serveur)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title="Paramètres d'affichage">
          <Settings2 className="h-4 w-4" />
          Paramètres
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-3">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Thème
        </p>
        <div className="mb-4 flex gap-1">
          {THEMES.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              title={label}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-md px-2 py-2 text-xs transition-colors",
                "hover:bg-muted",
                mounted && theme === value
                  ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default SettingsPopover
