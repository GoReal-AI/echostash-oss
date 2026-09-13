// Refuse to release when the tag and the package versions disagree, or when the publishable
// packages are not in lockstep. `node scripts/release/check-versions.mjs v0.1.1`
import { publishablePackages } from './publishable.mjs'

const tag = process.argv[2] ?? ''
const expected = tag.replace(/^v/, '')
const pkgs = publishablePackages()
const versions = new Set(pkgs.map((p) => p.manifest.version))
if (versions.size !== 1) {
  console.error(`publishable packages are not in lockstep: ${[...versions].join(', ')}`)
  process.exit(1)
}
const [actual] = versions
if (expected && actual !== expected) {
  console.error(`tag ${tag} implies ${expected} but the packages are at ${actual}`)
  process.exit(1)
}
console.log(`${pkgs.length} packages at ${actual}: ${pkgs.map((p) => p.manifest.name).join(', ')}`)
