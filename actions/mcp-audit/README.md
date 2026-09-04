# `actions/mcp-audit` — Echostash MCP Tool Surface Audit Gate (M7)

A GitHub Action that audits your MCP server's tool surface inside CI:

1. Connects to your MCP server or reads a recorded `tools/list` JSON fixture.
2. Analyzes schema quality, token budget, and descriptive clarity.
3. Compares the score against the committed baseline (`.echostash/mcp-baseline.*.json`).
4. Fails the check if a regression exceeds the configured threshold.
5. Emits GitHub Step Summary and outputs for downstream pipeline steps.

**Zero secrets needed** for deterministic audit tier.

## Usage

```yaml
- uses: GoReal-AI/echostash-oss/actions/mcp-audit@v1
  with:
    server: 'npx -y @acme/mcp-server'   # or an https:// URL
    threshold: '0'                      # max allowed score regression
```

Or audit against a pre-recorded tools fixture:

```yaml
- uses: GoReal-AI/echostash-oss/actions/mcp-audit@v1
  with:
    from-file: 'fixtures/tools-list.json'
    threshold: '0'
```

## Inputs

| Input | Description | Default | Required |
| :--- | :--- | :--- | :--- |
| `server` | Command or URL to start/reach the MCP server | `""` | No |
| `from-file` | Path to recorded `tools/list` JSON file | `""` | No |
| `threshold` | Max allowed score regression | `'0'` | No |
| `dir` | Directory where baseline files are stored | `'.echostash'` | No |
| `github-token` | GitHub token for posting PR comments | `${{ github.token }}` | No |

## Outputs

| Output | Description |
| :--- | :--- |
| `score` | Current audit score (0–100) |
| `previous-score` | Previous baseline audit score (0–100) |
| `regressed` | Whether the score regressed beyond the threshold (`true` / `false`) |
