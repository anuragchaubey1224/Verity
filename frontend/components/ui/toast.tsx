"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

type ToastVariant = "default" | "success" | "error" | "warning"

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastItem extends ToastOptions {
  id: number
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_ICON = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
} as const

const VARIANT_ICON_COLOR = {
  default: "text-muted-foreground",
  success: "text-success",
  error: "text-destructive",
  warning: "text-warning",
} as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const toast = useCallback((opts: ToastOptions) => {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, variant: "default", ...opts }])
    const duration = opts.duration ?? 4200
    timers.current.set(id, setTimeout(() => dismiss(id), duration))
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map(t => {
          const Icon = VARIANT_ICON[t.variant ?? "default"]
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-[var(--shadow-lg)] animate-fade-up"
            >
              <Icon className={cn("mt-0.5 size-4.5 shrink-0", VARIANT_ICON_COLOR[t.variant ?? "default"])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="Dismiss notification"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
