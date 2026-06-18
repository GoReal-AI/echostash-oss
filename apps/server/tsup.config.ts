import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/db/migrate.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  // bundle the workspace deps (they export raw .ts), keep node_modules external
  noExternal: [/@echostash\//],
})
