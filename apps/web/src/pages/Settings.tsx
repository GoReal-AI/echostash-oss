import { useState } from 'react'
import { apiKeys, providers } from '../lib/mock'
import { Badge, Button, Card, CodeBlock, Modal, PageHeader, Tabs } from '../lib/ui'

const members = [
  { id: 'm1', name: 'Dana Reyes', email: 'dana@acme.com', role: 'Owner' },
  { id: 'm2', name: 'Yoad Elkayam', email: 'yoad@acme.com', role: 'Member' },
]

export function Settings() {
  const [tab, setTab] = useState('providers')
  const [keyModal, setKeyModal] = useState(false)

  return (
    <div>
      <PageHeader title="Settings" />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'providers', label: 'Providers' },
          { key: 'keys', label: 'API keys' },
          { key: 'members', label: 'Members' },
        ]}
      />

      {tab === 'providers' && (
        <div className="space-y-4">
          <Card className="divide-y divide-zinc-800/70">
            {providers.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-zinc-100">{p.name}</div>
                  <div className="font-mono text-xs text-zinc-500">
                    {p.models.length > 0 ? p.models.join(', ') : 'no models'}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {p.configured ? (
                    <Badge tone="emerald">configured</Badge>
                  ) : (
                    <>
                      <Badge tone="zinc">not set</Badge>
                      <Button>Add key</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </Card>
          <p className="text-xs text-zinc-500">
            Central provider keys are used for interactive Sandbox runs. CI runs use the project's
            own keys.
          </p>
        </div>
      )}

      {tab === 'keys' && (
        <div>
          <div className="mb-3 flex justify-end">
            <Button variant="primary" onClick={() => setKeyModal(true)}>
              Create key
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Prefix</th>
                  <th className="px-4 py-3 font-medium">Last used</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {apiKeys.map((k) => (
                  <tr key={k.id} className="transition-colors hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-medium text-zinc-100">{k.name}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400">{k.prefix}…</td>
                    <td className="px-4 py-3 text-zinc-500">{k.lastUsed}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost">Revoke</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Modal open={keyModal} onClose={() => setKeyModal(false)} title="API key created">
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Copy it now — this key is shown once and can't be retrieved later.
              </p>
              <CodeBlock>pf_live_8fa3c12d9b7e44a1f6028de3b51c9a72</CodeBlock>
              <div className="flex justify-end">
                <Button variant="primary" onClick={() => setKeyModal(false)}>
                  Done
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {tab === 'members' && (
        <div>
          <div className="mb-3 flex justify-end">
            <Button variant="primary">Invite</Button>
          </div>
          <Card className="divide-y divide-zinc-800/70">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-zinc-100">{m.name}</div>
                  <div className="text-xs text-zinc-500">{m.email}</div>
                </div>
                <span className="ml-auto">
                  <Badge tone={m.role === 'Owner' ? 'violet' : 'zinc'}>{m.role}</Badge>
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}
