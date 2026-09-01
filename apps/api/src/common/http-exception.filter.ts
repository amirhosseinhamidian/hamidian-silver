import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
  meta: {
    timestamp: string;
    path: string;
    requestId: string;
  };
};

function resolveErrorCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';

    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';

    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';

    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';

    default:
      return 'INTERNAL_ERROR';
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();

    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload: ApiErrorResponse = {
      success: false,

      error: {
        code: resolveErrorCode(status),

        message:
          exception instanceof HttpException
            ? this.extractMessage(exception)
            : 'Internal server error',
      },

      meta: {
        timestamp: new Date().toISOString(),

        path: request.url,

        requestId: request.headers['x-request-id']?.toString() ?? 'unknown',
      },
    };

    response.status(status).json(payload);
  }

  private extractMessage(exception: HttpException): string {
    const body = exception.getResponse();

    if (typeof body === 'string') {
      return body;
    }

    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = (
        body as {
          message?: unknown;
        }
      ).message;

      if (Array.isArray(message)) {
        return message.join(', ');
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    return exception.message;
  }
}
