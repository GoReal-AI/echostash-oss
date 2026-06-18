import { useState } from 'react'
import { Link } from 'react-router-dom'
import { datasets, getProject, getPrompt, projects, prompts } from '../lib/mock'
import { Button, Field, Modal, PageHeader, SampleTag, Select, TextInput } from '../lib/ui'

export function Datasets() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <PageHeader
        title="Datasets"
        subtitle="Test cases you eval prompts against."
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New dataset
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
              <th className="px-4 py-3 font-medium">Dataset</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Linked prompt</th>
              <th className="px-4 py-3 font-medium">Cases</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {datasets.map((d) => {
              const linked = d.promptId ? getPrompt(d.promptId) : undefined
              return (
                <tr key={d.id} className="group transition-colors hover:bg-zinc-900/40">
                  <td className="px-4 py-3">
                    <Link to={`/datasets/${d.id}`} className="block">
                      <div className="font-medium text-zinc-100 group-hover:text-white">
                        {d.name}
                      </div>
                      <div className="text-xs text-zinc-500">{d.description}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {getProject(d.projectId)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{linked?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-400">{d.caseCount}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New dataset">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setOpen(false)
          }}
        >
          <Field label="Name">
            <TextInput placeholder="golden-set" />
          </Field>
          <Field label="Project">
            <Select defaultValue={projects[0]?.id ?? ''}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Linked prompt" hint="Optional — leave shared to reuse across prompts.">
            <Select defaultValue="">
              <option value="">— shared / not attached</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description">
            <TextInput placeholder="What this dataset covers…" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <button
              type="submit"
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
            >
              Create dataset
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
