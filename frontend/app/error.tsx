"use client"

import { RotateCw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
      <span className="grid size-14 place-items-center rounded-2xl border border-destructive/25 bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight">Something went wrong</h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          An unexpected error occurred. Your chats are saved — try again.
        </p>
      </div>
      <Button onClick={reset} className="h-10 gap-2">
        <RotateCw className="size-4" /> Try again
      </Button>
    </div>
  )
}
