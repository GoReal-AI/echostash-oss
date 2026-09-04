import { describe, expect, it } from 'vitest'
import { calculateBlastRadius, verifyPinning } from '../src/blast-radius'
import type { McpFinding } from '@echostash/shared'

describe('calculateBlastRadius', () => {
  it('identifies changed tools and their confusable neighbors while calculating skipped tools', () => {
    const allTools = ['read_file', 'write_file', 'edit_file', 'list_dir', 'delete_file']
    const changedTools = ['write_file']

    const findings: McpFinding[] = [
      {
        check: 'confusable-pairs',
        severity: 'warn',
        tool: 'write_file',
        relatedTool: 'edit_file',
        message: '"write_file" and "edit_file" overlap in purpose',
      },
      {
        check: 'confusable-pairs',
        severity: 'warn',
        tool: 'read_file',
        relatedTool: 'list_dir',
        message: '"read_file" and "list_dir" overlap',
      },
    ]

    const scope = calculateBlastRadius(changedTools, allTools, findings)

    expect(scope.changedTools).toEqual(['write_file'])
    expect(scope.neighborTools).toEqual(['edit_file'])
    expect(scope.evalTools).toEqual(['edit_file', 'write_file'])
    expect(scope.skippedTools).toEqual(['delete_file', 'list_dir', 'read_file'])
  })
})

describe('verifyPinning', () => {
  it('returns null when selector model and protocol revision match', () => {
    const current = { selectorModel: 'claude-3-7-sonnet', protocolVersion: '2026-07-28' }
    const previous = { selectorModel: 'claude-3-7-sonnet', protocolVersion: '2026-07-28' }

    expect(verifyPinning(current, previous)).toBeNull()
  })

  it('rejects comparison when selector model changed', () => {
    const current = { selectorModel: 'gpt-5', protocolVersion: '2026-07-28' }
    const previous = { selectorModel: 'claude-3-7-sonnet', protocolVersion: '2026-07-28' }

    const err = verifyPinning(current, previous)
    expect(err).toContain('selector model changed')
    expect(err).toContain('incomparable')
  })

  it('rejects comparison when protocol revision changed', () => {
    const current = { selectorModel: 'gpt-5', protocolVersion: '2026-11-25' }
    const previous = { selectorModel: 'gpt-5', protocolVersion: '2026-07-28' }

    const err = verifyPinning(current, previous)
    expect(err).toContain('protocol revision changed')
    expect(err).toContain('incomparable')
  })
})
