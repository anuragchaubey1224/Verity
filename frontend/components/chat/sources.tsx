"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"

import type { SourceItem } from "@/lib/api"
import { cn } from "@/lib/utils"

export function Sources({ sources, chunksUsed }: { sources: SourceItem[]; chunksUsed?: number }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  if (!sources.length) return null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="group inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChevronRight className={cn("size-3.5 transition-transform duration-200", open && "rotate-90")} aria-hidden />
        <span>
          {sources.length} source{sources.length > 1 ? "s" : ""}
          {chunksUsed ? ` · ${chunksUsed} chunks` : ""}
        </span>
      </button>

      {open && (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card animate-fade-up">
          {sources.map((s, i) => {
            const isOpen = expanded === i
            return (
              <li key={i}>
                <button
                  onClick={() => setExpanded(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 font-mono text-[11px] font-medium text-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {s.title ?? "Unknown source"}
                  </span>
                  {s.page_number != null && (
                    <span className="shrink-0 text-xs text-muted-foreground">p.{s.page_number}</span>
                  )}
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {s.score.toFixed(3)}
                  </span>
                  <ChevronRight
                    className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-90")}
                    aria-hidden
                  />
                </button>
                {isOpen && s.text && (
                  <p className="border-t border-border bg-muted/50 px-3 py-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
                    {s.text}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
