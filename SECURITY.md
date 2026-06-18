# Security Policy

Echostash is early-stage software. We take security seriously and appreciate responsible
disclosure.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use GitHub's private
[**Report a vulnerability**](https://github.com/GoReal-AI/echostash-oss/security/advisories/new)
flow, or email **yoad.elkayam@gmail.com**.

We'll acknowledge within a few business days and keep you updated on the fix.

## Scope notes

- Echostash never stores your prompts as a source of truth and, by design, **does not handle
  your production LLM traffic**.
- Provider API keys live server-side (or in the runner's CI environment) and are never sent
  to the browser or stored in the prompt registry.
