import type { ReactNode } from 'react'
import type { Resolution } from './api'

export function Badge({
  children,
  tone = 'zinc',
}: {
  children: ReactNode
  tone?: 'zinc' | 'emerald' | 'amber' | 'violet' | 'sky'
}) {
  const tones: Record<string, string> = {
    zinc: 'bg-zinc-800 text-zinc-300 ring-zinc-700',
    emerald: 'bg-emerald-950 text-emerald-300 ring-emerald-800',
    amber: 'bg-amber-950 text-amber-300 ring-amber-800',
    violet: 'bg-violet-950 text-violet-300 ring-violet-800',
    sky: 'bg-sky-950 text-sky-300 ring-sky-800',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function ResolutionBadge({ resolution }: { resolution: Resolution | null }) {
  if (!resolution) return <Badge tone="zinc">unknown</Badge>
  const tone = resolution === 'resolved' ? 'emerald' : resolution === 'partial' ? 'amber' : 'zinc'
  return <Badge tone={tone}>{resolution}</Badge>
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}

export function short(hash: string): string {
  return hash.slice(0, 8)
}
