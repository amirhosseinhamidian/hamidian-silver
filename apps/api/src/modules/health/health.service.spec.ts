import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  const prisma = {
    $queryRaw: jest.fn(),
  };
  const config = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    config.get.mockReturnValue('test');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ConfigService,
          useValue: config,
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

  it('reports readiness after the database probe succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.checkReadiness()).resolves.toEqual({
      status: 'ok',
      service: 'hamidian-silver-api',
      checks: {
        database: 'ok',
      },
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects readiness when the database probe fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

    await expect(service.checkReadiness()).rejects.toThrow('database unavailable');
  });

  it('includes persistent media in production readiness', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hamidian-media-ready-'));
    config.get.mockReturnValue('production');
    config.getOrThrow.mockReturnValue(directory);
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    try {
      await expect(service.checkReadiness()).resolves.toEqual({
        status: 'ok',
        service: 'hamidian-silver-api',
        checks: { database: 'ok', media: 'ok' },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects production readiness for missing and symlinked media roots', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hamidian-media-ready-'));
    const missing = join(directory, 'missing');
    const link = join(directory, 'link');
    config.get.mockReturnValue('production');
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    try {
      config.getOrThrow.mockReturnValue(missing);
      await expect(service.checkReadiness()).rejects.toMatchObject({ code: 'ENOENT' });

      await symlink(directory, link);
      config.getOrThrow.mockReturnValue(link);
      await expect(service.checkReadiness()).rejects.toThrow('Media storage is unavailable.');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
