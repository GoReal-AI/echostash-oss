import { describe, expect, it } from 'vitest'
import { parseFlags, readBaseline, baselinePath } from '../src/commands/mcp'
import { splitArgs } from '@echostash/mcp'
import { checkSchema } from '@echostash/analyzer'
import { join } from 'node:path'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

describe('mcp CLI flags parsing', () => {
  it('parses valid numeric threshold', () => {
    const flags = parseFlags(['--threshold', '5', '--check'])
    expect(flags.threshold).toBe(5)
    expect(flags.check).toBe(true)
  })

  it('throws on non-numeric threshold', () => {
    expect(() => parseFlags(['--threshold', 'abc'])).toThrow(/expected a non-negative number/)
  })

  it('throws on negative threshold', () => {
    expect(() => parseFlags(['--threshold', '-1'])).toThrow(/expected a non-negative number/)
  })
})

describe('readBaseline error handling', () => {
  it('returns null when baseline file does not exist', () => {
    const res = readBaseline('/non/existent/path/baseline.json')
    expect(res.baseline).toBeNull()
    expect(res.error).toBeUndefined()
  })

  it('surfaces clear error on corrupt baseline JSON', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'echostash-test-'))
    const file = join(tmp, 'corrupt.json')
    try {
      writeFileSync(file, 'not valid json')
      const res = readBaseline(file)
      expect(res.baseline).toBeNull()
      expect(res.error).toMatch(/corrupt baseline/)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('splitArgs quoted command parsing', () => {
  it('preserves quoted substrings with spaces', () => {
    const args = splitArgs('npx -y @acme/server --greeting "hello world" --flag')
    expect(args).toEqual(['npx', '-y', '@acme/server', '--greeting', 'hello world', '--flag'])
  })

  it('handles single quotes', () => {
    const args = splitArgs("node index.js --title 'My Safe Tool'")
    expect(args).toEqual(['node', 'index.js', '--title', 'My Safe Tool'])
  })
})

describe('checkSchema non-iterable required resilience', () => {
  it('does not throw when required is a boolean or number', () => {
    const tool = {
      name: 'broken_schema_tool',
      description: 'A tool with malformed required schema',
      inputSchema: {
        type: 'object',
        properties: {
          param1: { type: 'string' },
        },
        required: true as any,
      },
    }
    expect(() => checkSchema(tool)).not.toThrow()
  })
})
