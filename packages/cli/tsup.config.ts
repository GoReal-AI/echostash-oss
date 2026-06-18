import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
  // bundle workspace deps (they export raw .ts); keep npm deps (typescript) external
  noExternal: [/@echostash\//],
})
