BEGIN;

CREATE TABLE "catalog_merchandising_entries" (
    "productId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catalog_merchandising_entries_pkey" PRIMARY KEY ("productId"),
    CONSTRAINT "catalog_merchandising_entries_weight_check" CHECK ("weight" BETWEEN 0 AND 100),
    CONSTRAINT "catalog_merchandising_entries_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "catalog_merchandising_entries_schedule_check" CHECK (
        NOT "enabled" OR (
            "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "startsAt" < "endsAt"
            AND ("pinned" OR "weight" > 0)
        )
    )
);

CREATE INDEX "catalog_merchandising_entries_enabled_endsAt_idx"
ON "catalog_merchandising_entries"("enabled", "endsAt");

ALTER TABLE "catalog_merchandising_entries"
ADD CONSTRAINT "catalog_merchandising_entries_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
