import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

const execFileAsync = promisify(execFile);

export async function createIsolatedTestDatabase() {
  const config = new ConfigService();
  const databaseUrl = new URL(config.getOrThrow<string>('DATABASE_URL'));
  const databaseName = `hamidian_wallet_test_${randomUUID().replaceAll('-', '')}`;
  databaseUrl.pathname = `/${databaseName}`;
  databaseUrl.searchParams.set('schema', 'public');

  const admin = new PrismaService(config);
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}" TEMPLATE template0`);
  } catch (error) {
    await admin.$disconnect();
    throw error;
  }

  const db = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl.toString() }));
  const close = async () => {
    try {
      await db.$disconnect();
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    } finally {
      await admin.$disconnect();
    }
  };

  try {
    await execFileAsync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: resolve(__dirname, '../../../..'),
      env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
      timeout: 90_000,
    });
    return { db, close };
  } catch (error) {
    await close();
    throw error;
  }
}
