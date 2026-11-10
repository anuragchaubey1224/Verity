"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, FileText, Link2, Loader2, TriangleAlert, UploadCloud, XCircle } from "lucide-react"

import { getTaskStatus, ingestAsync, uploadFile } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { UPLOAD_DOMAINS } from "@/components/chat/domains"
import { LogoMark } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface IngestResult {
  taskId?: string
  documentId?: string
  status: string
}

const STATUS = {
  completed: { label: "Completed", cls: "border-success/25 bg-success/10 text-success", Icon: CheckCircle2, spin: false },
  failed: { label: "Failed", cls: "border-destructive/25 bg-destructive/10 text-destructive", Icon: XCircle, spin: false },
  running: { label: "Running…", cls: "border-primary/25 bg-primary/10 text-primary", Icon: Loader2, spin: true },
  queued: { label: "Queued…", cls: "border-warning/25 bg-warning/10 text-warning", Icon: Loader2, spin: true },
} as const

export default function IngestPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [domain, setDomain] = useState("ml")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<IngestResult | null>(null)
  const [taskStatus, setTaskStatus] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [urlSource, setUrlSource] = useState("")
  const [tab, setTab] = useState<"file" | "url">("file")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login")
  }, [authLoading, user, router])

  function startPolling(taskId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const s = await getTaskStatus(taskId)
        setTaskStatus(s.status)
        if (s.status === "completed" || s.status === "failed") clearInterval(pollRef.current!)
      } catch { clearInterval(pollRef.current!) }
    }, 3000)
  }

  const pickFile = useCallback((file: File | null | undefined) => {
    if (!file) return
    setSelectedFile(file)
    setTitle(prev => (prev.trim() ? prev : file.name.replace(/\.[^.]+$/, "")))
  }, [])

  async function handleSubmit() {
    const t = title.trim()
    if (!t || loading) return
    setLoading(true); setError(null); setResult(null); setTaskStatus(null)
    try {
      if (tab === "file") {
        if (!selectedFile) { setError("Please select a file"); setLoading(false); return }
        const res = await uploadFile(selectedFile, t, domain)
        setResult({ documentId: res.document_id, status: res.status })
      } else {
        const u = urlSource.trim()
        if (!u) { setError("Please enter a URL"); setLoading(false); return }
        const res = await ingestAsync({ title: t, source: u, domain })
        setResult({ taskId: res.task_id, status: res.status })
        startPolling(res.task_id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed")
    } finally { setLoading(false) }
  }

  const currentStatus = taskStatus ?? result?.status ?? ""
  const canSubmit = !loading && !!title.trim() && (tab === "file" ? !!selectedFile : !!urlSource.trim())

  if (authLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        <LogoMark className="size-9 animate-shimmer" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-sm sm:px-4">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link href="/"><ArrowLeft className="size-4" /> Back to chat</Link>
        </Button>
        <div className="ml-auto"><ThemeToggle /></div>
      </header>

      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge base</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Add a document to the index — it runs through parse → chunk → embed → store. Upload a file, or ingest from a URL.
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          {/* Segmented tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["file", "url"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  tab === t ? "bg-card text-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "file" ? <><UploadCloud className="size-4" /> Upload file</> : <><Link2 className="size-4" /> From URL</>}
              </button>
            ))}
          </div>

          {tab === "file" ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]) }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click() } }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                dragOver ? "border-primary bg-primary/5"
                  : selectedFile ? "border-success/40 bg-success/5"
                    : "border-input hover:border-ring/50 hover:bg-accent/50",
              )}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.docx" className="hidden" onChange={e => pickFile(e.target.files?.[0])} />
              {selectedFile ? (
                <>
                  <span className="grid size-10 place-items-center rounded-xl bg-success/10 text-success"><FileText className="size-5" /></span>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB · Click to change</p>
                </>
              ) : (
                <>
                  <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground"><UploadCloud className="size-5" /></span>
                  <p className="text-sm font-medium">Drag &amp; drop, or click to browse</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="src-url" className="text-xs font-medium text-foreground">URL or file path</label>
              <Input
                id="src-url"
                value={urlSource}
                onChange={e => setUrlSource(e.target.value)}
                placeholder="https://arxiv.org/pdf/2005.11401"
                disabled={loading}
                className="h-10"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="ingest-title" className="text-xs font-medium text-foreground">Document title</label>
            <Input
              id="ingest-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Attention Is All You Need"
              disabled={loading}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Domain</label>
            <Select value={domain} onValueChange={setDomain} disabled={loading}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                {UPLOAD_DOMAINS.map(d => (
                  <SelectItem key={d.value} value={d.value}>
                    <d.icon className="size-4 text-muted-foreground" />
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit} className="h-10 w-full gap-2">
            {loading ? (<><Loader2 className="size-4 animate-spin" /> Ingesting…</>) : "Ingest document"}
          </Button>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {result && (() => {
            const s = STATUS[currentStatus as keyof typeof STATUS]
            return (
              <div className={cn("space-y-2 rounded-xl border px-4 py-3", s?.cls ?? "border-border bg-muted text-muted-foreground")}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {s ? <s.Icon className={cn("size-4", s.spin && "animate-spin")} /> : null}
                  {s?.label ?? currentStatus}
                </div>
                {result.taskId && (
                  <p className="truncate text-xs text-muted-foreground">Task: <code className="font-mono">{result.taskId}</code></p>
                )}
                {result.documentId && (
                  <p className="truncate text-xs text-muted-foreground">Doc ID: <code className="font-mono">{result.documentId}</code></p>
                )}
              </div>
            )
          })()}
        </div>
      </main>
    </div>
  )
}
