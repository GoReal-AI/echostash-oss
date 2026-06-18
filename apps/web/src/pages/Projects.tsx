import { useState } from 'react'
import { Link } from 'react-router-dom'
import { projects } from '../lib/mock'
import { Button, Card, Field, Modal, PageHeader, SampleTag, TextInput } from '../lib/ui'

export function Projects() {
  const [open, setOpen] = useState(false)

  function handleSubmit() {
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="A project maps to a codebase. Connect a repo and we discover its prompts."
        actions={
          <>
            <SampleTag />
            <Button variant="primary" onClick={() => setOpen(true)}>
              New project
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="block">
            <Card className="p-4 transition-colors hover:bg-zinc-900/70">
              <div className="font-medium text-zinc-100">{p.name}</div>
              <div className="mt-1 font-mono text-xs text-zinc-500">{p.repo}</div>
              <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                <span>{p.promptCount} prompts</span>
                <span>{p.defaultBranch}</span>
              </div>
              <div className="mt-1 text-xs text-zinc-600">Last scan {p.lastScan}</div>
            </Card>
          </Link>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <div className="space-y-4">
          <Field label="Name">
            <TextInput placeholder="Support Bot" />
          </Field>
          <Field label="Git repository" hint="e.g. acme/support-bot">
            <TextInput placeholder="acme/support-bot" />
          </Field>
          <Field label="Default branch">
            <TextInput placeholder="main" defaultValue="main" />
          </Field>
          <p className="text-xs text-zinc-500">We scan this repo in CI; no code changes needed.</p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit}>
              Create project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
