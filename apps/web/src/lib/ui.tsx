import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

type Tone = 'zinc' | 'emerald' | 'amber' | 'violet' | 'sky' | 'red'

const TONES: Record<Tone, string> = {
  zinc: 'bg-zinc-800 text-zinc-300 ring-zinc-700',
  emerald: 'bg-emerald-950 text-emerald-300 ring-emerald-800',
  amber: 'bg-amber-950 text-amber-300 ring-amber-800',
  violet: 'bg-violet-950 text-violet-300 ring-violet-800',
  sky: 'bg-sky-950 text-sky-300 ring-sky-800',
  red: 'bg-red-950 text-red-300 ring-red-800',
}

export function Badge({ children, tone = 'zinc' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function ResolutionBadge({ resolution }: { resolution: string | null }) {
  if (!resolution) return <Badge tone="zinc">unknown</Badge>
  const tone: Tone =
    resolution === 'resolved' ? 'emerald' : resolution === 'partial' ? 'amber' : 'zinc'
  return <Badge tone={tone}>{resolution}</Badge>
}

export function EvalBadge({ state, score }: { state: string; score?: number | null }) {
  if (state === 'none' || score == null) return <span className="text-zinc-600">—</span>
  const tone: Tone = state === 'pass' ? 'emerald' : 'red'
  return (
    <Badge tone={tone}>
      {state === 'pass' ? '✓' : '✗'} {score}%
    </Badge>
  )
}

export function ScoreDelta({ delta }: { delta: number | null }) {
  if (delta == null) return null
  if (delta === 0) return <span className="text-xs text-zinc-500">±0</span>
  const up = delta > 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}
      {delta}%
    </span>
  )
}

export function relativeTime(iso: string): string {
  // mock data uses pre-formatted strings; pass through if not a date
  if (!/^\d{4}-/.test(iso)) return iso
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}

export const short = (hash: string) => hash.slice(0, 8)

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-zinc-800 bg-zinc-900/40 ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
}: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </Card>
  )
}

export function Section({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export interface Tab {
  key: string
  label: string
  count?: number
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="mb-6 flex gap-1 border-b border-zinc-800">
      {tabs.map((t) => (
        <button
          type="button"
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            active === t.key
              ? 'border-zinc-100 text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 text-xs text-zinc-600">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 p-10 text-center">
      <p className="text-zinc-300">{title}</p>
      {hint && <p className="mt-2 text-sm text-zinc-500">{hint}</p>}
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  )
}

export function buttonCls(variant: 'primary' | 'secondary' | 'ghost' = 'secondary'): string {
  const base =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors'
  const variants = {
    primary: 'bg-zinc-100 text-zinc-900 hover:bg-white',
    secondary: 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800',
    ghost: 'text-zinc-400 hover:text-zinc-100',
  }
  return `${base} ${variants[variant]}`
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button type="button" className={`${buttonCls(variant)} ${className}`} {...props} />
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the form control is passed in as children
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputCls} {...props} />
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={inputCls} {...props}>
      {children}
    </select>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24">
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h3 className="font-medium text-zinc-100">{title}</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-300 ring-1 ring-zinc-800">
      {children}
    </pre>
  )
}

export function SampleTag() {
  return (
    <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
      sample data
    </span>
  )
}
