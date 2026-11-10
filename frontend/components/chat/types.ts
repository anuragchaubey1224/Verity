import type { PipelineInfo, SourceItem } from "@/lib/api"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  sources?: SourceItem[]
  chunks_used?: number
  pipeline?: PipelineInfo
}
