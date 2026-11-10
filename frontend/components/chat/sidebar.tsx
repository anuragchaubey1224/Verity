"use client"

import Link from "next/link"
import { Database, Ellipsis, LogOut, Plus, Search, SquarePen } from "lucide-react"

import type { SessionItem } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { TooltipHint } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function timeAgo(iso: string | null): string {
  if (!iso) return "just now"
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface SidebarContentProps {
  sessions: SessionItem[]
  activeId: string | null
  sessionTitles: Record<string, string>
  onSelect: (id: string) => void
  onNewChat: () => void
  onOpenCommand: () => void
  userEmail: string
  onLogout: () => void
  /** Called after any navigation action — used to close the mobile drawer. */
  onNavigate?: () => void
}

export function SidebarContent({
  sessions,
  activeId,
  sessionTitles,
  onSelect,
  onNewChat,
  onOpenCommand,
  userEmail,
  onLogout,
  onNavigate,
}: SidebarContentProps) {
  const initial = userEmail.charAt(0).toUpperCase() || "?"

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3">
        <Logo />
        <TooltipHint label="New chat">
          <Button
            variant="ghost"
            size="icon"
            aria-label="New chat"
            onClick={() => { onNewChat(); onNavigate?.() }}
          >
            <SquarePen />
          </Button>
        </TooltipHint>
      </div>

      {/* Actions */}
      <div className="space-y-1.5 px-3 pt-3">
        <Button
          variant="outline"
          className="h-9 w-full justify-start gap-2 bg-transparent"
          onClick={() => { onNewChat(); onNavigate?.() }}
        >
          <Plus className="size-4" /> New chat
        </Button>
        <button
          onClick={onOpenCommand}
          className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search</span>
          <span className="flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        </button>
      </div>

      {/* Sessions */}
      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No chats yet</p>
        ) : (
          <>
            <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Recent
            </p>
            <div className="space-y-0.5">
              {sessions.map(s => {
                const active = s.session_id === activeId
                const title = sessionTitles[s.session_id] || s.preview || "New chat"
                return (
                  <button
                    key={s.session_id}
                    onClick={() => { onSelect(s.session_id); onNavigate?.() }}
                    className={cn(
                      "group flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
                    )}
                  >
                    <span
                      className={cn(
                        "truncate text-[13px] leading-tight font-medium",
                        active ? "text-foreground" : "text-sidebar-foreground group-hover:text-foreground",
                      )}
                    >
                      {title}
                    </span>
                    <span className="mt-0.5 truncate text-[11px] text-muted-foreground">{timeAgo(s.last_at)}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer — account menu */}
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {initial}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground" title={userEmail}>
                {userEmail}
              </span>
              <Ellipsis className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
            <DropdownMenuLabel className="truncate normal-case">{userEmail}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/ingest" onClick={onNavigate}>
                <Database /> Knowledge base
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onLogout}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
