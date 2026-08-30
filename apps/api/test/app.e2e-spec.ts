import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { AuthService } from './../src/modules/auth/auth.service';
import type { AuthenticatedPrincipal } from './../src/modules/authorization/authorization.types';
import { RequirePermissions } from './../src/modules/authorization/permissions.decorator';
import { PERMISSION_CODES, ROLE_CODES } from './../src/modules/authorization/rbac.constants';

@Controller('_test/authorization')
class AuthorizationProbeController {
  @Get()
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  check() {
    return {
      status: 'ok',
    };
  }
}

describe('Application (e2e)', () => {
  let app: INestApplication<App>;

  const userPrincipal: AuthenticatedPrincipal = {
    sessionId: '20000000-0000-4000-8000-000000000001',
    userId: '10000000-0000-4000-8000-000000000001',
    phone: '+989123456789',
    roleCodes: [ROLE_CODES.USER],
    permissionCodes: [],
  };

  const adminPrincipal: AuthenticatedPrincipal = {
    sessionId: '20000000-0000-4000-8000-000000000002',
    userId: '10000000-0000-4000-8000-000000000002',
    phone: '+989123456788',
    roleCodes: [ROLE_CODES.ADMIN],
    permissionCodes: [PERMISSION_CODES.CATALOG_READ],
  };

  const authService = {
    authenticateAccessToken: jest.fn(async (accessToken: string) => {
      if (accessToken === 'admin-token') {
        return adminPrincipal;
      }

      return userPrincipal;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AuthorizationProbeController],
    })
      .overrideProvider(AuthService)
      .useValue(authService)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/api/v1/health (GET) remains public', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200).expect({
      status: 'ok',
      service: 'hamidian-silver-api',
    });
  });

  it('/api/v1/auth/me requires authentication', () => {
    return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('rejects a permission-protected route without authentication', () => {
    return request(app.getHttpServer()).get('/api/v1/_test/authorization').expect(401);
  });

  it('rejects an authenticated principal without the required permission', () => {
    return request(app.getHttpServer())
      .get('/api/v1/_test/authorization')
      .set('Authorization', 'Bearer user-token')
      .expect(403);
  });

  it('allows an authenticated principal with the required permission', () => {
    return request(app.getHttpServer())
      .get('/api/v1/_test/authorization')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)
      .expect({
        status: 'ok',
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
