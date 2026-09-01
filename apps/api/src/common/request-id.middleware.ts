import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function resolveRequestId(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    const candidate = value.trim();

    if (REQUEST_ID_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  return randomUUID();
}

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER]);

  request.headers[REQUEST_ID_HEADER] = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
