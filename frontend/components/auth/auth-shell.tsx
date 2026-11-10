"use client"

import { useState, type ReactNode } from "react"
import { Eye, EyeOff, TriangleAlert } from "lucide-react"

import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Input } from "@/components/ui/input"

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center overflow-y-auto bg-background px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <Logo showWordmark={false} markClassName="size-11 rounded-2xl" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-md)]">
          {children}
        </div>

        {footer && <p className="mt-5 text-center text-sm text-muted-foreground">{footer}</p>}
      </div>
    </div>
  )
}

export function Field({
  id,
  label,
  ...props
}: React.ComponentProps<"input"> & { id: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">{label}</label>
      <Input id={id} className="h-10" {...props} />
    </div>
  )
}

export function PasswordField({
  id,
  label,
  ...props
}: React.ComponentProps<"input"> & { id: string; label: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">{label}</label>
      <div className="relative">
        <Input id={id} type={show ? "text" : "password"} className="h-10 pr-10" {...props} />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(s => !s)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  )
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}
