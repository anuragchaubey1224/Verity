"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

const STORAGE_KEY = "verity-theme"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Inline script injected into <head> so the correct theme class is applied
 * before first paint (no flash of the wrong theme). Keep STORAGE_KEY in sync.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy-init from storage (client only) to avoid a mount effect + flash.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system"
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system"
  })
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof document === "undefined") return "light"
    return document.documentElement.classList.contains("dark") ? "dark" : "light"
  })

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const compute = () => {
      const resolved: ResolvedTheme = theme === "system" ? (mq.matches ? "dark" : "light") : theme
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    compute()
    if (theme === "system") {
      mq.addEventListener("change", compute)
      return () => mq.removeEventListener("change", compute)
    }
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }, [])

  const toggle = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
