-- CreateTable
CREATE TABLE "site_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'site',
    "catalogHeroEnabled" BOOLEAN NOT NULL DEFAULT false,
    "catalogHeroTitle" VARCHAR(200),
    "catalogHeroSubtitle" VARCHAR(500),
    "catalogHeroMediaId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_settings_catalogHeroMediaId_idx" ON "site_settings"("catalogHeroMediaId");

-- CreateIndex
CREATE INDEX "site_settings_updatedByUserId_idx" ON "site_settings"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_catalogHeroMediaId_fkey" FOREIGN KEY ("catalogHeroMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

