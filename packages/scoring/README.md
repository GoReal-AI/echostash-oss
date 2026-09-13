# @echostash/scoring

The isomorphic scorer engine behind Echostash evals. Deterministic assertions such as
`contains`, `regex` and `json_schema`, a scorer catalog with metadata for UIs, and one
`evaluate()` that runs the same way in the eval runner, in CI, and in the browser.

```ts
import { evaluate } from '@echostash/scoring'

const result = await evaluate(
  { id: 'mentions-refund', name: 'mentions refund', family: 'string', op: 'contains', config: { value: 'refund' } },
  { output: modelOutput },
)
result.status  // 'pass' | 'fail' | 'error'
result.score   // 0..1
result.reason  // why it failed, when it did
```

Model-judged and embedding scorers are dispatched by the runner; this package owns the
contract and every scorer that needs no model.

Part of [Echostash](https://github.com/GoReal-AI/echostash-oss): agentless prompt change
intelligence and eval. MIT.
