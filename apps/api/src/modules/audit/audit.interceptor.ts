import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { catchError, concatMap, from, map, mergeMap, throwError } from 'rxjs';
import type { RequestWithAuth } from '../authorization/authorization.types';
import { resolveHumanAuditEvent } from './audit-event';
import { AuditService, type RecordAuditLogInput } from './audit.service';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

type AuditedRequest = Request & RequestWithAuth;

function boundedHeader(value: string | string[] | undefined, maxLength: number): string | null {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved?.trim().slice(0, maxLength) || null;
}

export function describeAuditTarget(path: string, method: string) {
  const safePath = path.split('?')[0].slice(0, 500);
  const domainPath = safePath.replace(/^\/api\/v\d+\/?/, '/');
  const segments = domainPath.split('/').filter(Boolean);
  const resource = (segments[0] ?? 'unknown').slice(0, 80);
  const resourceId = safePath.match(UUID_PATTERN)?.[0] ?? null;
  const templatedPath = domainPath.replace(new RegExp(UUID_PATTERN.source, 'gi'), ':id');
  return {
    action: `${method.toUpperCase()} ${templatedPath}`.slice(0, 180),
    resource,
    resourceId,
    path: safePath,
  };
}

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditTrailInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method.toUpperCase();
    const principal = request.auth;
    if (!principal || !MUTATION_METHODS.has(method)) return next.handle();

    const startedAt = Date.now();
    const target = describeAuditTarget(request.originalUrl || request.url, method);
    const base = {
      actorUserId: principal.userId,
      action: target.action,
      resource: target.resource,
      resourceId: target.resourceId,
      method,
      path: target.path,
      ipAddress: request.ip?.slice(0, 64) || null,
      userAgent: boundedHeader(request.headers['user-agent'], 500),
      requestId: boundedHeader(request.headers['x-request-id'], 120),
      metadata: { roleCodes: [...principal.roleCodes] },
    };

    return next.handle().pipe(
      concatMap((value) =>
        from(
          this.safeRecord({
            ...base,
            ...resolveHumanAuditEvent(value, { ...target, method }, 'SUCCESS'),
            statusCode: response.statusCode,
            outcome: 'SUCCESS',
            durationMs: Date.now() - startedAt,
          }),
        ).pipe(map(() => value)),
      ),
      catchError((error: unknown) => {
        const statusCode = error instanceof HttpException ? error.getStatus() : 500;
        return from(
          this.safeRecord({
            ...base,
            ...resolveHumanAuditEvent(null, { ...target, method }, 'FAILURE'),
            statusCode,
            outcome: 'FAILURE',
            durationMs: Date.now() - startedAt,
          }),
        ).pipe(mergeMap(() => throwError(() => error)));
      }),
    );
  }

  private async safeRecord(input: RecordAuditLogInput): Promise<void> {
    try {
      await this.auditService.record(input);
    } catch (error) {
      this.logger.error(
        `Audit write failed for ${input.action}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
