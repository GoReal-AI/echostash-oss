# @echostash/mcp

Read an MCP server's tool surface and diff it against a committed baseline.

`fetchToolSurface` connects over stdio (spawning a command with a minimal environment) or
Streamable HTTP, calls `tools/list` and nothing else, and returns a typed
`McpToolSurface`. `toBaseline` and `diffBaseline` turn that into the per-tool hashes the CI
gate compares.

```ts
import { diffBaseline, fetchToolSurface, parseTarget, toBaseline } from '@echostash/mcp'

const surface = await fetchToolSurface(parseTarget('npx -y @acme/mcp-server'))
const current = toBaseline(surface, { score, tokenBudget, findingCounts })
const changes = diffBaseline(previous, current)
// [{ name: 'refund_order', status: 'description-changed' }, ...]
```

For the scoring side see [`@echostash/analyzer`](https://www.npmjs.com/package/@echostash/analyzer).
For the command line, `npx -y @echostash/cli mcp audit`.

Part of [Echostash](https://github.com/GoReal-AI/echostash-oss): agentless prompt change
intelligence and eval. MIT.
