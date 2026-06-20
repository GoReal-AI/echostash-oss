import { type ModelRole, runAgent } from '@echostash/llm'
import { type PromptLocation, makeTools } from './tools'

/** Deliberately generic — describes the *purpose*, not how to do it (we can't foresee every project). */
const OBJECTIVE = `You are scanning a code repository to find EVERY LLM prompt it contains.

A prompt is any text written to instruct or converse with a large language model — system
prompts, instruction templates, agent personas, message/role templates, rubrics, tool or skill
descriptions — wherever and however this project happens to store them: string literals in code,
dedicated template or resource files, config, anywhere.

Work in two steps:
1. Understand the project — use \`tree\` and read the manifest/build file to determine the language
   and any LLM frameworks in use.
2. Then search where prompts are likely to live FOR THIS project and find them all: use \`grep\` with
   content patterns and file globs that fit what you learned, and \`read_file\` to confirm.

For each prompt, call \`report_prompt\` with its LOCATION only — file, a short stable name (the
variable/const/field name, or the file's base name for a dedicated prompt file), kind ('file' if
the whole file is a prompt, 'inline' for a string inside code), and the line range for inline ones.
Do NOT paste the prompt text. Avoid duplicates. Be thorough but efficient; stop when you've covered
the likely locations.`

export interface DiscoverOptions {
  root: string
  spec?: string
  role?: ModelRole
  maxSteps?: number
  /** If set, examine only these files (incremental re-scan of what changed). */
  scopeFiles?: string[]
}

export async function discover(
  opts: DiscoverOptions,
): Promise<{ locations: PromptLocation[]; steps: number }> {
  const found: PromptLocation[] = []
  const tools = makeTools(opts.root, found)

  const task = opts.scopeFiles?.length
    ? `Only these files changed since the last scan — examine ONLY them (read each) and report any prompts they contain:\n${opts.scopeFiles.map((f) => `- ${f}`).join('\n')}`
    : 'Start by inspecting the structure, then find the prompts.'

  const result = await runAgent({
    role: opts.role ?? 'scan',
    spec: opts.spec,
    system: OBJECTIVE,
    prompt: `Repository root: ${opts.root}\n${task}`,
    tools,
    maxSteps: opts.maxSteps ?? 30,
  })

  const seen = new Set<string>()
  const locations = found.filter((l) => {
    const k = `${l.file}:${l.name}:${l.kind}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { locations, steps: result.steps?.length ?? 0 }
}
