import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { type Snapshot, fetchPrompt } from '../lib/api'
import { Badge, ResolutionBadge, relativeTime, short } from '../lib/ui'

function changeLabels(snap: Snapshot, prev: Snapshot | undefined): string[] {
  if (!prev) return ['first seen']
  const labels: string[] = []
  if (snap.contentHash !== prev.contentHash) labels.push('content changed')
  if (snap.configHash !== prev.configHash) labels.push('model / params changed')
  return labels.length ? labels : ['re-observed']
}

export function PromptDetail() {
  const { id = '' } = useParams()
  const { data, isLoading, error } = useQuery({
    queryKey: ['prompt', id],
    queryFn: () => fetchPrompt(id),
  })

  if (isLoading) return <p className="text-sm text-zinc-500">Loading…</p>
  if (error) return <p className="text-sm text-red-400">Failed to load: {String(error)}</p>
  if (!data) return null

  const { prompt, snapshots } = data
  // API returns oldest→newest; show newest first, with a label vs the previous (older) one.
  const ordered = snapshots
    .map((snap, i) => ({ snap, labels: changeLabels(snap, snapshots[i - 1]) }))
    .reverse()
  const latest = snapshots[snapshots.length - 1]

  return (
    <div>
      <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Prompts
      </Link>

      <div className="mt-3 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{prompt.name}</h1>
        <div className="mt-1 font-mono text-xs text-zinc-500">{prompt.fingerprint}</div>
      </div>

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
        Change timeline
      </h2>
      <ol className="relative mb-10 space-y-3 border-l border-zinc-800 pl-6">
        {ordered.map(({ snap, labels }, idx) => (
          <li key={snap.id} className="relative">
            <span
              className={`absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-zinc-950 ${
                idx === 0 ? 'bg-emerald-400' : 'bg-zinc-600'
              }`}
            />
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {snap.model && (
                  <Badge tone="sky">
                    {snap.provider ? `${snap.provider}/` : ''}
                    {snap.model}
                  </Badge>
                )}
                <ResolutionBadge resolution={snap.resolution} />
                {labels.map((l) => (
                  <Badge key={l} tone={l.includes('changed') ? 'violet' : 'zinc'}>
                    {l}
                  </Badge>
                ))}
                <span className="ml-auto text-xs text-zinc-500">
                  {relativeTime(snap.lastSeenAt)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-zinc-500">
                <span>content {short(snap.contentHash)}</span>
                <span>config {short(snap.configHash)}</span>
                <span>seen {snap.seenCount}×</span>
                {snap.gitRef && <span>{snap.gitRef}</span>}
                {snap.gitSha && <span>{short(snap.gitSha)}</span>}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {latest && (
        <>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Latest messages
          </h2>
          <div className="space-y-2">
            {latest.messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
              >
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {m.role}
                </div>
                <div className="whitespace-pre-wrap font-mono text-sm text-zinc-200">
                  {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
                </div>
              </div>
            ))}
            {latest.messages.length === 0 && (
              <p className="text-sm text-zinc-600">No statically-resolved messages.</p>
            )}
          </div>
          {Object.keys(latest.params).length > 0 && (
            <div className="mt-4 font-mono text-xs text-zinc-500">
              params: {JSON.stringify(latest.params)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
