/**
 * src/lib/error-utils.ts
 *
 * Minimal utility for safely extracting error messages from `unknown` catch values.
 * Use this instead of `catch (error: any)` + `error.message`.
 */

/**
 * Return the error message string from an unknown thrown value.
 * Falls back to a generic string when the value is not an Error instance.
 */
export function getErrorMessage(error: unknown, fallback = '未知錯誤'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}
