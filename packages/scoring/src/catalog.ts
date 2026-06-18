import type { AssertionOp, ScorerFamily } from '@echostash/shared'

export interface ConfigField {
  key: string
  label: string
  kind: 'text' | 'number' | 'json'
}

export interface OpSpec {
  op: AssertionOp
  label: string
  /** scored (0..1) vs boolean — UI shows a threshold control for scored ops */
  scored?: boolean
  config: ConfigField[]
}

export interface FamilySpec {
  family: ScorerFamily
  label: string
  deterministic: boolean
  ops: OpSpec[]
}

const valueField: ConfigField = { key: 'value', label: 'Value', kind: 'text' }
const rangeFields: ConfigField[] = [
  { key: 'min', label: 'Min', kind: 'number' },
  { key: 'max', label: 'Max', kind: 'number' },
]

/** Phase-1 scorer families surfaced in the UI builder. */
export const SCORER_CATALOG: FamilySpec[] = [
  {
    family: 'string',
    label: 'String / regex',
    deterministic: true,
    ops: [
      { op: 'contains', label: 'contains', config: [valueField] },
      { op: 'not_contains', label: 'does not contain', config: [valueField] },
      { op: 'equals', label: 'equals', config: [valueField] },
      {
        op: 'matches',
        label: 'matches regex',
        config: [
          { key: 'pattern', label: 'Pattern', kind: 'text' },
          { key: 'flags', label: 'Flags', kind: 'text' },
        ],
      },
      { op: 'starts_with', label: 'starts with', config: [valueField] },
      { op: 'ends_with', label: 'ends with', config: [valueField] },
      { op: 'length', label: 'length in range', config: rangeFields },
      { op: 'word_count', label: 'word count in range', config: rangeFields },
    ],
  },
  {
    family: 'structural',
    label: 'Structural',
    deterministic: true,
    ops: [
      { op: 'json_valid', label: 'is valid JSON', config: [] },
      {
        op: 'json_schema',
        label: 'matches JSON schema',
        config: [{ key: 'schema', label: 'JSON schema', kind: 'json' }],
      },
      { op: 'yaml_valid', label: 'is valid YAML', config: [] },
    ],
  },
  {
    family: 'operational',
    label: 'Operational',
    deterministic: true,
    ops: [
      {
        op: 'latency',
        label: 'latency ≤ max (ms)',
        config: [{ key: 'max', label: 'Max ms', kind: 'number' }],
      },
      { op: 'token_count', label: 'token count in range', config: rangeFields },
      {
        op: 'cost',
        label: 'cost ≤ max ($)',
        config: [{ key: 'max', label: 'Max $', kind: 'number' }],
      },
    ],
  },
  {
    family: 'llm_judge',
    label: 'LLM judge',
    deterministic: false,
    ops: [
      {
        op: 'judge',
        label: 'rubric judgement',
        scored: true,
        config: [{ key: 'rubric', label: 'Rubric (what to check)', kind: 'text' }],
      },
    ],
  },
]
