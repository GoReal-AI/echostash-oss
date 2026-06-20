import OpenAI from 'openai'

const openai = new OpenAI()

export async function summarize(text: string) {
  return openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You are a concise summarizer. Reply with one sentence only.' },
      { role: 'user', content: text },
    ],
  })
}
