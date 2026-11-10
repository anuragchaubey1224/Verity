import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
      <Logo markClassName="size-9" />
      <div className="space-y-1">
        <p className="text-5xl font-semibold tracking-tight">404</p>
        <p className="text-sm text-muted-foreground">This page could not be found.</p>
      </div>
      <Button asChild className="h-10">
        <Link href="/">Back to Verity</Link>
      </Button>
    </div>
  )
}
