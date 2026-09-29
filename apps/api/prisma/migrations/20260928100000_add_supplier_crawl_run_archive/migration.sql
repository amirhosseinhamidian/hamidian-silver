ALTER TABLE "supplier_crawl_runs"
ADD COLUMN "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN "archivedByUserId" UUID;

CREATE INDEX "supplier_crawl_runs_archivedAt_createdAt_idx"
ON "supplier_crawl_runs"("archivedAt", "createdAt");

CREATE INDEX "supplier_crawl_runs_archivedByUserId_idx"
ON "supplier_crawl_runs"("archivedByUserId");

ALTER TABLE "supplier_crawl_runs"
ADD CONSTRAINT "supplier_crawl_runs_archivedByUserId_fkey"
FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
