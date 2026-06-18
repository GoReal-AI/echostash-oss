# Echostash Wiki — Home

> **One-time setup:** GitHub creates the wiki's git repo only after the first page is made
> in the UI. Go to the repo's **Wiki** tab → **Create the first page**, paste this content,
> and save. After that the wiki is editable via git (`*.wiki.git`). This file is the source.

---

**Agentless prompt change intelligence + eval.** Echostash watches the prompts in your
codebase, flags when one changes (content, model, *or* params), and lets you eval &
regression-test them with zero setup. Not a prompt CMS, not a runtime tracer — complementary
to Langfuse.

## Start here
- [README](https://github.com/GoReal-AI/echostash-oss/blob/main/README.md) — what, why, quickstart
- [Architecture](https://github.com/GoReal-AI/echostash-oss/blob/main/docs/ARCHITECTURE.md) — the two key ideas, data model, control/data plane
- [Roadmap (M2–M6)](https://github.com/GoReal-AI/echostash-oss/blob/main/docs/ROADMAP.md) — what to build next
- [Contributing](https://github.com/GoReal-AI/echostash-oss/blob/main/CONTRIBUTING.md) — setup + conventions

## Contributing in 60 seconds
1. `pnpm install && cp env.example .env && docker compose up -d postgres redis`
2. `pnpm --filter @echostash/server dev` → http://localhost:8080/healthz
3. Grab a [good first issue](https://github.com/GoReal-AI/echostash-oss/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22), branch, and open a PR.

## Status
M0 (skeleton) + M1 (schemas + DB + server) are done. M2–M6 are open — see the
[milestones](https://github.com/GoReal-AI/echostash-oss/milestones).
