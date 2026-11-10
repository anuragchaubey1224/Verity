"use client"

import { ArrowUpRight } from "lucide-react"

import { LogoMark } from "@/components/brand/logo"

const EXAMPLES = [
  "What are the main approaches to reduce hallucinations in RAG systems?",
  "How does retrieval-augmented generation compare to fine-tuning?",
  "Explain attention mechanisms in transformers.",
  "What are the limitations of current LLM evaluation benchmarks?",
]

export function EmptyState({ onExample }: { onExample: (q: string) => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
      <LogoMark className="size-14 rounded-2xl" />

      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
        What do you want to research?
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
        Ask anything. Verity retrieves, synthesizes, and cites its sources — with a web fallback when your
        knowledge base is empty.
      </p>

      <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        {EXAMPLES.map((q, i) => (
          <button
            key={i}
            onClick={() => onExample(q)}
            className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left text-sm leading-relaxed text-foreground transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-ring/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="flex-1">{q}</span>
            <ArrowUpRight
              className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  )
}
