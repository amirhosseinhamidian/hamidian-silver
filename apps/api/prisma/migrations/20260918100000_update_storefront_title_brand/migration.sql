ALTER TABLE "site_settings"
  ALTER COLUMN "seoTitleTemplate" SET DEFAULT '%s | گالری حمدیان';

UPDATE "site_settings"
SET "seoTitleTemplate" = '%s | گالری حمدیان'
WHERE "seoTitleTemplate" = '%s | نقره حمیدیان';
