import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchPrompts } from '../lib/api'
import { Badge, ResolutionBadge, relativeTime } from '../lib/ui'

export function Registry() {
  const { data, isLoading, error } = useQuery({ queryKey: ['prompts'], queryFn: fetchPrompts })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every prompt discovered in your code, with the model it runs on. A scan updates this.
        </p>
      </div>

      {isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Failed to load: {String(error)}</p>}

      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center">
          <p className="text-zinc-300">No prompts yet.</p>
          <p className="mt-2 text-sm text-zinc-500">Point a scan at a repo:</p>
          <code className="mt-3 inline-block rounded bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
            echostash scan /path/to/your/project --source myproject
          </code>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Prompt</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Resolution</th>
                <th className="px-4 py-3 font-medium">Versions</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {data.map((p) => (
                <tr key={p.id} className="group transition-colors hover:bg-zinc-900/40">
                  <td className="px-4 py-3">
                    <Link to={`/prompts/${p.id}`} className="block">
                      <div className="font-medium text-zinc-100 group-hover:text-white">
                        {p.name}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">{p.fingerprint}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {p.model ? (
                      <Badge tone="sky">
                        {p.provider ? `${p.provider}/` : ''}
                        {p.model}
                      </Badge>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ResolutionBadge resolution={p.resolution} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{p.snapshotCount}</td>
                  <td className="px-4 py-3 text-zinc-500">{relativeTime(p.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
