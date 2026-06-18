// @ts-nocheck — fixture: parsed by the analyzer, not compiled.
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

const SYSTEM = 'You are a helpful assistant.'

export async function reply(name: string) {
  return generateText({
    model: openai('gpt-4o-mini'),
    temperature: 0.7,
    system: SYSTEM,
    prompt: `Greet ${name} warmly.`,
  })
}
