"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Database, Menu, Moon, Paperclip, SquarePen, Sun, TriangleAlert } from "lucide-react"

import {
  queryKBStream, fetchSessions, fetchSessionMessages,
  RateLimitError, type SessionItem,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTheme } from "@/lib/theme"
import { useHotkey } from "@/lib/hooks"
import type { ChatMessage } from "@/components/chat/types"
import { SidebarContent } from "@/components/chat/sidebar"
import { ChatMessageView } from "@/components/chat/chat-message"
import { ChatInput } from "@/components/chat/chat-input"
import { EmptyState } from "@/components/chat/empty-state"
import { DomainSelect } from "@/components/chat/domain-select"
import { UploadModal } from "@/components/upload-modal"
import { CommandPalette, type Command } from "@/components/command-palette"
import { ThemeToggle } from "@/components/theme-toggle"
import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

const SESSION_TITLES_KEY = "verity_session_titles"
const SESSION_DOCS_KEY = "verity_session_docs"

export default function ChatPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const { resolvedTheme, toggle: toggleTheme } = useTheme()
  const router = useRouter()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [domain, setDomain] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(
    () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null),
  )
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const rateLimitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // sessionId → custom chat title (set when a paper is uploaded). Persisted
  // locally because the backend names a chat after its first user message.
  const [sessionTitles, setSessionTitles] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {}
    try { return JSON.parse(localStorage.getItem(SESSION_TITLES_KEY) ?? "{}") } catch { return {} }
  })
  // sessionId → uploaded document id (doc-scoped chats, no web fallback).
  const [sessionDocs, setSessionDocs] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {}
    try { return JSON.parse(localStorage.getItem(SESSION_DOCS_KEY) ?? "{}") } catch { return {} }
  })

  // Gate the page behind auth.
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login")
  }, [authLoading, user, router])

  // Once authenticated: load this user's past chats (session id is pre-seeded).
  useEffect(() => {
    if (!user) return
    fetchSessions().then(setSessions).catch(() => {})
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => () => {
    if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current)
  }, [])

  useHotkey("mod+k", (e) => { e.preventDefault(); setCommandOpen(o => !o) }, { allowInInput: true })

  async function refreshSessions() {
    try { setSessions(await fetchSessions()) } catch { /* non-critical */ }
  }

  async function loadSession(id: string) {
    setError(null)
    try {
      const msgs = await fetchSessionMessages(id)
      setMessages(msgs.map(m => ({ role: m.role, content: m.content })))
      setSessionId(id)
    } catch {
      setError("Failed to load this chat.")
    }
  }

  function startNewChat() {
    setSessionId(crypto.randomUUID())
    setMessages([])
    setError(null)
  }

  function nameSession(id: string, title: string) {
    setSessionTitles(prev => {
      const next = { ...prev, [id]: title }
      try { localStorage.setItem(SESSION_TITLES_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function bindSessionDoc(id: string, documentId: string) {
    setSessionDocs(prev => {
      const next = { ...prev, [id]: documentId }
      try { localStorage.setItem(SESSION_DOCS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // After a successful upload: start a fresh chat named after the paper and
  // seed it with an intro so the user can discuss it.
  function handleUploaded(paperTitle: string, documentId: string) {
    const id = crypto.randomUUID()
    nameSession(id, paperTitle)
    bindSessionDoc(id, documentId)
    setSessionId(id)
    setMessages([{
      role: "assistant",
      content: `**${paperTitle}** is indexed and ready. Ask me anything about it.`,
    }])
    setError(null)
    setUploadOpen(false)
  }

  // Core: append an empty assistant bubble and stream the answer into it.
  async function streamAnswer(q: string) {
    setError(null)
    setLoading(true)
    setMessages(prev => [...prev, { role: "assistant", content: "" }])

    try {
      await queryKBStream(
        {
          query: q,
          domain: domain === "all" ? null : domain,
          session_id: sessionId ?? undefined,
          document_id: sessionId ? sessionDocs[sessionId] ?? null : null,
        },
        (event) => {
          if (event.type === "token") {
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              updated[updated.length - 1] = { ...last, content: last.content + event.content }
              return updated
            })
          } else if (event.type === "sources") {
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { ...updated[updated.length - 1], sources: event.sources, chunks_used: event.chunks_used }
              return updated
            })
          } else if (event.type === "pipeline") {
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { ...updated[updated.length - 1], pipeline: event }
              return updated
            })
          } else if (event.type === "error") {
            setMessages(prev => {
              const last = prev[prev.length - 1]
              return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev
            })
            setError(event.content)
          }
        },
      )
      refreshSessions()
    } catch (err) {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev
      })
      if (err instanceof RateLimitError) {
        setRateLimitSeconds(err.retryAfter)
        if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current)
        rateLimitTimerRef.current = setInterval(() => {
          setRateLimitSeconds(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(rateLimitTimerRef.current!)
              rateLimitTimerRef.current = null
              return null
            }
            return prev - 1
          })
        }, 1000)
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      }
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(query?: string) {
    const q = (query ?? input).trim()
    if (!q || loading) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: q }])
    streamAnswer(q)
  }

  function regenerate() {
    if (loading) return
    const lastUser = [...messages].reverse().find(m => m.role === "user")
    if (!lastUser) return
    setMessages(prev => {
      const copy = [...prev]
      while (copy.length && copy[copy.length - 1].role === "assistant") copy.pop()
      return copy
    })
    streamAnswer(lastUser.content)
  }

  // Surface a freshly-created upload chat in the sidebar before it has any
  // backend messages, and prefer a custom title wherever one exists.
  const displaySessions = useMemo<SessionItem[]>(() => {
    const list = [...sessions]
    if (sessionId && sessionTitles[sessionId] && !list.some(s => s.session_id === sessionId)) {
      list.unshift({ session_id: sessionId, preview: sessionTitles[sessionId], last_at: null, message_count: 0 })
    }
    return list
  }, [sessions, sessionId, sessionTitles])

  const commands = useMemo<Command[]>(() => {
    const actions: Command[] = [
      { id: "new", group: "Actions", label: "New chat", icon: SquarePen, keywords: "start reset", onSelect: startNewChat },
      { id: "upload", group: "Actions", label: "Upload a document", icon: Paperclip, keywords: "add paper pdf file", onSelect: () => setUploadOpen(true) },
      { id: "kb", group: "Actions", label: "Knowledge base", icon: Database, keywords: "ingest documents", onSelect: () => router.push("/ingest") },
      {
        id: "theme", group: "Actions",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolvedTheme === "dark" ? Sun : Moon, keywords: "dark light appearance mode", onSelect: toggleTheme,
      },
    ]
    const chats: Command[] = displaySessions.slice(0, 20).map(s => ({
      id: s.session_id,
      group: "Recent chats",
      label: sessionTitles[s.session_id] || s.preview || "New chat",
      icon: SquarePen,
      onSelect: () => loadSession(s.session_id),
    }))
    return [...actions, ...chats]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displaySessions, sessionTitles, resolvedTheme])

  if (authLoading || !user) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <LogoMark className="size-9 animate-shimmer" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  const lastIndex = messages.length - 1

  const sidebar = (onNavigate?: () => void) => (
    <SidebarContent
      sessions={displaySessions}
      activeId={sessionId}
      sessionTitles={sessionTitles}
      onSelect={loadSession}
      onNewChat={startNewChat}
      onOpenCommand={() => setCommandOpen(true)}
      userEmail={user.email}
      onLogout={logout}
      onNavigate={onNavigate}
    />
  )

  return (
    <div className="flex h-dvh bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
        {sidebar()}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" showClose={false} className="w-72">
          <SheetTitle>Navigation</SheetTitle>
          {sidebar(() => setMobileNavOpen(false))}
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu />
          </Button>
          <DomainSelect value={domain} onChange={setDomain} />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onExample={handleSubmit} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:py-8">
              {messages.map((msg, i) => (
                <ChatMessageView
                  key={i}
                  message={msg}
                  streaming={loading && i === lastIndex && msg.role === "assistant"}
                  onRegenerate={regenerate}
                  canRegenerate={!loading && i === lastIndex && msg.role === "assistant" && msg.content.length > 0}
                />
              ))}

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Rate limit banner */}
        {rateLimitSeconds !== null && (
          <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-2.5 text-sm">
            <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0">
              <span className="font-medium text-warning">Rate limit reached</span>
              <span className="text-muted-foreground"> — 20 queries per 20 minutes.</span>
            </div>
            <span className="ml-auto shrink-0 font-mono text-sm font-semibold tabular-nums text-warning">
              {Math.floor(rateLimitSeconds / 60)}:{String(rateLimitSeconds % 60).padStart(2, "0")}
            </span>
          </div>
        )}

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={() => handleSubmit()}
          onAttach={() => setUploadOpen(true)}
          loading={loading}
          rateLimited={rateLimitSeconds !== null}
          placeholder={rateLimitSeconds !== null ? "Rate limit active — please wait…" : "Ask a research question…"}
        />
      </div>

      <UploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultDomain={domain}
        onUploaded={handleUploaded}
      />

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} commands={commands} />
    </div>
  )
}
