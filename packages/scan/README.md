# @echostash/scan

The manifest layer under Echostash: a discovery-agnostic record of prompts (content, model,
params) with stable hashes, plus diffing between two manifests and baseline stores.

A manifest does not care where prompts came from. Code scanning, an MCP server's `tools/list`,
or a hand-written file all produce the same shape, so the same diff and baseline logic gates
all of them.

```ts
import { diffManifests } from '@echostash/scan'

const changes = diffManifests(previous, current)
// changes: [{ name, relPath, status: 'new' | 'modified' | 'deleted' | 'unchanged', promptHash }]
// summary: { new, modified, deleted, unchanged }
```

Part of [Echostash](https://github.com/GoReal-AI/echostash-oss): agentless prompt change
intelligence and eval. MIT.
