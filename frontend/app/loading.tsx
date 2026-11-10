import { LogoMark } from "@/components/brand/logo"

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <LogoMark className="size-9 animate-shimmer" />
    </div>
  )
}
