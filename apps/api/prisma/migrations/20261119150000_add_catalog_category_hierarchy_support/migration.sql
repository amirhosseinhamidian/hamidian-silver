ALTER TABLE "products" ADD COLUMN "primaryCategoryId" UUID;

CREATE INDEX "products_primaryCategoryId_idx" ON "products"("primaryCategoryId");

ALTER TABLE "products"
ADD CONSTRAINT "products_primaryCategoryId_fkey"
FOREIGN KEY ("primaryCategoryId") REFERENCES "categories"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Draft taxonomy only. Keep all existing links and leave publication to catalog staff.
INSERT INTO "categories" ("id", "name", "slug", "parentId", "sortOrder", "isActive", "updatedAt")
SELECT gen_random_uuid(), proposed.name, proposed.slug, parent.id, proposed.position, false, CURRENT_TIMESTAMP
FROM "categories" AS parent
CROSS JOIN (VALUES
  ('دستبند زنجیری', 'bracelets-chain', 10),
  ('دستبند کاف', 'bracelets-cuff', 20),
  ('دستبند پلاک‌دار', 'bracelets-plate', 30)
) AS proposed(name, slug, position)
WHERE parent.slug = 'bracelets' AND parent."isActive" AND parent."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "categories" AS child
    WHERE child."parentId" = parent.id AND child.name = proposed.name AND child."deletedAt" IS NULL
  )
ON CONFLICT ("slug") DO NOTHING;
