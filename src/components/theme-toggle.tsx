"use client"

import { useState } from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"

const STORAGE_KEY = "theme"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false
    return document.documentElement.classList.contains("dark")
  })

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light")
    } catch {
      // localStorage unavailable
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
