# Demo: catching a wrong-tool-call before it happens

A model doesn't see your code. When it decides which tool to call, the entire prompt it gets is
each tool's `name`, `description`, and `inputSchema`. If two tools describe near-duplicate jobs,
the model is guessing between them on every ambiguous request — and guesses are wrong some
fraction of the time. That's a wrong tool call, and it happens before any eval of model output
could catch it: the tool surface itself is where the risk was introduced.

`echostash mcp audit` finds this deterministically, offline, with no API key and no model call —
it's a structural similarity check on the tool surface, not a judgment of any specific model
run. This demo is a minimal, self-contained "before/after" to show what it catches and how fixing
it looks.

## The setup

A toy support-desk MCP server with 4 tools. [`before/tools.json`](before/tools.json) has a classic
mistake: `get_ticket` and `fetch_ticket` do the exact same thing, worded almost identically.
`close_ticket` and `send_customer_email` are unambiguous distractors — the check should leave them
alone.

```json
{ "name": "get_ticket",   "description": "Get a support ticket by its ticket identifier. Gets the ticket fields for that identifier." }
{ "name": "fetch_ticket", "description": "Fetch a support ticket by its ticket identifier. Fetches the ticket fields for that identifier." }
```

## Before: the audit catches it

```bash
echostash mcp audit --from-file before/tools.json
```

```
  support-desk-demo · 4 tools
  protocol 2026-07-28

  Tool Surface Score  96.3/100     context cost ~319 tokens/request
  heaviest: send_customer_email ~101, close_ticket ~89, fetch_ticket ~65

  0 error  2 warn  7 info

  ! annotations-missing (4)
      "send_customer_email" declares neither readOnlyHint nor destructiveHint
      "close_ticket" declares neither readOnlyHint nor destructiveHint
      "fetch_ticket" declares neither readOnlyHint nor destructiveHint
      "get_ticket" declares neither readOnlyHint nor destructiveHint
      → This one reads as mutating — clients need the hint to gate it behind confirmation.

  ! confusable-tools (1)
      "get_ticket" and "fetch_ticket" have 65% similar descriptions
      → State what each one is for and, explicitly, when to use the other instead.

  - no-negative-guidance (4)
      "close_ticket" never says when *not* to use it
      "fetch_ticket" never says when *not* to use it
      "get_ticket" never says when *not* to use it
      "send_customer_email" never says when *not* to use it
      → A line like "not for X — use Y instead" is the cheapest disambiguation there is.
```

`confusable-tools` is the one that matters here: the description-similarity score (0.65) is above
the check's threshold (`≥ 0.55` warn, `≥ 0.75` error — see
[`checks/confusable.ts`](../../packages/analyzer/src/checks/confusable.ts)). Everything else in
this output (`annotations-missing`, `no-negative-guidance`) is real but unrelated noise from the
same fixture — notice it doesn't move between before and after below.

## After: give them distinct jobs, not just distinct wording

Rewording alone (e.g. leaving both as "get"/"fetch" a ticket by ID) doesn't fix a wrong-tool-call
risk — two tools that genuinely do the same thing are still redundant no matter how you phrase it.
[`after/tools.json`](after/tools.json) fixes it properly: `fetch_ticket` becomes `search_tickets`,
a tool with an actually different job (find a ticket by customer/status/keyword when you *don't*
have an ID) and a different input shape, with each description pointing at the other for the case
it doesn't cover.

```json
{ "name": "get_ticket",     "description": "Retrieve one support ticket when the caller already has its ticket ID. If the ID isn't known, call search_tickets first." }
{ "name": "search_tickets", "description": "Look up support tickets by customer email, status, or keyword when the exact ticket ID is unknown. Once you have an ID, switch to get_ticket for the full record." }
```

```bash
echostash mcp audit --from-file after/tools.json
```

```
  support-desk-demo · 4 tools
  protocol 2026-07-28

  Tool Surface Score  97.3/100     context cost ~374 tokens/request
  heaviest: search_tickets ~113, send_customer_email ~101, close_ticket ~89

  0 error  1 warn  7 info

  ! annotations-missing (4)
      "send_customer_email" declares neither readOnlyHint nor destructiveHint
      "close_ticket" declares neither readOnlyHint nor destructiveHint
      "get_ticket" declares neither readOnlyHint nor destructiveHint
      "search_tickets" declares neither readOnlyHint nor destructiveHint
      → This one reads as mutating — clients need the hint to gate it behind confirmation.

  - no-negative-guidance (4)
      "close_ticket" never says when *not* to use it
      "get_ticket" never says when *not* to use it
      "search_tickets" never says when *not* to use it
      "send_customer_email" never says when *not* to use it
      → A line like "not for X — use Y instead" is the cheapest disambiguation there is.
```

`confusable-tools` is gone — `0 error 1 warn` instead of `0 error 2 warn` — and nothing else in the
report changed. That's the check isolating exactly the one risk that was fixed.

## Gating it: a regression is a CI failure, not a surprise in prod

Record a baseline from the good ("after") surface, the way you'd commit one for your own server,
then audit a change against it with `--check`:

```bash
echostash mcp audit --from-file after/tools.json                # record the baseline
echostash mcp audit --from-file before/tools.json --check       # simulate reintroducing the bug
```

```
  Changed tools
      fetch_ticket added
      get_ticket description changed
      search_tickets removed

  Score 97.3 → 96.3  ▼ -1  (threshold 0)

  FAIL — the tool surface regressed past the threshold.
```

Exit code `1`. In CI, that's [`actions/mcp-audit`](../../actions/mcp-audit/README.md) failing the
PR that reintroduced the confusable pair — before it ever reaches a model, let alone a user.

## Why this isn't circular

The check never asks a model anything — it's a structural similarity score on `name` and
`description` text, the same two features a model actually conditions on to pick a tool. That's
also its honest limit: it flags *risk* (two tools a model is likely to conflate), not a confirmed
wrong call from a real run. Closing that last gap — actually measuring selection accuracy across a
held-out set of queries, with the confusable pairs above feeding the "blast radius" so a fix to one
tool's description gets re-checked against its neighbors — is tracked separately in
[#93](https://github.com/GoReal-AI/echostash-oss/issues/93) (phase 3).
