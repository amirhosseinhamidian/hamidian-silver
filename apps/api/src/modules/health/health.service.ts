import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  checkApplication() {
    return {
      status: 'ok',
      service: 'hamidian-silver-api',
    };
  }

  async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'postgresql',
    };
  }

  async checkReadiness() {
    await this.checkDatabase();

    return {
      status: 'ok',
      service: 'hamidian-silver-api',
      checks: {
        database: 'ok',
      },
    };
  }
}
