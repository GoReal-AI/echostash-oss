import type { FastifyPluginAsync } from 'fastify'
import { CiCheckRequest, CiCheckResponse, type CiCheckPromptResult } from '@echostash/shared'

export const ciRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/ci/check
   * Aggregate regression check for changed prompts in a pull request / commit.
   * Compares current eval run scores against previous baseline runs.
   */
  app.post<{ Body: CiCheckRequest }>(
    '/ci/check',
    {
      schema: {
        body: CiCheckRequest,
        response: {
          200: CiCheckResponse,
        },
      },
    },
    async (req, reply) => {
      const { changedFingerprints, threshold } = req.body

      const results: CiCheckPromptResult[] = []
      let allPass = true

      for (const fingerprint of changedFingerprints) {
        // Find prompt by fingerprint
        const prompt = await app.db.query.prompts.findFirst({
          where: (p, { eq }) => eq(p.fingerprint, fingerprint),
        })

        if (!prompt) {
          continue
        }

        // Find latest completed eval run for this prompt (current)
        const currentRun = await app.db.query.evalRuns.findFirst({
          where: (r, { eq, and }) => and(eq(r.promptId, prompt.id), eq(r.status, 'completed')),
          orderBy: (r, { desc }) => [desc(r.createdAt)],
        })

        // Find baseline eval run (e.g. earlier completed run)
        const baselineRun = await app.db.query.evalRuns.findFirst({
          where: (r, { eq, and, ne }) =>
            and(
              eq(r.promptId, prompt.id),
              eq(r.status, 'completed'),
              currentRun ? ne(r.id, currentRun.id) : undefined,
            ),
          orderBy: (r, { desc }) => [desc(r.createdAt)],
        })

        const score = currentRun?.summary?.passRate ?? 1.0
        const baseline = baselineRun?.summary?.passRate ?? null
        const delta = baseline !== null ? score - baseline : null
        const regressed = baseline !== null ? score < baseline - threshold : false

        if (regressed) {
          allPass = false
        }

        results.push({
          fingerprint,
          score,
          baseline,
          delta,
          regressed,
        })
      }

      return reply.send({
        pass: allPass,
        threshold,
        results,
      })
    },
  )
}
