"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** Track a CSS media query. SSR-safe (returns `false` on the server). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [query])
  return matches
}

/** True below the `md` breakpoint (mobile / narrow). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)")
}

/** Copy text to the clipboard and expose a transient `copied` flag. */
export function useCopyToClipboard(resetMs = 1600): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), resetMs)
    } catch { /* clipboard blocked — no-op */ }
  }, [resetMs])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return [copied, copy]
}

/**
 * Global keyboard shortcut. Combo like "mod+k" (mod = ⌘ on mac, Ctrl elsewhere).
 * Ignores keystrokes while typing in inputs unless `allowInInput` is set.
 */
export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  { allowInInput = false }: { allowInInput?: boolean } = {},
) {
  const handlerRef = useRef(handler)
  useEffect(() => { handlerRef.current = handler }, [handler])

  useEffect(() => {
    const parts = combo.toLowerCase().split("+")
    const key = parts[parts.length - 1]
    const needMod = parts.includes("mod")
    const needShift = parts.includes("shift")

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      if (typing && !allowInInput) return
      if (needMod && !(e.metaKey || e.ctrlKey)) return
      if (needShift && !e.shiftKey) return
      if (e.key.toLowerCase() !== key) return
      handlerRef.current(e)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [combo, allowInInput])
}
