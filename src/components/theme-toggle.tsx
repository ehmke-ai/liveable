"use client"

import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"

const STORAGE_KEY = "theme"

// Renders both icons and lets the `dark` Tailwind variant (keyed off the `.dark` class an
// inline script in layout.tsx sets before hydration) pick the visible one. This avoids any
// client/server state to track, so there's nothing for hydration to mismatch on.
export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light")
    } catch {
      // localStorage unavailable
    }
  }

  return (
    <Button variant="outline" size="icon" aria-label="Toggle color theme" onClick={toggle}>
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </Button>
  )
}
