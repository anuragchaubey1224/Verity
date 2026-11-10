"use client"

import { useCallback, useRef, useState } from "react"
import { FileText, Loader2, TriangleAlert, UploadCloud } from "lucide-react"

import { uploadFile } from "@/lib/api"
import { cn } from "@/lib/utils"
import { UPLOAD_DOMAINS } from "@/components/chat/domains"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface UploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The chat's current domain — used as the default ("all" falls back to "ml"). */
  defaultDomain: string
  /** Called after a successful upload with the document title and its id. */
  onUploaded: (title: string, documentId: string) => void
}

export function UploadModal({ open, onOpenChange, defaultDomain, onUploaded }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [domain, setDomain] = useState(defaultDomain === "all" ? "ml" : defaultDomain)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pickFile = useCallback((f: File | null | undefined) => {
    if (!f) return
    setFile(f)
    setTitle(prev => (prev.trim() ? prev : f.name.replace(/\.[^.]+$/, "")))
  }, [])

  const canSubmit = !!file && !!title.trim() && !uploading

  async function submit() {
    if (!canSubmit || !file) return
    setUploading(true)
    setError(null)
    try {
      const res = await uploadFile(file, title.trim(), domain)
      onUploaded(title.trim(), res.document_id)
      // reset for next time
      setFile(null)
      setTitle("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!uploading) onOpenChange(o) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a document</DialogTitle>
          <DialogDescription>
            Upload a paper to start a new chat scoped to it. PDF, DOCX, TXT, or Markdown.
          </DialogDescription>
        </DialogHeader>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]) }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click() } }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            dragOver
              ? "border-primary bg-primary/5"
              : file
                ? "border-success/40 bg-success/5"
                : "border-input hover:border-ring/50 hover:bg-accent/50",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.docx"
            className="hidden"
            onChange={e => pickFile(e.target.files?.[0])}
          />
          {file ? (
            <>
              <span className="grid size-10 place-items-center rounded-xl bg-success/10 text-success">
                <FileText className="size-5" />
              </span>
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
            </>
          ) : (
            <>
              <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                <UploadCloud className="size-5" />
              </span>
              <p className="text-sm font-medium text-foreground">Drag &amp; drop, or click to browse</p>
              <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD</p>
            </>
          )}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="doc-title" className="text-xs font-medium text-foreground">
            Document title <span className="text-destructive">*</span>
          </label>
          <Input
            id="doc-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Attention Is All You Need"
            disabled={uploading}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">This names the new chat.</p>
        </div>

        {/* Domain */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Domain</label>
          <Select value={domain} onValueChange={setDomain} disabled={uploading}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
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

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading} className="h-9">
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit} className="h-9 gap-2">
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Uploading &amp; indexing…
              </>
            ) : (
              "Upload & start chat"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
