// The set of packages that go to npm, in dependency order. A package is publishable when its
// manifest has no `private: true`. Order matters for the first publish of a version: a
// package's dependencies must exist on the registry before it is published.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname

export function publishablePackages() {
  const dirs = readdirSync(join(ROOT, 'packages'))
  const pkgs = []
  for (const dir of dirs) {
    const path = join(ROOT, 'packages', dir, 'package.json')
    let manifest
    try {
      manifest = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      continue
    }
    if (manifest.private) continue
    pkgs.push({ dir: join(ROOT, 'packages', dir), path, manifest })
  }
  // Topological order over workspace dependencies (dependencies only, devDependencies are
  // bundled or not shipped).
  const byName = new Map(pkgs.map((p) => [p.manifest.name, p]))
  const ordered = []
  const seen = new Set()
  const visit = (p) => {
    if (seen.has(p.manifest.name)) return
    seen.add(p.manifest.name)
    for (const dep of Object.keys(p.manifest.dependencies ?? {})) {
      const d = byName.get(dep)
      if (d) visit(d)
    }
    ordered.push(p)
  }
  for (const p of pkgs.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))) visit(p)
  return ordered
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  for (const p of publishablePackages())
    console.log(`${p.manifest.name}@${p.manifest.version} ${p.dir}`)
}
