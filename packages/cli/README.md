# `@echostash/cli`

**Audit an MCP server's tool surface. Catch prompt regressions in CI.**

An MCP server's tool definitions *are prompts*: the `name`, `description`, and `inputSchema`
are the only things a model sees when deciding which tool to call and how to fill its
arguments. Reword a description and tool-selection accuracy moves — but the change ships
through a PR looking like a docstring edit. Code gets reviewed; prompts don't.

```bash
npx @echostash/cli mcp audit https://your-server.example.com/mcp
npx @echostash/cli mcp audit --command "npx -y @acme/mcp-server"
```

No API key, no account, no server, no database, no model calls. It reads `tools/list` — and
nothing else, so auditing is side-effect free — then analyzes it deterministically.

```
  acme-support · 2 tools
  protocol 2026-07-28

  Tool Surface Score  97.5/100     context cost ~126 tokens/request

  ! description-thin (1)
      "refund_order" has a 16-character description
      → Say what it does, what it returns, and when to use something else.
  - no-negative-guidance (1)
      "refund_order" never says when *not* to use it
      → A line like "not for X — use Y instead" is the cheapest disambiguation there is.
```

## What it checks

| Check | Why it matters |
|---|---|
| **Token budget** | The whole surface ships on *every* request. This is what it costs you. |
| **Confusable pairs** | Two tools a model can't tell apart is the #1 cause of wrong-tool calls. |
| **Schema tightness** | Open strings where an enum belongs, unbounded arrays, undescribed params. |
| **Negative guidance** | Descriptions that never say when *not* to use the tool. |
| **Name hygiene** | Generic verbs, mixed casing, near-duplicate names. |
| **Annotations** | `readOnlyHint` / `destructiveHint`, and `ttlMs` / `cacheScope` cache hints. |

## Gate it in CI

Each run writes `.echostash/mcp-baseline.<server>.json`. **Commit it**, then:

```bash
npx @echostash/cli mcp audit <target> --check    # exits 1 when the score regresses
```

| Flag | |
|---|---|
| `--check` | compare against the committed baseline; exit 1 on regression |
| `--threshold <n>` | allowed score drop before `--check` fails (default 0) |
| `--update-baseline` | accept the current state while checking |
| `--header k=v` | extra HTTP header (repeatable) |
| `--env k=v` | variable to hand a `--command` server (repeatable) |
| `--inherit-env` | forward your *entire* environment to the server (off by default — see below) |
| `--from-file <p>` | audit a recorded surface instead of connecting |
| `--json` | machine-readable output |

## Also included

`echostash scan [dir]` — find LLM prompts in your own codebase by locating the call sites they
flow into. Language-agnostic, no annotations, no SDK. See the
[main repo](https://github.com/GoReal-AI/echostash-oss).

MIT

### Environment of a spawned server

`--command` servers get a minimal environment (`PATH`, `HOME`, and the handful of variables a
process needs to start) — **not** your shell's. An audited server is usually somebody else's
code, and it must not inherit `OPENAI_API_KEY`, `NPM_TOKEN`, etc. by accident. Pass what the
server actually needs with `--env`, or opt into full inheritance with `--inherit-env` when you
trust it.
