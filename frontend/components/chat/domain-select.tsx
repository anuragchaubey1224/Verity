"use client"

import { DOMAINS } from "./domains"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function DomainSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="gap-1.5" aria-label="Filter by domain">
        <SelectValue placeholder="All Domains" />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {DOMAINS.map(d => (
          <SelectItem key={d.value} value={d.value}>
            <d.icon className="size-4 text-muted-foreground" />
            {d.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
