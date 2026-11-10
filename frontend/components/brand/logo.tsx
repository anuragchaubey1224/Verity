import { cn } from "@/lib/utils"

/** The Verity mark — a stylized "V" checkmark (verify / truth). Size via className, e.g. `size-8`. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-[30%] bg-primary text-primary-foreground shadow-[var(--shadow-xs)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[60%]">
        <path
          d="M4.75 7 10.4 17.2a1.85 1.85 0 0 0 3.2 0L19.25 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

/** Full lockup: mark + wordmark. */
export function Logo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string
  markClassName?: string
  showWordmark?: boolean
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">Verity</span>
      )}
    </span>
  )
}
