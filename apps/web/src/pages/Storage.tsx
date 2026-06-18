import { Badge, Button, Card, EmptyState, PageHeader } from '../lib/ui'

export function Storage() {
  return (
    <div>
      <PageHeader
        title="Storage"
        subtitle="Optional managed prompts. Echostash normally watches prompts in your code — managed storage is an opt-in for prompts you'd rather edit here (e.g. non-engineers)."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="zinc">opt-in · post-v1</Badge>
            <Button variant="primary">New managed prompt</Button>
          </div>
        }
      />

      <Card className="mb-6 p-4 text-sm leading-relaxed text-zinc-400">
        By default Echostash is code-first: prompts live in your repo and the scanner tracks every
        change. Managed storage flips that for select prompts — Echostash serves the prompt content
        to the SDK by id, so edits no longer require a code change or a deploy. Reach for it when a
        prompt needs to be edited by non-engineers or iterated on without shipping.
      </Card>

      <EmptyState
        title="No managed prompts yet"
        hint="Create one to manage a prompt's content in Echostash instead of in code."
      >
        <Button variant="primary">+ New managed prompt</Button>
      </EmptyState>
    </div>
  )
}
