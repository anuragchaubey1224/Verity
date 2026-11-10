"use client"

import { Check, Copy, RefreshCw } from "lucide-react"

import type { ChatMessage } from "./types"
import { Markdown } from "./markdown"
import { PipelineBadges } from "./pipeline-badges"
import { Sources } from "./sources"
import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { TooltipHint } from "@/components/ui/tooltip"
import { useCopyToClipboard } from "@/lib/hooks"

export function ThinkingDots() {
  return (
    <div className="flex h-6 items-center gap-1.5" role="status" aria-label="Thinking">
      {[0, 200, 400].map(delay => (
        <span
          key={delay}
          className="size-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end animate-fade-up">
      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-primary-foreground shadow-[var(--shadow-xs)]">
        {content}
      </div>
    </div>
  )
}

function AssistantMessage({
  message,
  streaming,
  onRegenerate,
  canRegenerate,
}: {
  message: ChatMessage
  streaming: boolean
  onRegenerate?: () => void
  canRegenerate?: boolean
}) {
  const [copied, copy] = useCopyToClipboard()
  const hasContent = message.content.length > 0

  return (
    <div className="group/msg animate-fade-up">
      <div className="mb-2.5 flex items-center gap-2">
        <LogoMark className="size-6 rounded-[28%]" />
        <span className="text-[13px] font-medium text-muted-foreground">Verity</span>
      </div>

      <div className="space-y-3 pl-8">
        {hasContent ? (
          <div>
            <Markdown content={message.content} />
            {streaming && (
              <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] rounded-full bg-primary align-middle animate-caret" />
            )}
          </div>
        ) : (
          <ThinkingDots />
        )}

        {message.pipeline && <PipelineBadges pipeline={message.pipeline} />}

        {message.sources && <Sources sources={message.sources} chunksUsed={message.chunks_used} />}

        {hasContent && !streaming && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover/msg:opacity-100 focus-within:opacity-100">
            <TooltipHint label={copied ? "Copied" : "Copy"}>
              <Button variant="ghost" size="icon-sm" aria-label="Copy answer" onClick={() => copy(message.content)}>
                {copied ? <Check className="text-success" /> : <Copy />}
              </Button>
            </TooltipHint>
            {canRegenerate && onRegenerate && (
              <TooltipHint label="Regenerate">
                <Button variant="ghost" size="icon-sm" aria-label="Regenerate answer" onClick={onRegenerate}>
                  <RefreshCw />
                </Button>
              </TooltipHint>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ChatMessageView(props: {
  message: ChatMessage
  streaming?: boolean
  onRegenerate?: () => void
  canRegenerate?: boolean
}) {
  if (props.message.role === "user") return <UserMessage content={props.message.content} />
  return (
    <AssistantMessage
      message={props.message}
      streaming={props.streaming ?? false}
      onRegenerate={props.onRegenerate}
      canRegenerate={props.canRegenerate}
    />
  )
}
