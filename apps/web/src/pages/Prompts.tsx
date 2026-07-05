import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { type PromptListItem, fetchPrompts } from '../lib/api'
import { Badge, Button, EmptyState, PageHeader, ResolutionBadge, TextInput } from '../lib/ui'

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function ModelCell({ p }: { p: PromptListItem }) {
  if (!p.model) return <span className="text-zinc-600">—</span>
  return (
    <Badge tone="sky">
      {p.provider ? `${p.provider}/` : ''}
      {p.model}
    </Badge>
  )
}

export function Prompts() {
  const [q, setQ] = useState('')
  const { data, isLoading, error } = useQuery({ queryKey: ['prompts'], queryFn: fetchPrompts })

  const rows = (data ?? []).filter(
    (p) =>
      q === '' ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.fingerprint.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div>
      <PageHeader
        title="Prompts"
        subtitle="Every prompt discovered in your code."
        actions={
          <Link to="/sources">
            <Button variant="primary">Scan a repo</Button>
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="w-64">
          <TextInput
            placeholder="Search prompts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {data ? <div className="ml-auto text-xs text-zinc-500">{data.length} prompt(s)</div> : null}
      </div>

      {error ? (
        <EmptyState
          title="Couldn't load prompts"
          hint={`The control-plane server isn't reachable (${(error as Error).message}). Is it running on :8080?`}
        />
      ) : isLoading ? (
        <div className="rounded-lg border border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={data?.length ? 'No prompts match your search' : 'No prompts discovered yet'}
          hint={
            data?.length
              ? 'Try a different search.'
              : 'Run `echostash scan <your-repo>` to discover the prompts in your code.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Prompt</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Res.</th>
                <th className="px-4 py-3 font-medium">Versions</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {rows.map((p) => (
                <tr key={p.id} className="group transition-colors hover:bg-zinc-900/40">
                  <td className="px-4 py-3">
                    <Link to={`/prompts/${p.id}`} className="block">
                      <div className="font-medium text-zinc-100 group-hover:text-white">
                        {p.name}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">{p.fingerprint}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ModelCell p={p} />
                  </td>
                  <td className="px-4 py-3">
                    {p.resolution ? <ResolutionBadge resolution={p.resolution} /> : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{p.snapshotCount}</td>
                  <td className="px-4 py-3 text-zinc-500">{timeAgo(p.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
