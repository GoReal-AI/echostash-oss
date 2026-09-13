// Lockstep version bump: `node scripts/release/bump.mjs 0.1.1` sets every publishable package
// to that version. Commit, then tag `v0.1.1` and push the tag to release.
import { writeFileSync } from 'node:fs'
import { publishablePackages } from './publishable.mjs'

const version = process.argv[2]
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  console.error('usage: node scripts/release/bump.mjs <x.y.z>')
  process.exit(1)
}
for (const p of publishablePackages()) {
  p.manifest.version = version
  writeFileSync(p.path, `${JSON.stringify(p.manifest, null, 2)}\n`)
  console.log(`${p.manifest.name} -> ${version}`)
}
