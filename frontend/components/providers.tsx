"use client"

import type { ReactNode } from "react"

import { ThemeProvider } from "@/lib/theme"
import { AuthProvider } from "@/lib/auth-context"
import { ToastProvider } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider>
          <AuthProvider>{children}</AuthProvider>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
