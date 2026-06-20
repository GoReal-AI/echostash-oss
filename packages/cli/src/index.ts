export { runScan } from './commands/scan'

export const COMMANDS = ['init', 'scan', 'eval', 'ci'] as const
export type Command = (typeof COMMANDS)[number]

export const COMMAND_HELP: Record<Command, string> = {
  init: 'Onboarding: answer "where do your prompts live?" and write echostash.config (M5).',
  scan: 'Find LLM call sites in your code and report prompts + models to the server (M2).',
  eval: 'Run an eval locally via the runner against your own keys (M4).',
  ci: 'Scan changed prompts, eval them with the project keys, post results, set the PR check (M5).',
}
