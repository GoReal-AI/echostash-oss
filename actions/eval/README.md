# `actions/eval` — Echostash CI eval gate (M5)

A GitHub Action that runs the Echostash **eval gate** inside your CI:

1. Scans the PR diff for changed prompts.
2. For each, fetches its dataset + scorers + baseline from your Echostash server.
3. Runs the eval via `@echostash/runner` using **your** provider keys (CI secrets).
4. Posts results to the server and fails the check on a regression.

This is a stub. Implementation tracked in [docs/ROADMAP.md](../../docs/ROADMAP.md#m5--ci-gate--github-app).

Planned usage:

```yaml
# .github/workflows/echostash.yml in a CONSUMER repo
- uses: echostash/echostash/actions/eval@v1
  with:
    server-url: ${{ secrets.ECHOSTASH_URL }}
    api-key: ${{ secrets.ECHOSTASH_API_KEY }}
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```
