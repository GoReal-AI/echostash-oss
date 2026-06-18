import { traces } from '../lib/mock'
import { Badge, Card, PageHeader, SampleTag, Section, StatCard } from '../lib/ui'

export function Observability() {
  return (
    <div>
      <PageHeader
        title="Observability"
        subtitle="Runtime cost & latency of your LLM calls."
        actions={<SampleTag />}
      />

      <Card className="mb-6 p-4 text-sm text-zinc-400">
        Complementary to runtime tracers like Langfuse — this view is a lightweight preview
        (post-v1).
      </Card>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Requests" value="27.4k" />
        <StatCard label="p50 latency" value="610ms" />
        <StatCard label="p95 latency" value="5.2s" />
        <StatCard label="Total cost 7d" value="$84.20" />
        <StatCard label="Error rate" value="1.2%" />
      </div>

      <Section title="Recent traces">
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Prompt</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Latency</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {traces.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-zinc-900/40">
                  <td className="px-4 py-3 font-medium text-zinc-100">{t.promptName}</td>
                  <td className="px-4 py-3">
                    <Badge tone="sky">
                      {t.provider}/{t.model}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{t.latencyMs}ms</td>
                  <td className="px-4 py-3 text-zinc-400">{t.tokens.toLocaleString()}</td>
                  <td className="px-4 py-3 text-zinc-400">${t.costUsd.toFixed(4)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={t.status === 'ok' ? 'emerald' : 'red'}>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{t.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
