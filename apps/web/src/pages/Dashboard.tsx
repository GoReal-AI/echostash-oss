import { Link } from 'react-router-dom'
import { projects, prompts } from '../lib/mock'
import { Badge, Card, EvalBadge, PageHeader, SampleTag, Section, StatCard } from '../lib/ui'

export function Dashboard() {
  const evaluated = prompts.filter((p) => p.evalState !== 'none')
  const passing = evaluated.filter((p) => p.evalState === 'pass')
  const passRate =
    evaluated.length === 0 ? 0 : Math.round((passing.length / evaluated.length) * 100)
  const failing = prompts.filter((p) => p.evalState === 'fail')
  const calls7d = prompts.reduce((sum, p) => sum + p.calls7d, 0)

  // Synthesize recent change rows from the prompts list.
  const changeLabels = ['model changed', 'content changed', 'content changed', 'model changed']
  const recent = prompts.slice(0, 4).map((p, i) => ({
    prompt: p,
    label: changeLabels[i] ?? 'content changed',
  }))

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your prompt surface area at a glance."
        actions={<SampleTag />}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Prompts" value={prompts.length} />
        <StatCard label="Projects" value={projects.length} />
        <StatCard
          label="Eval pass rate"
          value={`${passRate}%`}
          sub={`${passing.length}/${evaluated.length} evaluated`}
        />
        <StatCard label="Failing evals" value={failing.length} />
        <StatCard label="7d calls" value={calls7d.toLocaleString()} />
      </div>

      <Section title="Needs attention">
        {failing.length === 0 ? (
          <Card className="p-4 text-sm text-zinc-500">Nothing failing right now.</Card>
        ) : (
          <Card className="divide-y divide-zinc-800/70">
            {failing.map((p) => (
              <Link
                key={p.id}
                to={`/prompts/${p.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-900/40"
              >
                <span className="font-medium text-zinc-100">{p.name}</span>
                <Badge tone="sky">
                  {p.provider}/{p.model}
                </Badge>
                <span className="ml-auto">
                  <EvalBadge state={p.evalState} score={p.evalScore} />
                </span>
              </Link>
            ))}
          </Card>
        )}
      </Section>

      <Section title="Recent changes">
        <Card className="divide-y divide-zinc-800/70">
          {recent.map(({ prompt, label }) => (
            <Link
              key={prompt.id}
              to={`/prompts/${prompt.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-900/40"
            >
              <span className="font-medium text-zinc-100">{prompt.name}</span>
              <Badge tone="violet">{label}</Badge>
              <span className="ml-auto text-xs text-zinc-500">{prompt.lastChanged}</span>
            </Link>
          ))}
        </Card>
      </Section>
    </div>
  )
}
