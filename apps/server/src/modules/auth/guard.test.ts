import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { AuthType } from './enums'
import { AuthErrorCode } from './errors'
import { requireAuth, requireSession } from './guard'

function mockApp(authResult?: { type: AuthType } | Error): FastifyInstance {
  return {
    authenticate: vi.fn(async () => {
      if (authResult instanceof Error) throw authResult
      if (!authResult) throw new Error('Unauthenticated')
      return authResult
    }),
  } as unknown as FastifyInstance
}

function mockReply(): { reply: FastifyReply; codeMock: ReturnType<typeof vi.fn>; sendMock: ReturnType<typeof vi.fn> } {
  const sendMock = vi.fn()
  const codeMock = vi.fn().mockReturnValue({ send: sendMock })
  const reply = { code: codeMock } as unknown as FastifyReply
  return { reply, codeMock, sendMock }
}

describe('auth guards', () => {
  describe('requireAuth', () => {
    it('allows valid session', async () => {
      const app = mockApp({ type: AuthType.Session })
      const { reply, codeMock } = mockReply()
      const req = {} as FastifyRequest

      await requireAuth(app)(req, reply)
      expect(codeMock).not.toHaveBeenCalled()
    })

    it('allows valid api-key', async () => {
      const app = mockApp({ type: AuthType.ApiKey })
      const { reply, codeMock } = mockReply()
      const req = {} as FastifyRequest

      await requireAuth(app)(req, reply)
      expect(codeMock).not.toHaveBeenCalled()
    })

    it('returns 401 when unauthenticated', async () => {
      const app = mockApp(new Error('fail'))
      const { reply, codeMock, sendMock } = mockReply()
      const req = {} as FastifyRequest

      await requireAuth(app)(req, reply)
      expect(codeMock).toHaveBeenCalledWith(401)
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ code: AuthErrorCode.Unauthorized }))
    })
  })

  describe('requireSession', () => {
    it('allows valid session', async () => {
      const app = mockApp({ type: AuthType.Session })
      const { reply, codeMock } = mockReply()
      const req = {} as FastifyRequest

      await requireSession(app)(req, reply)
      expect(codeMock).not.toHaveBeenCalled()
    })

    it('returns 403 Forbidden when authenticated via API key', async () => {
      const app = mockApp({ type: AuthType.ApiKey })
      const { reply, codeMock, sendMock } = mockReply()
      const req = {} as FastifyRequest

      await requireSession(app)(req, reply)
      expect(codeMock).toHaveBeenCalledWith(403)
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ code: AuthErrorCode.Forbidden }))
    })

    it('returns 401 when unauthenticated', async () => {
      const app = mockApp(new Error('no token'))
      const { reply, codeMock, sendMock } = mockReply()
      const req = {} as FastifyRequest

      await requireSession(app)(req, reply)
      expect(codeMock).toHaveBeenCalledWith(401)
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ code: AuthErrorCode.Unauthorized }))
    })
  })
})
