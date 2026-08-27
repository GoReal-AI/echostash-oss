import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
  // Bundle the workspace deps — they export raw .ts and are not published to npm, so the
  // published CLI has to carry them inline rather than depend on them.
  noExternal: [/@echostash\//],
  // Keep real npm deps external so they install normally. @modelcontextprotocol/sdk spawns
  // child processes for stdio transport and @vscode/ripgrep ships a platform binary — neither
  // survives bundling.
  external: [
    'ai',
    /^@ai-sdk\//,
    'google-auth-library',
    'zod',
    '@vscode/ripgrep',
    /^@modelcontextprotocol\/sdk/,
  ],
})
