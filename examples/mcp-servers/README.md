# Tool surface audits of popular MCP servers

What `echostash mcp audit` says about the tool surfaces of well-known public MCP servers, as
published on npm on 2026-09-13. Every number here is deterministic and reproducible: no API key,
no model call, no infrastructure. The CLI spawns the server with a minimal environment, reads
`tools/list`, and analyzes it.

The point is not to rank anyone. It is to show what the model sees. A tool's `name`,
`description` and `inputSchema` are the entire prompt the model gets for choosing and calling
it, and these servers are what a large share of agents run against every day.

## Scoreboard

Score is the [Tool Surface Score](../../packages/analyzer/src/score.ts) (0-100, higher is better).
Tokens is the context cost of the tool list on every request. Findings are error / warn / info.

| Server (npm) | Tools | Score | Tokens/request | Findings | Most common finding |
| :--- | ---: | ---: | ---: | :---: | :--- |
| [exa-mcp-server](https://www.npmjs.com/package/exa-mcp-server) | 2 | **97.5** | ~438 | 0 / 0 / 4 | `no-negative-guidance` (2) |
| [@upstash/context7-mcp](https://www.npmjs.com/package/@upstash/context7-mcp) | 2 | **97** | ~1,127 | 0 / 1 / 1 | `description-bloated` (1) |
| [@modelcontextprotocol/server-sequential-thinking](https://www.npmjs.com/package/@modelcontextprotocol/server-sequential-thinking) | 1 | **95** | ~989 | 0 / 1 / 1 | `description-bloated` (1) |
| [@modelcontextprotocol/server-everything](https://www.npmjs.com/package/@modelcontextprotocol/server-everything) | 13 | **94.9** | ~1,172 | 0 / 10 / 14 | `no-negative-guidance` (13) |
| [@playwright/mcp](https://www.npmjs.com/package/@playwright/mcp) | 24 | **94** | ~3,815 | 1 / 20 / 30 | `no-negative-guidance` (24) |
| [chrome-devtools-mcp](https://www.npmjs.com/package/chrome-devtools-mcp) | 29 | **93** | ~5,474 | 0 / 35 / 34 | `schema-open` (29) |
| [mcp-server-kubernetes](https://www.npmjs.com/package/mcp-server-kubernetes) | 23 | **92.1** | ~5,515 | 6 / 13 / 36 | `no-negative-guidance` (23) |
| [@modelcontextprotocol/server-memory](https://www.npmjs.com/package/@modelcontextprotocol/server-memory) | 9 | **91** | ~977 | 4 / 2 / 17 | `no-negative-guidance` (9) |
| [@browserbasehq/mcp](https://www.npmjs.com/package/@browserbasehq/mcp) | 6 | **85.2** | ~268 | 3 / 9 / 12 | `annotations-missing` (6) |
| [@modelcontextprotocol/server-filesystem](https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem) | 14 | **82.7** | ~1,902 | 17 / 2 / 17 | `param-undescribed` (18) |
| [firecrawl-mcp](https://www.npmjs.com/package/firecrawl-mcp) | 25 | **66.6** | ~8,206 | 22 / 127 / 47 | `param-undescribed` (127) |
| [@notionhq/notion-mcp-server](https://www.npmjs.com/package/@notionhq/notion-mcp-server) | 24 | **59.7** | ~18,494 | 30 / 115 / 33 | `confusable-tools` (110) |

Full reports, including every finding with a hint, are in [`reports/`](reports/).

## What the findings mean

- `param-undescribed` (error): an argument with no description. The model fills it in from
  the name alone.
- `confusable-tools` (error or warn): two tools whose descriptions are near-duplicates. The
  model has to guess which one you meant.
- `description-thin` (warn): a description too short to say what the tool does, what it
  returns, or when to use something else.
- `no-negative-guidance` (info): the description never says when *not* to use the tool.
- `param-unbounded-array` (info): an array argument with no item limit.
- `cache-hints-missing` (info): no `ttlMs` / `cacheScope` on the list result (2026-07-28 spec).
- `schema-open` (warn): the input schema accepts arbitrary extra properties.
- `annotations-missing` (info): no behavioural annotations (read-only, destructive, idempotent).
- `description-bloated` (warn): a description long enough to cost real context on every request.

## Servers that could not be audited without configuration

Not scored. Most of these refuse to start until given an API key, and that is worth knowing too:
a tool surface that cannot be inspected without a live account cannot be gated in CI without one
either. Pass the key through `--env` if you have one.

- `@stripe/mcp`, `@hubspot/mcp-server`, `@elastic/mcp-server-elasticsearch`, `@heroku/mcp-server`: exit at startup without a configured account.
- `@sentry/mcp-server`: requires `--access-token`.
- `@supabase/mcp-server-supabase`: requires `--access-token` or `SUPABASE_ACCESS_TOKEN`.
- `@brave/brave-search-mcp-server`: requires `BRAVE_API_KEY`.
- `figma-developer-mcp`: serves Streamable HTTP on a local port instead of stdio; audit it by URL once it is up.

## Reproduce

```bash
npx -y @echostash/cli mcp audit --command "npx -y @modelcontextprotocol/server-filesystem /tmp"
```

To gate your own server's PRs the same way, see [`actions/mcp-audit`](../../actions/mcp-audit/README.md).
