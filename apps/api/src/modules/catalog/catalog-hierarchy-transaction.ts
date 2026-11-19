import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';

export async function catalogHierarchyTransaction<T>(
  prisma: PrismaService,
  execute: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(execute, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
      throw new ConflictException('The catalog changed during this operation. Reload and retry.');
    }
    throw error;
  }
}
