import type { McpToolSurface } from '@echostash/shared'

export interface McpEvalCase {
  id: string
  query: string
  expectedTool: string | null
  source: 'generated' | 'manual'
}

export interface McpCasesFile {
  version: 1
  serverId: string
  comment: string
  cases: McpEvalCase[]
}

/**
 * Builds the LLM generation prompt for synthetic eval cases.
 * HELD-OUT INVARIANT: The description is intentionally withheld so generated
 * queries cannot parrot the description's vocabulary.
 */
export function buildHeldOutGenPrompt(tools: McpToolSurface['tools']): string {
  const toolSignatures = tools.map((t) => ({
    name: t.name,
    inputSchema: t.inputSchema ?? {},
  }))

  return [
    'You are an evaluation case generator for Model Context Protocol (MCP) tools.',
    'Given the following tool names and input schemas (descriptions intentionally omitted):',
    JSON.stringify(toolSignatures, null, 2),
    '',
    'Generate realistic, natural-language user queries that should trigger each tool, plus negative queries where NO tool should be selected.',
    'Rules:',
    '1. Generate 2 positive queries for each tool.',
    '2. Generate 2 negative queries where no tool should fire (expectedTool = null).',
    '3. Do not parrot specific technical parameter names verbatim; use natural user phrasing.',
    '4. Output ONLY a valid JSON array of objects with fields: "id", "query", "expectedTool" (tool name or null).',
  ].join('\n')
}

export type CompleteFn = (prompt: string) => Promise<string>

/**
 * Generate synthetic evaluation cases for an MCP tool surface with held-out descriptions.
 */
export async function generateCasesForSurface(
  surface: McpToolSurface,
  complete?: CompleteFn,
): Promise<McpCasesFile> {
  const comment =
    'Generated evaluation cases (held-out descriptions). Review and refine expected tools before gating.'

  if (!complete) {
    // Deterministic fallback / template generator when no LLM is configured
    const cases: McpEvalCase[] = []
    let idx = 1
    for (const tool of surface.tools) {
      cases.push({
        id: `case_${idx++}`,
        query: `Execute operation for ${tool.name}`,
        expectedTool: tool.name,
        source: 'generated',
      })
    }
    cases.push({
      id: `case_${idx++}`,
      query: 'What is the capital of France?',
      expectedTool: null,
      source: 'generated',
    })
    return {
      version: 1,
      serverId: surface.serverId,
      comment,
      cases,
    }
  }

  const prompt = buildHeldOutGenPrompt(surface.tools)
  const raw = await complete(prompt)
  let parsedCases: Array<{ id?: string; query: string; expectedTool: string | null }> = []

  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      parsedCases = JSON.parse(jsonMatch[0])
    } else {
      parsedCases = JSON.parse(raw)
    }
  } catch {
    parsedCases = []
  }

  const cases: McpEvalCase[] = parsedCases.map((c, i) => ({
    id: c.id ?? `gen_case_${i + 1}`,
    query: c.query,
    expectedTool: c.expectedTool,
    source: 'generated',
  }))

  return {
    version: 1,
    serverId: surface.serverId,
    comment,
    cases,
  }
}
