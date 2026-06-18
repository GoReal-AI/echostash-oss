import { SCORER_CATALOG, buildJudgePrompt, evaluate, isDeterministic } from '@echostash/scoring'
import type { Scorer, ScorerResult } from '@echostash/shared'
import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  Field,
  PageHeader,
  Section,
  Select,
  TextInput,
} from '../lib/ui'

const SAMPLE = 'Sure — happy to help! Your order #4821 has been refunded.'

export function Scorers() {
  const [familyKey, setFamilyKey] = useState(SCORER_CATALOG[0]?.family ?? 'string')
  const family = SCORER_CATALOG.find((f) => f.family === familyKey) ?? SCORER_CATALOG[0]
  const [opName, setOpName] = useState(family?.ops[0]?.op ?? 'contains')
  const op = family?.ops.find((o) => o.op === opName) ?? family?.ops[0]

  const [config, setConfig] = useState<Record<string, string>>({})
  const [output, setOutput] = useState(SAMPLE)
  const [threshold, setThreshold] = useState('')
  const [negate, setNegate] = useState(false)
  const [result, setResult] = useState<ScorerResult | null>(null)
  const [judgePrompt, setJudgePrompt] = useState<string | null>(null)

  function pickFamily(key: string) {
    const fam = SCORER_CATALOG.find((f) => f.family === key)
    setFamilyKey(key as typeof familyKey)
    setOpName(fam?.ops[0]?.op ?? 'contains')
    setConfig({})
    setResult(null)
    setJudgePrompt(null)
  }

  function buildScorer(): Scorer {
    const cfg: Record<string, unknown> = {}
    for (const f of op?.config ?? []) {
      const raw = config[f.key]
      if (raw == null || raw === '') continue
      if (f.kind === 'number') cfg[f.key] = Number(raw)
      else if (f.kind === 'json') {
        try {
          cfg[f.key] = JSON.parse(raw)
        } catch {
          cfg[f.key] = raw
        }
      } else cfg[f.key] = raw
    }
    return {
      id: 'preview',
      name: 'preview',
      family: familyKey as Scorer['family'],
      op: (opName as Scorer['op']) ?? 'contains',
      config: cfg,
      target: 'response',
      weight: 1,
      threshold: threshold === '' ? undefined : Number(threshold),
      negate,
    }
  }

  async function run() {
    const scorer = buildScorer()
    if (!isDeterministic(scorer)) {
      // judge runs in the data-plane runner; here we just show the prompt it would send
      setJudgePrompt(buildJudgePrompt(String(scorer.config.rubric ?? ''), output, undefined))
      setResult(null)
      return
    }
    setJudgePrompt(null)
    const r = await evaluate(scorer, {
      output,
      metrics: { latencyMs: 420, totalTokens: 128, costUsd: 0.002 },
    })
    setResult(r)
  }

  const tone = useMemo(() => {
    if (!result) return 'zinc'
    return result.status === 'pass' ? 'emerald' : result.status === 'fail' ? 'red' : 'amber'
  }, [result])

  return (
    <div>
      <PageHeader
        title="Scorers"
        subtitle="The checks that grade prompt outputs. Build one and try it on sample text — the deterministic families run right here in your browser (same engine the runner uses)."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Family">
              <Select value={familyKey} onChange={(e) => pickFamily(e.target.value)}>
                {SCORER_CATALOG.map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Check">
              <Select
                value={opName}
                onChange={(e) => {
                  setOpName(e.target.value as typeof opName)
                  setConfig({})
                }}
              >
                {family?.ops.map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {(op?.config ?? []).map((f) =>
            f.kind === 'json' ? (
              <Field key={f.key} label={f.label}>
                <textarea
                  className="h-28 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-zinc-500"
                  value={config[f.key] ?? ''}
                  onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                  placeholder={'{ "type": "object", "required": ["a"] }'}
                />
              </Field>
            ) : (
              <Field key={f.key} label={f.label}>
                <TextInput
                  type={f.kind === 'number' ? 'number' : 'text'}
                  value={config[f.key] ?? ''}
                  onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                />
              </Field>
            ),
          )}

          <div className="grid grid-cols-2 items-end gap-3">
            {op?.scored && (
              <Field label="Threshold (0–1)">
                <TextInput
                  type="number"
                  value={threshold}
                  placeholder="0.5"
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </Field>
            )}
            <label className="flex items-center gap-2 py-1.5 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={negate}
                onChange={(e) => setNegate(e.target.checked)}
              />
              negate (must NOT)
            </label>
          </div>
        </Card>

        <Card className="space-y-4 p-4">
          <Field label="Sample output">
            <textarea
              className="h-40 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500"
              value={output}
              onChange={(e) => setOutput(e.target.value)}
            />
          </Field>
          <Button variant="primary" onClick={run}>
            Run check
          </Button>

          {result && (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
              <div className="flex items-center gap-3">
                <Badge tone={tone}>{result.status}</Badge>
                <span className="text-sm text-zinc-400">score {result.score.toFixed(2)}</span>
              </div>
              {result.reason && <p className="mt-2 text-sm text-zinc-500">{result.reason}</p>}
            </div>
          )}

          {judgePrompt && (
            <div>
              <p className="mb-2 text-xs text-zinc-500">
                LLM-judge runs in the runner (with the project's keys). This is the exact prompt it
                sends:
              </p>
              <CodeBlock>{judgePrompt}</CodeBlock>
            </div>
          )}
        </Card>
      </div>

      <Section title="Phase-1 families">
        <div className="grid gap-3 md:grid-cols-2">
          {SCORER_CATALOG.map((f) => (
            <Card key={f.family} className="p-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-100">{f.label}</span>
                <Badge tone={f.deterministic ? 'emerald' : 'sky'}>
                  {f.deterministic ? 'deterministic' : 'LLM'}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.ops.map((o) => (
                  <span
                    key={o.op}
                    className="rounded bg-zinc-800/70 px-1.5 py-0.5 font-mono text-xs text-zinc-400"
                  >
                    {o.op}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  )
}
