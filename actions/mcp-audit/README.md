# Echostash MCP Audit Gate

A GitHub Action that fails your PR when a change to an MCP server's tool surface makes it
harder for a model to use. Deterministic: **no API key, no model calls, no infrastructure.**

An MCP server's tool definitions are prompts. The `name`, `description` and `inputSchema` are the
only things a model sees when it decides which tool to call and how to fill the arguments, and
they ship through PRs looking like docstring edits. This action reads `tools/list`, scores the
surface, compares it with the baseline committed in your repo, and posts the per-tool diff on
the PR.

## Usage

Record a baseline once, locally, and commit it:

```bash
npx -y @echostash/cli mcp audit --command "npx -y @acme/mcp-server"
git add .echostash && git commit -m "chore: record MCP tool surface baseline"
```

Then gate every PR:

```yaml
name: MCP audit
on: pull_request
permissions:
  contents: read
  pull-requests: write   # only needed for the PR comment
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: GoReal-AI/echostash-oss/actions/mcp-audit@main
        with:
          server: 'npx -y @acme/mcp-server'   # or an http(s):// URL
```

Or audit a recorded `tools/list` payload instead of a live server:

```yaml
      - uses: GoReal-AI/echostash-oss/actions/mcp-audit@main
        with:
          from-file: 'fixtures/tools-list.json'
```

When a drop is intentional, re-record the baseline in the same PR and the gate goes green again.

## Inputs

| Input | Description | Default |
| :--- | :--- | :--- |
| `server` | MCP server to audit: an `http(s)://` URL, or a command to spawn | |
| `from-file` | Path to a recorded `tools/list` payload (JSON). Alternative to `server` | |
| `threshold` | How many score points the surface may drop before the gate fails | `0` |
| `dir` | Directory holding the committed baseline files | `.echostash` |
| `comment` | Post (and keep updated) a PR comment with the score delta and per-tool diff | `true` |
| `github-token` | Token used to post the PR comment | `${{ github.token }}` |
| `cli` | Command that runs the Echostash CLI. Pinned so a CLI release cannot change a verdict without a PR | `npx -y @echostash/cli@0.1.0` |

One of `server` or `from-file` is required.

## Outputs

| Output | Description |
| :--- | :--- |
| `score` | Tool Surface Score of the audited surface (0-100) |
| `previous-score` | Score recorded in the committed baseline (0-100) |
| `delta` | `score` minus `previous-score` |
| `regressed` | `true` when the score dropped past the threshold |

## Behaviour

- **Fails closed.** A missing or corrupt baseline, an unreachable server, or a CLI error fails
  the step with the CLI's own message. Only a well-formed check result can pass.
- **One comment per server.** The PR comment is upserted, so re-runs update it instead of
  stacking. Posting is best effort: a fork PR's read-only token logs a warning and does not
  change the verdict.
- **Spawned servers get a minimal environment.** Pass `--env k=v` through `server` if the
  server needs configuration; the CLI never forwards the runner's full `process.env`.

## Verification

[`.github/workflows/mcp-audit-action.yml`](../../.github/workflows/mcp-audit-action.yml) runs
this action against the fixtures in [`test/fixtures`](test/fixtures) on every change to the
action or the CLI: the unchanged surface must pass, the regressed one must fail with
`regressed=true`, and a run with no baseline must fail rather than pass.
