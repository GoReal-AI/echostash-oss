import { useState } from 'react'
import { projects, prompts } from '../lib/mock'
import {
  Badge,
  Button,
  Card,
  Field,
  Modal,
  PageHeader,
  SampleTag,
  Section,
  TextInput,
} from '../lib/ui'

const recentChanges = prompts.slice(0, 4).map((p, i) => ({
  id: p.id,
  name: p.name,
  change: ['model changed', 'content changed', 'first seen', 're-observed'][i] ?? 'changed',
  time: p.lastChanged,
}))

export function Sources() {
  const [open, setOpen] = useState(false)

  function handleSubmit() {
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="Sources"
        subtitle="Where your prompts come from. Connect a repo; we scan it in CI."
        actions={
          <>
            <SampleTag />
            <Button variant="primary" onClick={() => setOpen(true)}>
              Connect repository
            </Button>
          </>
        }
      />

      <Section title="How discovery works">
        <Card className="p-4">
          <ul className="space-y-1.5 text-sm text-zinc-400">
            <li>· Agentless static scan finds LLM call sites in your code.</li>
            <li>
              · Runs via the GitHub Action or{' '}
              <span className="font-mono text-zinc-300">echostash scan</span>.
            </li>
            <li>· No SDK, annotations, or runtime instrumentation required.</li>
          </ul>
        </Card>
      </Section>

      <Section title="Connected">
        <Card className="divide-y divide-zinc-800/70">
          {projects.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="font-mono text-zinc-100">{p.repo}</span>
              <Badge tone="sky">github</Badge>
              <Badge tone="emerald">active</Badge>
              <span className="text-xs text-zinc-500">Last scan {p.lastScan}</span>
              <Button className="ml-auto">Re-scan</Button>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Recent changes">
        <Card className="divide-y divide-zinc-800/70">
          {recentChanges.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="font-medium text-zinc-100">{c.name}</span>
              <Badge tone="violet">{c.change}</Badge>
              <span className="ml-auto text-xs text-zinc-600">{c.time}</span>
            </div>
          ))}
        </Card>
      </Section>

      <Modal open={open} onClose={() => setOpen(false)} title="Connect repository">
        <div className="space-y-4">
          <Field label="GitHub repository" hint="e.g. acme/support-bot">
            <TextInput placeholder="acme/support-bot" />
          </Field>
          <Field label="File globs">
            <TextInput defaultValue="**/*.{ts,tsx,js}" />
          </Field>
          <Field label="Branch">
            <TextInput placeholder="main" defaultValue="main" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit}>
              Connect
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
