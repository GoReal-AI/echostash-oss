import { Link, useParams } from 'react-router-dom'
import { datasetCases, getDataset, getPrompt } from '../lib/mock'
import { Badge, Button, Card, EmptyState, PageHeader, SampleTag } from '../lib/ui'

export function DatasetDetail() {
  const { id = '' } = useParams()
  const dataset = getDataset(id)

  if (!dataset) return <EmptyState title="Dataset not found" />

  const linked = dataset.promptId ? getPrompt(dataset.promptId) : undefined

  return (
    <div>
      <Link to="/datasets" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Datasets
      </Link>
      <div className="mt-3">
        <PageHeader
          title={dataset.name}
          subtitle={dataset.description}
          actions={
            <>
              <Button>Add case</Button>
              <Button variant="primary">Run eval</Button>
            </>
          }
        />
      </div>

      <div className="mb-6 flex items-center">
        <SampleTag />
      </div>

      <Card className="mb-6 p-4 text-sm text-zinc-300">
        {linked ? (
          <span>
            Attached to prompt{' '}
            <Link
              to={`/prompts/${linked.id}`}
              className="font-medium text-zinc-100 hover:text-white"
            >
              {linked.name}
            </Link>
          </span>
        ) : (
          <span className="text-zinc-400">Shared / not attached to a prompt</span>
        )}
      </Card>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Case</th>
              <th className="px-4 py-3 font-medium">Input</th>
              <th className="px-4 py-3 font-medium">Expected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {datasetCases.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-zinc-900/40">
                <td className="px-4 py-3 font-medium text-zinc-100">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {Object.entries(c.input)
                    .map(([k, v]) => `${k} = ${v}`)
                    .join(', ')}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {c.expected ?? <Badge tone="zinc">—</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
