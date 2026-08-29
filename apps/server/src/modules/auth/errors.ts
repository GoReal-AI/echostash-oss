/**
 * Centralized auth error definitions with codes and messages.
 * Ensures consistent error responses across all auth endpoints.
 */

/** Auth error codes for client-facing API responses. */
export enum AuthErrorCode {
  InvalidRequest = 'INVALID_REQUEST',
  InvalidPassword = 'INVALID_PASSWORD',
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  TooManyAttempts = 'TOO_MANY_ATTEMPTS',
  KeyNotFound = 'KEY_NOT_FOUND',
  KeyCreationFailed = 'KEY_CREATION_FAILED',
  InternalError = 'INTERNAL_ERROR',
}

/** Error message map for user-friendly responses. */
const ErrorMessages: Record<AuthErrorCode, string> = {
  [AuthErrorCode.InvalidRequest]: 'Invalid request: missing or malformed fields',
  [AuthErrorCode.InvalidPassword]: 'Invalid password',
  [AuthErrorCode.Unauthorized]: 'Unauthorized: valid authentication required',
  [AuthErrorCode.Forbidden]: 'Forbidden: session authentication required',
  [AuthErrorCode.TooManyAttempts]: 'Too many login attempts. Please try again in 15 minutes',
  [AuthErrorCode.KeyNotFound]: 'API key not found',
  [AuthErrorCode.KeyCreationFailed]: 'Failed to create API key',
  [AuthErrorCode.InternalError]: 'Internal server error',
}

/**
 * Structured error response for auth endpoints.
 */
export interface AuthError {
  code: AuthErrorCode
  message: string
  details?: Record<string, unknown>
}

/**
 * Create a structured auth error response.
 */
export function authError(code: AuthErrorCode, details?: Record<string, unknown>): AuthError {
  return {
    code,
    message: ErrorMessages[code],
    ...(details && { details }),
  }
}

/**
 * Helper to extract validation issues from zod errors for detailed responses.
 */
export function validationDetails(issues: Array<{ path: (string | number)[]; message: string }>) {
  return {
    fields: issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  }
}
