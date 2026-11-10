"use client"

import { useEffect, useRef } from "react"
import { ArrowUp, Paperclip } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { TooltipHint } from "@/components/ui/tooltip"

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onAttach,
  loading = false,
  rateLimited = false,
  placeholder = "Ask a research question…",
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onAttach: () => void
  loading?: boolean
  rateLimited?: boolean
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Reset the auto-grown height once the field is cleared (e.g. after send).
  useEffect(() => {
    if (!value && ref.current) ref.current.style.height = "auto"
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  const canSend = !!value.trim() && !loading && !rateLimited

  return (
    <div className="shrink-0 border-t border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] focus-within:border-ring/70 focus-within:ring-4 focus-within:ring-ring/10">
          <TooltipHint label="Attach a document">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label="Upload a document"
              disabled={loading}
              onClick={onAttach}
            >
              <Paperclip />
            </Button>
          </TooltipHint>

          <textarea
            ref={ref}
            value={value}
            onChange={e => {
              onChange(e.target.value)
              e.target.style.height = "auto"
              e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px"
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={rateLimited}
            placeholder={placeholder}
            className="max-h-[180px] min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />

          <Button
            size="icon"
            className="shrink-0"
            aria-label="Send message"
            disabled={!canSend}
            onClick={onSubmit}
          >
            {loading ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <ArrowUp />
            )}
          </Button>
        </div>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Kbd>Enter</Kbd> to send
          <span className="opacity-40">·</span>
          <span className="inline-flex items-center gap-1"><Kbd>Shift</Kbd><Kbd>Enter</Kbd> for newline</span>
        </p>
      </div>
    </div>
  )
}
