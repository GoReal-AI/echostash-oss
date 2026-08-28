import { describe, expect, it } from 'vitest'
import { parseTarget, stdioEnv } from './client'

const parent = {
  PATH: '/usr/bin',
  HOME: '/home/u',
  OPENAI_API_KEY: 'sk-secret',
  NPM_TOKEN: 'npm-secret',
}

describe('stdioEnv', () => {
  it('does not forward the parent environment by default', () => {
    const env = stdioEnv({ kind: 'stdio', command: 'npx', args: [] }, parent)
    expect(env).not.toHaveProperty('OPENAI_API_KEY')
    expect(env).not.toHaveProperty('NPM_TOKEN')
  })

  it('keeps the allow-listed basics a process needs to start', () => {
    // getDefaultEnvironment() reads the real process.env, so assert on shape, not values.
    const env = stdioEnv({ kind: 'stdio', command: 'npx', args: [] }, parent)
    for (const key of Object.keys(env)) expect(key).not.toMatch(/KEY|TOKEN|SECRET/)
    expect(env).toHaveProperty('PATH')
  })

  it('adds explicitly passed variables on top', () => {
    const env = stdioEnv(
      { kind: 'stdio', command: 'npx', args: [], env: { ACME_ENDPOINT: 'https://x' } },
      parent,
    )
    expect(env.ACME_ENDPOINT).toBe('https://x')
    expect(env).not.toHaveProperty('OPENAI_API_KEY')
  })

  it('forwards everything only with inheritEnv', () => {
    const env = stdioEnv(
      { kind: 'stdio', command: 'npx', args: [], inheritEnv: true, env: { EXTRA: '1' } },
      parent,
    )
    expect(env.OPENAI_API_KEY).toBe('sk-secret')
    expect(env.NPM_TOKEN).toBe('npm-secret')
    expect(env.EXTRA).toBe('1')
  })
})

describe('parseTarget', () => {
  it('treats http(s) as an endpoint and anything else as a command', () => {
    expect(parseTarget('https://a.example/mcp')).toEqual({
      kind: 'http',
      url: 'https://a.example/mcp',
      headers: undefined,
    })
    expect(parseTarget('npx -y @acme/server --flag')).toEqual({
      kind: 'stdio',
      command: 'npx',
      args: ['-y', '@acme/server', '--flag'],
    })
  })
})
