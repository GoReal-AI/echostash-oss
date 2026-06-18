import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { projects } from './lib/mock'

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
}

const GROUPS: { heading: string; items: NavItem[] }[] = [
  { heading: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: '◈', end: true }] },
  {
    heading: 'Develop',
    items: [
      { to: '/prompts', label: 'Prompts', icon: '⌘' },
      { to: '/sandbox', label: 'Sandbox', icon: '⚡' },
      { to: '/datasets', label: 'Datasets', icon: '⊟' },
      { to: '/scorers', label: 'Scorers', icon: '✓' },
      { to: '/evals', label: 'Evals', icon: '◷' },
    ],
  },
  {
    heading: 'Operate',
    items: [
      { to: '/observability', label: 'Observability', icon: '∿' },
      { to: '/storage', label: 'Storage', icon: '⊠' },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      { to: '/projects', label: 'Projects', icon: '▤' },
      { to: '/sources', label: 'Sources', icon: '⎇' },
      { to: '/settings', label: 'Settings', icon: '⚙' },
    ],
  },
]

export function Layout() {
  const [project, setProject] = useState('all')

  return (
    <div className="flex min-h-full text-zinc-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950">
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="text-lg font-semibold tracking-tight">Echostash</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            dev
          </span>
        </div>

        <div className="px-3 pb-3">
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-600"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {GROUPS.map((g) => (
            <div key={g.heading}>
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                {g.heading}
              </div>
              {g.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-zinc-800/80 text-zinc-100'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`
                  }
                >
                  <span className="w-4 text-center text-zinc-500">{it.icon}</span>
                  {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-zinc-800/80 px-5 py-3 text-xs text-zinc-600">
          self-hosted · v0
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-zinc-950">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
