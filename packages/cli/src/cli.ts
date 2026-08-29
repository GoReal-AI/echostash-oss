import { runInit } from './commands/init'
import { runMcp } from './commands/mcp'
import { runScan } from './commands/scan'
import { COMMANDS, COMMAND_HELP, type Command } from './index'

function printHelp(): void {
  console.log('echostash <command> [options]\n')
  console.log('Commands:')
  for (const cmd of COMMANDS) {
    console.log(`  ${cmd.padEnd(6)}  ${COMMAND_HELP[cmd]}`)
  }
  console.log('\nscan [dir] options:')
  console.log(
    '  (default)        fast deterministic scan — finds prompts that flow into LLM calls, then',
  )
  console.log(
    '                   dedicated prompt files + strong prompt strings; language-agnostic',
  )
  console.log(
    '  --scan-model <p:m>  optional model that augments the scan with custom-wrapper detection,',
  )
  console.log('                   e.g. vertex:gemini-2.5-flash (env ECHOSTASH_SCAN_MODEL)')
  console.log('  --track          diff against the stored manifest (.echostash/) + print changes')
  console.log('  --source <name>  source name (default: directory name)')
  console.log('  --server <url>   control-plane URL (env ECHOSTASH_URL)')
  console.log('  --api-key <key>  API key (env ECHOSTASH_API_KEY)')
  console.log('  --dry-run        analyze and print; do not post')
  console.log('\nmcp audit <url | --command "npx -y @acme/server"> options:')
  console.log('  (default)        read tools/list, analyze the tool surface, write a baseline')
  console.log('                   — no API key, no server, no model calls')
  console.log('  --check          compare against the committed baseline; exit 1 on regression')
  console.log('  --threshold <n>  allowed score drop before --check fails (default 0)')
  console.log('  --update-baseline  accept the current state while checking')
  console.log('  --header k=v     extra HTTP header (repeatable)')
  console.log('  --from-file <p>  audit a recorded tool surface instead of connecting')
  console.log('  --dir <path>     where baselines live (default .echostash)')
  console.log('  --json           machine-readable output')
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === '-h') {
    printHelp()
    return 0
  }
  if (!COMMANDS.includes(command as Command)) {
    console.error(`Unknown command: ${command}\n`)
    printHelp()
    return 1
  }
  if (command === 'init') return runInit(rest)
  if (command === 'scan') return runScan(rest)
  if (command === 'mcp') return runMcp(rest)
  console.log(`"${command}" is not implemented yet — ${COMMAND_HELP[command as Command]}`)
  return 0
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
