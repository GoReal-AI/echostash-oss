// Build the system prompt from parts before sending it to the model.

export const toolSchema = {
  systemPrompt: { type: 'string', description: 'A detailed system prompt describing agent behavior.' },
}

export function logError(e: unknown) {
  console.error('Failed to load prompt:', e)
}

const sql = 'SELECT * FROM prompts WHERE project_id = ? ORDER BY created_at DESC'
export { sql }
