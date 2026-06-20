import { createAgent } from './framework'

const SYSTEM_PROMPT = `You are Sample Agent. Always answer in JSON. Never apologize.`

export function build() {
  return createAgent({
    systemPrompt: SYSTEM_PROMPT,
    tools: [],
  })
}
