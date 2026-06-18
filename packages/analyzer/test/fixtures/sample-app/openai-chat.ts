// @ts-nocheck — fixture: parsed by the analyzer, not compiled.
import OpenAI from 'openai'

const client = new OpenAI()

export async function summarize(input: string) {
  return client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    max_tokens: 500,
    messages: [
      { role: 'system', content: 'You are a terse summarizer.' },
      { role: 'user', content: 'Summarize the following text.' },
    ],
  })
}
