import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('returns application health', () => {
    expect(service.checkApplication()).toEqual({
      status: 'ok',
      service: 'hamidian-silver-api',
    });
  });

  it('checks the PostgreSQL connection', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.checkDatabase()).resolves.toEqual({
      status: 'ok',
      database: 'postgresql',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
