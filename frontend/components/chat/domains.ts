import { Atom, BrainCircuit, Cpu, Dna, Layers, LineChart, Network, Sigma, type LucideIcon } from "lucide-react"

export interface Domain {
  value: string
  label: string
  icon: LucideIcon
}

/** Knowledge-base domains. "all" is the unscoped default (chat filter only). */
export const DOMAINS: Domain[] = [
  { value: "all", label: "All Domains", icon: Layers },
  { value: "ml", label: "ML / AI", icon: BrainCircuit },
  { value: "dl", label: "Deep Learning", icon: Network },
  { value: "cs", label: "Computer Science", icon: Cpu },
  { value: "physics", label: "Physics", icon: Atom },
  { value: "bio", label: "Biology", icon: Dna },
  { value: "finance", label: "Finance", icon: LineChart },
  { value: "math", label: "Mathematics", icon: Sigma },
]

/** Domains a document can be filed under (excludes the "all" filter). */
export const UPLOAD_DOMAINS: Domain[] = DOMAINS.filter(d => d.value !== "all")

export function domainByValue(value: string): Domain | undefined {
  return DOMAINS.find(d => d.value === value)
}
