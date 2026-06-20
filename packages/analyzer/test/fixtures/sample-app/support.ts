// @ts-nocheck — fixture: parsed by the analyzer, not compiled.

// A prompt with NO telltale variable name → "gray zone": deterministic gather
// flags it as a candidate, but only the LLM classifier decides it's a prompt.
export const helper =
  'You are a helpful support agent for an e-commerce store. Always be concise, ' +
  'empathetic, and answer the customer question about their order directly.'

// Not a prompt: long-ish but no content markers and a non-prompt name → ignored.
export const sqlQuery = 'SELECT id, name, total FROM orders WHERE status = $1 ORDER BY created_at DESC'
