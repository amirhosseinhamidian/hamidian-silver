import { ErrorCode } from './error-codes';

export class DomainException extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message ?? code);

    this.name = 'DomainException';
  }
}
