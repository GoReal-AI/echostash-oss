# @echostash/shared

The Echostash contract: zod schemas and TypeScript types for everything the other packages
exchange. Prompts, MCP tool surfaces, audit reports and findings, baselines, and the
server-to-runner eval protocol.

Every Echostash package validates at its edges with these schemas. If you consume the CLI's
`--json` output or write tooling around `@echostash/mcp` and `@echostash/analyzer`, this is
where the shapes live.

```ts
import { McpAuditReport, McpToolSurface } from '@echostash/shared'

const surface = McpToolSurface.parse(JSON.parse(await readFile('tools-list.json', 'utf8')))
const report = McpAuditReport.parse(JSON.parse(cliJsonOutput))
```

Part of [Echostash](https://github.com/GoReal-AI/echostash-oss): agentless prompt change
intelligence and eval. MIT.
