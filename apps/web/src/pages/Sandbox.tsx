import { useState } from 'react'
import { datasets, prompts, providers } from '../lib/mock'
import { Badge, Button, Card, Field, PageHeader, Select, TextInput } from '../lib/ui'

const sampleMessages = `system: You are a terse summarizer.
user: Summarize: {{text}}`

const allModels = providers.flatMap((p) => p.models)

export function Sandbox() {
  const firstPrompt = prompts[0]
  const [promptId, setPromptId] = useState(firstPrompt?.id ?? '')
  const [model, setModel] = useState(allModels[0] ?? '')
  const [temperature, setTemperature] = useState('0.2')
  const [maxTokens, setMaxTokens] = useState('500')
  const [messages, setMessages] = useState(sampleMessages)
  const [datasetId, setDatasetId] = useState('adhoc')
  const [variable, setVariable] = useState('A customer is requesting a refund for order #4821.')
  const [ran, setRan] = useState(false)

  return (
    <div>
      <PageHeader
        title="Sandbox"
        subtitle="Open any prompt, change the model/params/wording, run it against test cases — no app boot."
        actions={
          <>
            <Button>+ Compare variant</Button>
            <Button variant="primary">Copy to code</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-4 text-sm font-medium text-zinc-300">Variant A</div>
          <div className="space-y-4">
            <Field label="Prompt">
              <Select value={promptId} onChange={(e) => setPromptId(e.target.value)}>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Model">
              <Select value={model} onChange={(e) => setModel(e.target.value)}>
                {allModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Temperature">
                <TextInput value={temperature} onChange={(e) => setTemperature(e.target.value)} />
              </Field>
              <Field label="Max tokens">
                <TextInput value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
              </Field>
            </div>
            <Field label="Messages">
              <textarea
                value={messages}
                onChange={(e) => setMessages(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              />
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-4 text-sm font-medium text-zinc-300">Inputs</div>
          <div className="space-y-4">
            <Field label="Dataset">
              <Select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
                <option value="adhoc">Ad-hoc input</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.caseCount} cases)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="{{text}}" hint="Variable injected into the prompt.">
              <TextInput value={variable} onChange={(e) => setVariable(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={() => setRan(true)}>
              Run
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium text-zinc-300">Output</div>
          {!ran ? (
            <p className="text-sm text-zinc-500">Run to see output.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-zinc-200">
                The customer is requesting a refund for order #4821. They have not provided a
                reason, so the reply should confirm the order, acknowledge the request, and ask for
                the refund reason before proceeding.
              </p>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span>312 tokens · $0.004 · 1.2s</span>
                <span className="flex items-center gap-1.5">
                  <Badge tone="emerald">✓</Badge>
                  <Badge tone="emerald">✓</Badge>
                  <Badge tone="red">✗</Badge>
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
