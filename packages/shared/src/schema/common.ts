import { z } from 'zod'

/** A cuid2-style id. We don't validate the exact charset, just that it's a non-empty string. */
export const Id = z.string().min(1)

/** ISO-8601 timestamp string. */
export const Timestamp = z.string().datetime({ offset: true })

export const Provider = z.enum(['openai', 'anthropic', 'google', 'vertex', 'litellm'])
export type Provider = z.infer<typeof Provider>

/**
 * How completely the scanner could resolve a prompt's content from source.
 * - resolved: fully static (literal, or a literal followed through a binding/file)
 * - partial:  static skeleton with `{{holes}}` for runtime-interpolated parts
 * - dynamic:  the prompt is assembled at runtime and could not be reconstructed
 */
export const Resolution = z.enum(['resolved', 'partial', 'dynamic'])
export type Resolution = z.infer<typeof Resolution>

export const SourceKind = z.enum(['github_app', 'git', 'local_scan', 'connector', 'native'])
export type SourceKind = z.infer<typeof SourceKind>
