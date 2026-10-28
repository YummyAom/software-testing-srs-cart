export class CartServiceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string,
    readonly details?: Record<string, unknown>,
    readonly reason?: 'timeout' | 'transport' | 'upstream' | 'invalid_response',
    readonly permissionTarget?: string) { super(message); }
}
