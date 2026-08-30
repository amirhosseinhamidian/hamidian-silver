import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithAuth } from '../authorization/authorization.types';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const accessToken = this.extractBearerToken(request.headers?.authorization);

    if (!accessToken) {
      throw new UnauthorizedException('Authentication is required.');
    }

    request.auth = await this.authService.authenticateAccessToken(accessToken);

    return true;
  }

  private extractBearerToken(header: string | string[] | undefined): string | null {
    const value = Array.isArray(header) ? header[0] : header;

    if (!value) {
      return null;
    }

    const match = /^Bearer\s+(.+)$/i.exec(value.trim());

    return match?.[1] ?? null;
  }
}
