import type { Prisma } from '../generated/prisma/client';

export async function lockOrderRowForUpdate(
  transaction: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "orders"
    WHERE "id" = ${orderId}::uuid
    FOR UPDATE
  `;
}
