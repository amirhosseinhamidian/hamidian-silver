import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants } from 'node:fs';
import { access, lstat, statfs } from 'node:fs/promises';
import { MEDIA_UPLOAD_LIMIT_BYTES, resolveMediaStorageRoot } from '../../config/media-storage';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

    // A running API cannot serve or accept product media when its persistent
    // bind mount disappears, becomes read-only, or runs out of space.
    if (this.config.get<string>('NODE_ENV') === 'production') {
      const root = resolveMediaStorageRoot(this.config);
      const directory = await lstat(root);
      if (!directory.isDirectory() || directory.isSymbolicLink()) {
        throw new Error('Media storage is unavailable.');
      }
      await access(root, constants.R_OK | constants.W_OK | constants.X_OK);
      const filesystem = await statfs(root);
      if (filesystem.bavail * filesystem.bsize < MEDIA_UPLOAD_LIMIT_BYTES * 2) {
        throw new Error('Media storage has insufficient free space.');
      }

      return {
        status: 'ok',
        service: 'hamidian-silver-api',
        checks: { database: 'ok', media: 'ok' },
      };
    }

    return {
      status: 'ok',
      service: 'hamidian-silver-api',
      checks: {
        database: 'ok',
      },
    };
  }
}
