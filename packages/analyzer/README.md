# @echostash/analyzer

Deterministic checks and the Tool Surface Score for MCP tool definitions. No model calls, no
network, no clock: the same surface always produces the same report.

An MCP server's tool `name`, `description` and `inputSchema` are the whole prompt a model gets
for choosing and calling that tool. This package tells you where that prompt is weak:
confusable tool pairs, undescribed or unbounded parameters, thin or bloated descriptions,
missing negative guidance, open schemas, missing annotations, and what the surface costs in
context tokens on every request.

```ts
import { analyze } from '@echostash/analyzer'

const report = analyze(surface) // McpToolSurface from @echostash/mcp or a recorded tools/list
report.score        // 0-100, per tool then averaged
report.findings     // [{ check, severity, tool, message, hint }]
report.tokenBudget  // { total, perTool }
```

Runs anywhere, including inside your own test suite:

```ts
expect(analyze(surface).score).toBeGreaterThanOrEqual(90)
```

For the command line and the CI gate, `npx -y @echostash/cli mcp audit`.

Part of [Echostash](https://github.com/GoReal-AI/echostash-oss): agentless prompt change
intelligence and eval. MIT.
