import { Link, useParams } from 'react-router-dom'
import { evalCases, getEvalRun, scorers } from '../lib/mock'
import { Badge, Button, Card, EmptyState, PageHeader, ScoreDelta } from '../lib/ui'

export function EvalDetail() {
  const { id = '' } = useParams()
  const run = getEvalRun(id)

  if (!run) return <EmptyState title="Eval run not found" />

  const baseline = run.variants.find((v) => v.baseline)
  const baselineScore = baseline?.score ?? null

  return (
    <div>
      <Link to="/evals" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Evals
      </Link>
      <div className="mt-3">
        <PageHeader
          title={`${run.promptName} · ${run.datasetName}`}
          subtitle={`${run.caseCount} cases · ${scorers.length} scorers`}
          actions={<Button variant="primary">Re-run</Button>}
        />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {run.variants.map((v, i) => {
          const delta = !v.baseline && baselineScore != null ? v.score - baselineScore : null
          return (
            <Card key={`${v.name}-${i}`} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-100">{v.name}</span>
                {v.baseline ? <Badge tone="zinc">baseline</Badge> : <ScoreDelta delta={delta} />}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="sky">
                  {v.provider}/{v.model}
                </Badge>
                <span className="font-mono text-xs text-zinc-500">{v.params}</span>
              </div>
              <div className="mt-3 text-3xl font-semibold text-zinc-100">{v.score}%</div>
            </Card>
          )
        })}
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Case</th>
              {run.variants.map((v, i) => (
                <th key={`h-${v.name}-${i}`} className="px-4 py-3 font-medium">
                  {v.name}: {v.model}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            <tr className="bg-zinc-900/30">
              <td className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Score
              </td>
              {run.variants.map((v) => (
                <td key={`score-${v.name}`} className="px-4 py-3">
                  <span className="font-medium text-zinc-100">{v.score}%</span>
                  {v.baseline && <span className="ml-1 text-xs text-zinc-500">(baseline)</span>}
                </td>
              ))}
            </tr>
            {evalCases.map((c) => (
              <tr key={c.name} className="transition-colors hover:bg-zinc-900/40">
                <td className="px-4 py-3 text-zinc-300">{c.name}</td>
                {run.variants.map((v, ci) => {
                  const cell = c.cells[ci]
                  return (
                    <td key={`${c.name}-${v.name}`} className="px-4 py-3">
                      {cell === 'pass' ? (
                        <span className="text-emerald-400">✓</span>
                      ) : cell === 'fail' ? (
                        <span className="text-red-400">✗</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-600">
          click a cell → output + per-scorer detail
        </div>
      </div>

      <div>
        <div className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Scorers
        </div>
        <div className="flex flex-wrap gap-2">
          {scorers.map((s) => (
            <Badge key={s.id} tone="zinc">
              {s.name} · {s.type}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
