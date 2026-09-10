CREATE TYPE "SeoRedirectEntityType" AS ENUM ('PRODUCT', 'CATEGORY', 'BRAND');

CREATE TABLE "seo_redirects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sourcePath" VARCHAR(1000) NOT NULL,
  "destinationPath" VARCHAR(1000) NOT NULL,
  "entityType" "SeoRedirectEntityType" NOT NULL,
  "entityId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "seo_redirects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seo_redirects_sourcePath_key" ON "seo_redirects"("sourcePath");
CREATE INDEX "seo_redirects_entityType_entityId_idx" ON "seo_redirects"("entityType", "entityId");
CREATE INDEX "seo_redirects_destinationPath_idx" ON "seo_redirects"("destinationPath");
