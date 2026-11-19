import type { PrismaService } from '../../infrastructure/database/prisma.service';

type CategoryCountRow = {
  id: string;
  activeProductCount: bigint;
  activeSubtreeProductCount: bigint;
};

export async function readActiveCategoryProductCounts(prisma: Pick<PrismaService, '$queryRaw'>) {
  // UNION terminates even if legacy category data contains a loop.
  const counts = await prisma.$queryRaw<CategoryCountRow[]>`
    WITH RECURSIVE subtree("rootId", "categoryId") AS (
      SELECT id, id FROM "categories" WHERE "isActive" AND "deletedAt" IS NULL
      UNION
      SELECT subtree."rootId", child.id
      FROM subtree
      JOIN "categories" AS child ON child."parentId" = subtree."categoryId"
      WHERE child."isActive" AND child."deletedAt" IS NULL
    )
    SELECT
      subtree."rootId" AS id,
      COUNT(DISTINCT product.id) FILTER (WHERE subtree."rootId" = subtree."categoryId") AS "activeProductCount",
      COUNT(DISTINCT product.id) AS "activeSubtreeProductCount"
    FROM subtree
    LEFT JOIN "product_categories" AS membership ON membership."categoryId" = subtree."categoryId"
    LEFT JOIN "products" AS product
      ON product.id = membership."productId" AND product.status = 'ACTIVE' AND product."deletedAt" IS NULL
    GROUP BY subtree."rootId"
  `;

  return new Map(
    counts.map(
      ({ id, activeProductCount, activeSubtreeProductCount }) =>
        [
          id,
          {
            activeProductCount: Number(activeProductCount),
            activeSubtreeProductCount: Number(activeSubtreeProductCount),
          },
        ] as const,
    ),
  );
}
