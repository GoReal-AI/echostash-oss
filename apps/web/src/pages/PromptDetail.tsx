import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  type Version,
  datasetsFor,
  evalRunsFor,
  getProject,
  getPrompt,
  traces,
  versionsFor,
} from '../lib/mock'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  EvalBadge,
  PageHeader,
  ResolutionBadge,
  SampleTag,
  ScoreDelta,
  Tabs,
  short,
} from '../lib/ui'

export function PromptDetail() {
  const { id = '' } = useParams()
  const [tab, setTab] = useState('versions')
  const prompt = getPrompt(id)

  if (!prompt) return <EmptyState title="Prompt not found" />

  const versions = versionsFor(id)
  const dsets = datasetsFor(id)
  const runs = evalRunsFor(id)
  const usage = traces.filter((t) => t.promptName === prompt.name)

  return (
    <div>
      <Link to="/prompts" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Prompts
      </Link>
      <div className="mt-3">
        <PageHeader
          title={prompt.name}
          subtitle={`${getProject(prompt.projectId)?.name} · ${prompt.fingerprint}`}
          actions={
            <>
              <Link to="/sandbox" className={buttonLink}>
                Open in Sandbox
              </Link>
              <Button variant="primary">Run eval</Button>
            </>
          }
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone="sky">
          {prompt.provider}/{prompt.model}
        </Badge>
        <ResolutionBadge resolution={prompt.resolution} />
        <EvalBadge state={prompt.evalState} score={prompt.evalScore} />
        <span className="text-xs text-zinc-500">{prompt.calls7d.toLocaleString()} calls / 7d</span>
        <span className="ml-auto">
          <SampleTag />
        </span>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'versions', label: 'Versions', count: prompt.versions },
          { key: 'usage', label: 'Usage' },
          { key: 'datasets', label: 'Datasets', count: dsets.length },
          { key: 'evals', label: 'Eval history', count: runs.length },
        ]}
      />

      {tab === 'versions' && <VersionsTab versions={versions} prompt={prompt} />}

      {tab === 'usage' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-sm text-zinc-300">
              Used at{' '}
              <span className="font-mono text-zinc-100">
                {prompt.fingerprint.replace(':', ' · ')}
              </span>{' '}
              ({prompt.file}:{prompt.line})
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {prompt.calls7d.toLocaleString()} calls in the last 7 days · 1 call site
            </div>
          </Card>
          <div>
            <div className="mb-2 text-sm font-medium text-zinc-400">Recent calls</div>
            {usage.length === 0 ? (
              <p className="text-sm text-zinc-600">No recent traces.</p>
            ) : (
              <Card className="divide-y divide-zinc-800/70">
                {usage.map((t) => (
                  <div key={t.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                    <Badge tone={t.status === 'ok' ? 'emerald' : 'red'}>{t.status}</Badge>
                    <span className="text-zinc-400">
                      {t.provider}/{t.model}
                    </span>
                    <span className="text-zinc-500">{t.latencyMs}ms</span>
                    <span className="text-zinc-500">{t.tokens} tok</span>
                    <span className="ml-auto text-zinc-600">{t.time}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'datasets' && (
        <div>
          <div className="mb-3 flex justify-end">
            <Button variant="primary">+ Attach dataset</Button>
          </div>
          {dsets.length === 0 ? (
            <EmptyState
              title="No datasets yet"
              hint="Attach a dataset of test cases to eval this prompt."
            >
              <Button variant="primary">+ Create dataset</Button>
            </EmptyState>
          ) : (
            <Card className="divide-y divide-zinc-800/70">
              {dsets.map((d) => (
                <Link
                  key={d.id}
                  to={`/datasets/${d.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-900/40"
                >
                  <div>
                    <div className="font-medium text-zinc-100">{d.name}</div>
                    <div className="text-xs text-zinc-500">{d.description}</div>
                  </div>
                  <span className="ml-auto text-sm text-zinc-400">{d.caseCount} cases</span>
                </Link>
              ))}
            </Card>
          )}
        </div>
      )}

      {tab === 'evals' && (
        <div>
          {runs.length === 0 ? (
            <EmptyState title="No eval runs yet" hint="Run an eval to start tracking quality.">
              <Button variant="primary">Run eval</Button>
            </EmptyState>
          ) : (
            <Card className="divide-y divide-zinc-800/70">
              {runs.map((r) => (
                <Link
                  key={r.id}
                  to={`/evals/${r.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-900/40"
                >
                  <Badge tone={r.trigger === 'ci' ? 'violet' : 'zinc'}>{r.trigger}</Badge>
                  <span className="text-zinc-400">{r.datasetName}</span>
                  <span className="font-medium text-zinc-100">{r.score}%</span>
                  <ScoreDelta delta={r.delta} />
                  <span className="ml-auto text-xs text-zinc-600">{r.createdAt}</span>
                </Link>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

const buttonLink =
  'inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800'

function VersionsTab({
  versions,
  prompt,
}: { versions: Version[]; prompt: { model: string; provider: string } }) {
  if (versions.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-sm text-zinc-300">
          Current:{' '}
          <Badge tone="sky">
            {prompt.provider}/{prompt.model}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Version history builds up as the scanner observes changes across commits.
        </p>
      </Card>
    )
  }
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button>
          Diff v{versions[0]?.v} ↔ v{versions[1]?.v ?? versions[0]?.v}
        </Button>
      </div>
      <ol className="relative space-y-3 border-l border-zinc-800 pl-6">
        {versions.map((s, idx) => (
          <li key={s.id} className="relative">
            <span
              className={`absolute -left-[27px] top-2 h-2.5 w-2.5 rounded-full ring-4 ring-zinc-950 ${
                idx === 0 ? 'bg-emerald-400' : 'bg-zinc-600'
              }`}
            />
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-zinc-300">v{s.v}</span>
                <Badge tone="sky">
                  {s.provider}/{s.model}
                </Badge>
                {s.change === 'model' && <Badge tone="violet">model changed</Badge>}
                {s.change === 'content' && <Badge tone="violet">content changed</Badge>}
                {s.change === 'first' && <Badge tone="zinc">first seen</Badge>}
                <span className="ml-auto text-xs text-zinc-500">
                  {s.author} · {s.date}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-zinc-500">
                <span>content {short(s.contentHash)}</span>
                <span>config {short(s.configHash)}</span>
                <span>{s.gitRef}</span>
                <span>{s.gitSha}</span>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  )
}
