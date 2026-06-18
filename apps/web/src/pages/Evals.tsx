import { useState } from 'react'
import { Link } from 'react-router-dom'
import { datasets, evalRuns, prompts } from '../lib/mock'
import { Badge, Button, Field, Modal, PageHeader, SampleTag, ScoreDelta, Select } from '../lib/ui'

export function Evals() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <PageHeader
        title="Evals"
        subtitle="Run prompt variants against datasets, score, compare, gate regressions."
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New eval run
          </Button>
        }
      />

      <div className="mb-4 flex justify-end">
        <SampleTag />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Prompt</th>
              <th className="px-4 py-3 font-medium">Dataset</th>
              <th className="px-4 py-3 font-medium">Cases</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Trigger</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {evalRuns.map((r) => (
              <tr key={r.id} className="group transition-colors hover:bg-zinc-900/40">
                <td className="px-4 py-3">
                  <Link
                    to={`/evals/${r.id}`}
                    className="font-medium text-zinc-100 group-hover:text-white"
                  >
                    {r.promptName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400">{r.datasetName}</td>
                <td className="px-4 py-3 text-zinc-400">{r.caseCount}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-zinc-100">{r.score}%</span>
                    <ScoreDelta delta={r.delta} />
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={r.trigger === 'ci' ? 'violet' : 'zinc'}>{r.trigger}</Badge>
                </td>
                <td className="px-4 py-3 text-zinc-500">{r.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New eval run">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setOpen(false)
          }}
        >
          <Field label="Prompt">
            <Select defaultValue={prompts[0]?.id ?? ''}>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dataset">
            <Select defaultValue={datasets[0]?.id ?? ''}>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-zinc-500">
            Variants &amp; scorers will be chosen on the next step.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <button
              type="submit"
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
            >
              Start run
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
