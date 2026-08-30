import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  const healthService = {
    checkApplication: jest.fn(),
    checkDatabase: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns the API health status', () => {
    healthService.checkApplication.mockReturnValue({
      status: 'ok',
      service: 'hamidian-silver-api',
    });

    expect(controller.check()).toEqual({
      status: 'ok',
      service: 'hamidian-silver-api',
    });
  });

  it('returns the database health status', async () => {
    healthService.checkDatabase.mockResolvedValue({
      status: 'ok',
      database: 'postgresql',
    });

    await expect(controller.checkDatabase()).resolves.toEqual({
      status: 'ok',
      database: 'postgresql',
    });
  });
});
