ALTER TABLE "supplier_crawl_runs"
ADD COLUMN "pendingCategoryUrls" VARCHAR(2000)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(2000)[];
