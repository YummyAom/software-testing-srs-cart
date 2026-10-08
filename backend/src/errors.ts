type HttpErrorCode = 'AUTH_FORBIDDEN' | 'VALIDATION_ERROR';
const descriptions: Record<HttpErrorCode, string> = {
  AUTH_FORBIDDEN: 'Origin or request is not allowed',
  VALIDATION_ERROR: 'รูปแบบหรือช่วงของข้อมูลไม่ถูกต้อง',
};

export class HttpError extends Error {
  readonly status: number;
  constructor(readonly code: HttpErrorCode, message: string = descriptions[code], readonly details?: Record<string, unknown>) {
    super(message);
    this.status = code === 'VALIDATION_ERROR' ? 400 : 403;
  }
}
export function reject(code: HttpErrorCode, message?: string, details?: Record<string, unknown>): never {
  throw new HttpError(code, message, details);
}

// Strict request field whitelist; no implicit type coercion.
export function bodyObject(body: unknown, allowed: string[], required: string[] = allowed): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) reject('VALIDATION_ERROR');
  const input = body as Record<string, unknown>;
  const extra = Object.keys(input).filter(key => !allowed.includes(key));
  const missing = required.filter(key => !Object.hasOwn(input, key));
  if (extra.length || missing.length) reject('VALIDATION_ERROR', undefined, { fields: [...missing, ...extra] });
  return input;
}
export function stringField(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string') reject('VALIDATION_ERROR', undefined, { fields: [key] });
  return value;
}
