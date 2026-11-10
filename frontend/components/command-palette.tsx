"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Search, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Kbd } from "@/components/ui/kbd"

export interface Command {
  id: string
  label: string
  hint?: string
  group: string
  icon: LucideIcon
  keywords?: string
  onSelect: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: Command[]
}) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c =>
      `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""} ${c.group}`.toLowerCase().includes(q),
    )
  }, [query, commands])

  // Keep the active row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [active])

  function run(cmd: Command) {
    onOpenChange(false)
    cmd.onSelect()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive(a => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive(a => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const cmd = filtered[active]
      if (cmd) run(cmd)
    }
  }

  // Render in group order, tracking a flat index for keyboard highlighting.
  let flatIndex = -1
  const groupOrder: string[] = []
  for (const c of filtered) if (!groupOrder.includes(c.group)) groupOrder.push(c.group)

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={o => { if (!o) { setQuery(""); setActive(0) } onOpenChange(o) }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed top-[12vh] left-1/2 z-[111] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-xl)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search chats and run actions</DialogPrimitive.Description>

          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setActive(0) }}
              placeholder="Search chats or run a command…"
              className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="Search chats or run a command"
            />
          </div>

          <div ref={listRef} className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No results found.</p>
            ) : (
              groupOrder.map(group => (
                <div key={group} className="mb-1">
                  <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {group}
                  </p>
                  {filtered
                    .filter(c => c.group === group)
                    .map(c => {
                      flatIndex++
                      const index = flatIndex
                      const isActive = index === active
                      const Icon = c.icon
                      return (
                        <button
                          key={c.id}
                          data-index={index}
                          onMouseMove={() => setActive(index)}
                          onClick={() => run(c)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                            isActive ? "bg-accent text-accent-foreground" : "text-foreground",
                          )}
                        >
                          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{c.label}</span>
                          {c.hint && (
                            <span className="shrink-0 truncate text-xs text-muted-foreground">{c.hint}</span>
                          )}
                        </button>
                      )
                    })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> select</span>
            <span className="flex items-center gap-1.5"><Kbd>esc</Kbd> close</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
