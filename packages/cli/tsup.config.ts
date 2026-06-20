import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
  // bundle workspace deps (they export raw .ts)…
  noExternal: [/@echostash\//],
  // …but keep heavy / dynamic-require npm deps external (resolved at runtime)
  external: ['ai', /^@ai-sdk\//, 'google-auth-library', 'zod', '@vscode/ripgrep'],
})
