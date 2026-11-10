import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

/** Renders assistant markdown with GFM, styled via the token-driven `.prose-verity`. */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose-verity prose prose-sm sm:prose-base max-w-none leading-relaxed",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-pre:rounded-xl prose-pre:text-[13px] prose-pre:leading-relaxed",
        "prose-img:rounded-xl prose-hr:my-6",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
