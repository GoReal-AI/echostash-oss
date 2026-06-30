/**
 * Centralized auth-related enums and constants.
 * Keeps string literals DRY and makes the code more maintainable.
 */

/** Environment runtime mode. */
export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/** Authentication method used by a request. */
export enum AuthType {
  Session = 'session',
  ApiKey = 'api-key',
}

/** Cookie name used for session storage. */
export const SESSION_COOKIE_NAME = 'session'

/**
 * Check if the current environment is production. Avoids string literal comparisons.
 */
export function isProduction(nodeEnv: string): boolean {
  return nodeEnv === NodeEnv.Production
}
