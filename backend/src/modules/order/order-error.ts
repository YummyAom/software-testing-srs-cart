export class OrderRepositoryError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
