// npm (unlike pnpm) does not rewrite `workspace:*` on publish. Run this right before
// `npm publish` to pin every workspace dependency of a publishable package to the version
// that is being released. Never commit the result; CI runs it on a throwaway checkout.
import { writeFileSync } from 'node:fs'
import { publishablePackages } from './publishable.mjs'

const pkgs = publishablePackages()
const versions = new Map(pkgs.map((p) => [p.manifest.name, p.manifest.version]))

for (const p of pkgs) {
  let changed = false
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, range] of Object.entries(p.manifest[field] ?? {})) {
      if (!String(range).startsWith('workspace:')) continue
      const version = versions.get(name)
      if (!version) {
        console.error(`${p.manifest.name} depends on ${name}, which is not publishable`)
        process.exit(1)
      }
      p.manifest[field][name] = `^${version}`
      changed = true
    }
  }
  if (changed) {
    writeFileSync(p.path, `${JSON.stringify(p.manifest, null, 2)}\n`)
    console.log(`pinned workspace deps in ${p.manifest.name}`)
  }
}
