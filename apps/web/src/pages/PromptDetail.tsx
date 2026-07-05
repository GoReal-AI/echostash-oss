import type { Message } from '@echostash/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type Snapshot, fetchPrompt } from '../lib/api'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ResolutionBadge,
  Tabs,
  short,
} from '../lib/ui'

const buttonLink =
  'inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800'

/** Flatten a message's content (string or content blocks) to plain text. */
function toText(content: Message['content']): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'string' ? p : ((p as { text?: string }).text ?? '')))
      .join('')
  }
  return ''
}

/** How a snapshot differs from the one before it (older) — drives the timeline badge. */
function changeKind(
  cur: Snapshot,
  prev: Snapshot | undefined,
): 'first' | 'content' | 'config' | 'both' {
  if (!prev) return 'first'
  const content = cur.contentHash !== prev.contentHash
  const config = cur.configHash !== prev.configHash
  if (content && config) return 'both'
  if (content) return 'content'
  if (config) return 'config'
  return 'content'
}

const modelLabel = (s: { provider: string | null; model: string | null }) =>
  s.model ? `${s.provider ? `${s.provider}/` : ''}${s.model}` : 'no model'

export function PromptDetail() {
  const { id = '' } = useParams()
  const [tab, setTab] = useState('versions')
  const { data, isLoading, error } = useQuery({
    queryKey: ['prompt', id],
    queryFn: () => fetchPrompt(id),
    enabled: id !== '',
  })

  if (isLoading) {
    return <div className="px-4 py-12 text-center text-sm text-zinc-500">Loading…</div>
  }
  if (error || !data) {
    return (
      <EmptyState
        title="Prompt not found"
        hint={
          error ? `Couldn't load it (${(error as Error).message}).` : 'It may have been removed.'
        }
      />
    )
  }

  const { prompt, snapshots } = data
  const latest = snapshots[0]

  return (
    <div>
      <Link to="/prompts" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Prompts
      </Link>
      <div className="mt-3">
        <PageHeader
          title={prompt.name}
          subtitle={prompt.fingerprint}
          actions={
            <Link to="/sandbox" className={buttonLink}>
              Open in Sandbox
            </Link>
          }
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {latest ? <Badge tone="sky">{modelLabel(latest)}</Badge> : null}
        {latest ? <ResolutionBadge resolution={latest.resolution} /> : null}
        {latest?.filePath ? (
          <span className="font-mono text-xs text-zinc-500">
            {latest.filePath}
            {latest.symbol ? `:${latest.symbol}` : ''}
          </span>
        ) : null}
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'versions', label: 'Versions', count: snapshots.length },
          { key: 'messages', label: 'Messages' },
        ]}
      />

      {tab === 'versions' && <VersionsTab snapshots={snapshots} />}
      {tab === 'messages' && <MessagesTab latest={latest} />}
    </div>
  )
}

function MessagesTab({ latest }: { latest: Snapshot | undefined }) {
  if (!latest || latest.messages.length === 0) {
    return (
      <EmptyState
        title="No resolved messages"
        hint="This prompt is assembled at runtime, so the scanner couldn't reconstruct its text statically."
      />
    )
  }
  return (
    <div className="space-y-3">
      {latest.messages.map((m, i) => (
        <Card key={`${m.role}-${i}`} className="overflow-hidden">
          <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
            <Badge tone="zinc">{m.role}</Badge>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-relaxed text-zinc-300">
            {toText(m.content)}
          </pre>
        </Card>
      ))}
    </div>
  )
}

function VersionsTab({ snapshots }: { snapshots: Snapshot[] }) {
  const [showDiff, setShowDiff] = useState(false)
  if (snapshots.length === 0) {
    return (
      <EmptyState title="No versions yet" hint="Versions build up as the scanner sees changes." />
    )
  }
  const latest = snapshots[0]
  const prior = snapshots[1]
  const canDiff = latest !== undefined && prior !== undefined

  return (
    <div>
      {canDiff ? (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setShowDiff((v) => !v)}>
            {showDiff ? 'Hide diff' : 'Diff latest 2 versions'}
          </Button>
        </div>
      ) : null}

      {showDiff && latest && prior ? <ContentDiff a={prior} b={latest} /> : null}

      <ol className="relative space-y-3 border-l border-zinc-800 pl-6">
        {snapshots.map((s, idx) => {
          const kind = changeKind(s, snapshots[idx + 1])
          return (
            <li key={s.id} className="relative">
              <span
                className={`absolute -left-[27px] top-2 h-2.5 w-2.5 rounded-full ring-4 ring-zinc-950 ${
                  idx === 0 ? 'bg-emerald-400' : 'bg-zinc-600'
                }`}
              />
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-zinc-300">v{snapshots.length - idx}</span>
                  <Badge tone="sky">{modelLabel(s)}</Badge>
                  {kind === 'first' && <Badge tone="zinc">first seen</Badge>}
                  {kind === 'content' && <Badge tone="violet">content changed</Badge>}
                  {kind === 'config' && <Badge tone="violet">model / params changed</Badge>}
                  {kind === 'both' && <Badge tone="violet">content + model changed</Badge>}
                  {s.seenCount > 1 ? (
                    <span className="text-xs text-zinc-500">seen ×{s.seenCount}</span>
                  ) : null}
                  <span className="ml-auto text-xs text-zinc-500">
                    {new Date(s.lastSeenAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-zinc-500">
                  <span>content {short(s.contentHash)}</span>
                  <span>config {short(s.configHash)}</span>
                  {s.gitRef ? <span>{s.gitRef}</span> : null}
                  {s.gitSha ? <span>{short(s.gitSha)}</span> : null}
                </div>
              </Card>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Minimal line-level diff between two snapshots' concatenated message text. */
function ContentDiff({ a, b }: { a: Snapshot; b: Snapshot }) {
  const textOf = (s: Snapshot) =>
    s.messages.map((m) => `[${m.role}] ${toText(m.content)}`).join('\n')
  const oldLines = textOf(a).split('\n')
  const newLines = textOf(b).split('\n')
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)
  const removed = oldLines.filter((l) => !newSet.has(l))
  const added = newLines.filter((l) => !oldSet.has(l))
  const unchanged = removed.length === 0 && added.length === 0

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-400">
        Diff — older version → latest
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed">
        {removed.length > 0 ? (
          <span className="text-red-400">{removed.map((l) => `- ${l}`).join('\n')}</span>
        ) : null}
        {removed.length > 0 && added.length > 0 ? '\n' : null}
        {added.length > 0 ? (
          <span className="text-emerald-400">{added.map((l) => `+ ${l}`).join('\n')}</span>
        ) : null}
        {unchanged ? (
          <span className="text-zinc-500">No message-text changes (only model/params differ).</span>
        ) : null}
      </pre>
    </Card>
  )
}
