import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getProject, prompts } from '../lib/mock'
import { projects } from '../lib/mock'
import {
  Badge,
  Button,
  EvalBadge,
  PageHeader,
  ResolutionBadge,
  SampleTag,
  Select,
  TextInput,
} from '../lib/ui'

export function Prompts() {
  const [project, setProject] = useState('all')
  const [q, setQ] = useState('')

  const rows = prompts.filter(
    (p) =>
      (project === 'all' || p.projectId === project) &&
      (q === '' || p.name.toLowerCase().includes(q.toLowerCase()) || p.fingerprint.includes(q)),
  )

  return (
    <div>
      <PageHeader
        title="Prompts"
        subtitle="Every prompt discovered in your code, across all projects."
        actions={<Button variant="primary">Scan a repo</Button>}
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="w-48">
          <Select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-64">
          <TextInput
            placeholder="Search prompts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="ml-auto">
          <SampleTag />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Prompt</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Res.</th>
              <th className="px-4 py-3 font-medium">Versions</th>
              <th className="px-4 py-3 font-medium">Eval</th>
              <th className="px-4 py-3 font-medium">7d calls</th>
              <th className="px-4 py-3 font-medium">Changed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((p) => (
              <tr key={p.id} className="group transition-colors hover:bg-zinc-900/40">
                <td className="px-4 py-3">
                  <Link to={`/prompts/${p.id}`} className="block">
                    <div className="font-medium text-zinc-100 group-hover:text-white">{p.name}</div>
                    <div className="font-mono text-xs text-zinc-500">{p.fingerprint}</div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400">{getProject(p.projectId)?.name}</td>
                <td className="px-4 py-3">
                  <Badge tone="sky">
                    {p.provider}/{p.model}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <ResolutionBadge resolution={p.resolution} />
                </td>
                <td className="px-4 py-3 text-zinc-400">{p.versions}</td>
                <td className="px-4 py-3">
                  <EvalBadge state={p.evalState} score={p.evalScore} />
                </td>
                <td className="px-4 py-3 text-zinc-400">{p.calls7d.toLocaleString()}</td>
                <td className="px-4 py-3 text-zinc-500">{p.lastChanged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
