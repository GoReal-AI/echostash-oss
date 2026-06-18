import type { AssertionOp } from '@echostash/shared'
import Ajv from 'ajv'
import { parse as parseYaml } from 'yaml'
import { type ScoreOutcome, bool } from './types'

const ajv = new Ajv({ allErrors: true, strict: false })

export function scoreStructural(
  op: AssertionOp,
  config: Record<string, unknown>,
  output: string,
): ScoreOutcome {
  switch (op) {
    case 'json_valid':
      try {
        JSON.parse(output)
        return bool(true)
      } catch (err) {
        return bool(false, `invalid JSON: ${(err as Error).message}`)
      }
    case 'json_schema': {
      let parsed: unknown
      try {
        parsed = JSON.parse(output)
      } catch (err) {
        return bool(false, `invalid JSON: ${(err as Error).message}`)
      }
      const schema = config.schema
      if (!schema || typeof schema !== 'object') {
        return { score: 0, reason: 'json_schema scorer is missing a `schema` config' }
      }
      try {
        const validate = ajv.compile(schema as object)
        const ok = validate(parsed)
        return bool(ok, ok ? undefined : ajv.errorsText(validate.errors, { separator: '; ' }))
      } catch (err) {
        return { score: 0, reason: `invalid schema: ${(err as Error).message}` }
      }
    }
    case 'yaml_valid':
      try {
        parseYaml(output)
        return bool(true)
      } catch (err) {
        return bool(false, `invalid YAML: ${(err as Error).message}`)
      }
    default:
      return { score: 0, reason: `unsupported structural op: ${op}` }
  }
}
