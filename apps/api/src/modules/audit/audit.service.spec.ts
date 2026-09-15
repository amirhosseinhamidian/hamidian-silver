import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('projects a Persian fallback for legacy rows and exposes operation filters', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: '10000000-0000-4000-8000-000000000001',
            actorUserId: '20000000-0000-4000-8000-000000000001',
            actorPhone: '09121234567',
            actorFirstName: 'مدیر',
            actorLastName: 'سیستم',
            action: 'DELETE /catalog/products/:id',
            title: null,
            operationType: 'DELETE',
            entityName: null,
            changes: null,
            resource: 'catalog',
            resourceId: '30000000-0000-4000-8000-000000000001',
            method: 'DELETE',
            path: '/api/v1/catalog/products/30000000-0000-4000-8000-000000000001',
            statusCode: 200,
            outcome: 'SUCCESS',
            ipAddress: null,
            userAgent: null,
            requestId: null,
            durationMs: 12,
            metadata: { roleCodes: ['MANAGER'] },
            createdAt: new Date('2026-09-11T00:00:00.000Z'),
          },
        ])
        .mockResolvedValueOnce([
          { total: 1n, succeeded: 1n, failed: 0n, actors: 1n, last24Hours: 1n },
        ])
        .mockResolvedValueOnce([{ resource: 'catalog' }])
        .mockResolvedValueOnce([{ operationType: 'DELETE' }]),
    };
    const service = new AuditService(prisma as unknown as PrismaService);

    const result = await service.list({ operationType: 'DELETE' });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        title: 'حذف کاتالوگ انجام شد.',
        operationType: 'DELETE',
        changes: [],
      }),
    );
    expect(result.operationTypes).toEqual(['DELETE']);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
  });
});
