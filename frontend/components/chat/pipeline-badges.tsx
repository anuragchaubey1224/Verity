import { ArrowUpDown, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react"

import type { PipelineInfo } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Tone = "neutral" | "success" | "warning"

const TONE: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/10 text-warning",
}

function Chip({
  children,
  tone = "neutral",
  icon: Icon,
  hint,
}: {
  children: React.ReactNode
  tone?: Tone
  icon?: typeof ShieldCheck
  hint?: string
}) {
  const chip = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONE[tone],
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  )
  if (!hint) return chip
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

/** Compact, glanceable summary of how the answer was produced. */
export function PipelineBadges({ pipeline }: { pipeline: PipelineInfo }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pipeline.methods.map(m => (
        <Chip key={m} icon={Sparkles} hint="Retrieval method">
          {m}
        </Chip>
      ))}
      {pipeline.reranked && (
        <Chip icon={ArrowUpDown} hint="Results were re-ranked for relevance">
          reranked
        </Chip>
      )}
      {pipeline.grader_passed && (
        <Chip tone="success" icon={ShieldCheck} hint="Answer is grounded in the retrieved sources">
          grounded
        </Chip>
      )}
      {pipeline.has_hallucination && (
        <Chip tone="warning" icon={TriangleAlert} hint="Parts of this answer may not be fully supported by the sources">
          unverified
        </Chip>
      )}
    </div>
  )
}
