import { COMMANDS, COMMAND_HELP, type Command } from './index'

function printHelp(): void {
  console.log('echostash <command>\n')
  console.log('Commands:')
  for (const cmd of COMMANDS) {
    console.log(`  ${cmd.padEnd(6)}  ${COMMAND_HELP[cmd]}`)
  }
}

function main(argv: string[]): number {
  const [command] = argv
  if (!command || command === '--help' || command === '-h') {
    printHelp()
    return 0
  }
  if (!COMMANDS.includes(command as Command)) {
    console.error(`Unknown command: ${command}\n`)
    printHelp()
    return 1
  }
  console.log(`"${command}" is not implemented yet — ${COMMAND_HELP[command as Command]}`)
  return 0
}

process.exit(main(process.argv.slice(2)))
