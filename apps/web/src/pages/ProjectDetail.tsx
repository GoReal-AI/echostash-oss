import { Link, useParams } from 'react-router-dom'
import { getProject, promptsByProject } from '../lib/mock'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  EvalBadge,
  PageHeader,
  SampleTag,
  Section,
} from '../lib/ui'

export function ProjectDetail() {
  const { id = '' } = useParams()
  const project = getProject(id)

  if (!project) return <EmptyState title="Project not found" />

  const rows = promptsByProject(project.id)

  return (
    <div>
      <Link to="/projects" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Projects
      </Link>
      <div className="mt-3">
        <PageHeader
          title={project.name}
          subtitle={project.repo}
          actions={
            <>
              <SampleTag />
              <Button>Re-scan</Button>
            </>
          }
        />
      </div>

      <Section title="Source">
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-zinc-100">{project.repo}</span>
            <Badge tone="emerald">connected</Badge>
            <Button className="ml-auto">Re-scan</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
            <span>Default branch · {project.defaultBranch}</span>
            <span>Last scan · {project.lastScan}</span>
            <span>{project.promptCount} prompts</span>
          </div>
        </Card>
      </Section>

      <Section title="Prompts">
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Prompt</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Versions</th>
                <th className="px-4 py-3 font-medium">Eval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {rows.map((p) => (
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
                    <Badge tone="sky">
                      {p.provider}/{p.model}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{p.versions}</td>
                  <td className="px-4 py-3">
                    <EvalBadge state={p.evalState} score={p.evalScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
