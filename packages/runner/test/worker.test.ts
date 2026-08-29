import { describe, expect, it } from 'vitest'
import { WorkerEnvSchema } from '../src/worker'

describe('WorkerEnvSchema', () => {
  it('parses valid environment variables with defaults', () => {
    const parsed = WorkerEnvSchema.parse({
      REDIS_URL: 'redis://127.0.0.1:6379',
      ECHOSTASH_API_KEY: 'test-api-key',
    })

    expect(parsed.REDIS_URL).toBe('redis://127.0.0.1:6379')
    expect(parsed.ECHOSTASH_API_KEY).toBe('test-api-key')
    expect(parsed.ECHOSTASH_URL).toBe('http://localhost:8080')
    expect(parsed.WORKER_CONCURRENCY).toBe(4)
  })

  it('coerces and overrides concurrency and server URL', () => {
    const parsed = WorkerEnvSchema.parse({
      REDIS_URL: 'redis://127.0.0.1:6379',
      ECHOSTASH_URL: 'https://app.echostash.ai',
      ECHOSTASH_API_KEY: 'test-api-key',
      WORKER_CONCURRENCY: '8',
      ECHOSTASH_JUDGE_MODEL: 'claude-3-7-sonnet',
    })

    expect(parsed.ECHOSTASH_URL).toBe('https://app.echostash.ai')
    expect(parsed.WORKER_CONCURRENCY).toBe(8)
    expect(parsed.ECHOSTASH_JUDGE_MODEL).toBe('claude-3-7-sonnet')
  })

  it('rejects missing required environment variables', () => {
    expect(() => WorkerEnvSchema.parse({})).toThrow(/REDIS_URL/)
    expect(() =>
      WorkerEnvSchema.parse({
        REDIS_URL: 'redis://127.0.0.1:6379',
      }),
    ).toThrow(/ECHOSTASH_API_KEY/)
  })
})
