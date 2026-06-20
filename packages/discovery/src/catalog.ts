import type { Provider } from '@echostash/shared'

/**
 * Known LLM-invocation call shapes. Each entry's `patterns` are ripgrep regexes that locate a call
 * site; once located we read the call's argument window and resolve the prompt/model deterministically
 * (see resolve.ts). This is the "how is the LLM called" prior — augmentable per-project by the LLM.
 */
export interface CallShape {
  id: string
  provider: Provider | null
  /** ripgrep regexes (extended) that match where the call is made. */
  patterns: string[]
  /**
   * 'sdk' = a known provider/framework call (trusted, any message kept). 'structural' = an anchor on
   * a prompt-bearing key itself (framework-agnostic; scalar strings need a minimum length to count).
   */
  kind?: 'sdk' | 'structural'
  /** Where the prompt sits in the call: a positional arg index, or a named key. From the LLM augment. */
  promptArg?: number | string
}

/**
 * Framework-agnostic anchor: prompt-bearing keys are unmistakable LLM structures wherever they
 * appear (any agent framework, any custom wrapper). We resolve their value like any other call arg.
 */
export const STRUCTURAL: CallShape = {
  id: 'structural',
  provider: null,
  kind: 'structural',
  patterns: [
    '\\b(systemPrompt|system_prompt|systemInstruction|system_instruction|userPrompt|user_prompt)\\s*[:=]\\s*["\'`A-Za-z_$]',
    '\\binstructions\\s*[:=]\\s*["\'`]',
    '\\bmessages\\s*[:=]\\s*\\[',
    '\\b(system|developer)\\s*[:=]\\s*["\'`]',
  ],
}

export const CATALOG: CallShape[] = [
  {
    id: 'openai',
    provider: 'openai',
    patterns: [
      '\\.chat\\.completions\\.create\\s*\\(',
      '\\.responses\\.create\\s*\\(',
      '\\bopenai\\.ChatCompletion\\.create\\s*\\(',
      '\\.beta\\.chat\\.completions\\.parse\\s*\\(',
    ],
  },
  {
    id: 'anthropic',
    provider: 'anthropic',
    patterns: ['\\.messages\\.create\\s*\\(', '\\.messages\\.stream\\s*\\('],
  },
  {
    id: 'vercel-ai',
    provider: null,
    patterns: ['\\b(generateText|streamText|generateObject|streamObject)\\s*\\('],
  },
  {
    id: 'google-gemini',
    provider: 'google',
    patterns: [
      '\\.generateContent\\s*\\(',
      '\\.generateContentStream\\s*\\(',
      '\\.generate_content\\s*\\(',
      '\\.getGenerativeModel\\s*\\(',
    ],
  },
  {
    id: 'litellm',
    provider: 'litellm',
    patterns: ['\\b(litellm\\.)?a?completion\\s*\\(', '\\.acompletion\\s*\\('],
  },
  {
    id: 'langchain',
    provider: null,
    patterns: [
      '\\b(ChatOpenAI|ChatAnthropic|ChatVertexAI|ChatGoogleGenerativeAI|ChatBedrock)\\s*\\(',
      '(ChatPromptTemplate|PromptTemplate)\\.(from_messages|fromMessages|from_template|fromTemplate)\\s*\\(',
    ],
  },
  {
    id: 'spring-ai',
    provider: null,
    patterns: [
      '\\bChatClient\\b',
      'new\\s+PromptTemplate\\s*\\(',
      'new\\s+SystemPromptTemplate\\s*\\(',
      '\\.defaultSystem\\s*\\(',
    ],
  },
]

/**
 * Keys/kwargs that carry prompt content at a call site, with the chat role each implies.
 * `array` keys hold a list of `{role, content}` messages we parse element-by-element.
 */
export const PROMPT_KEYS: Record<string, 'system' | 'user' | 'assistant' | 'array'> = {
  messages: 'array',
  contents: 'array',
  system: 'system',
  systemPrompt: 'system',
  system_prompt: 'system',
  systemInstruction: 'system',
  system_instruction: 'system',
  instructions: 'system',
  developer: 'system',
  user: 'user',
  userPrompt: 'user',
  user_prompt: 'user',
  prompt: 'user',
  input: 'user',
  query: 'user',
  question: 'user',
}

/** Infer the provider from a model identifier when the call shape itself is provider-agnostic. */
export function providerFromModel(model: string | null): Provider | null {
  if (!model) return null
  const m = model.toLowerCase()
  if (m.includes('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.includes('davinci'))
    return 'openai'
  if (m.includes('claude')) return 'anthropic'
  if (m.includes('gemini') || m.includes('palm') || m.includes('bison')) return 'google'
  return null
}
