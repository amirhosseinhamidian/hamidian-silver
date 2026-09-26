-- Keep database-level SEO defaults aligned with the public gallery brand.
ALTER TABLE "site_settings"
  ALTER COLUMN "seoSiteName" SET DEFAULT 'گالری حمیدیان',
  ALTER COLUMN "seoDefaultTitle" SET DEFAULT 'گالری حمیدیان',
  ALTER COLUMN "seoTitleTemplate" SET DEFAULT '%s | گالری حمیدیان',
  ALTER COLUMN "seoDefaultDescription" SET DEFAULT 'فروشگاه آنلاین نقره گالری حمیدیان',
  ALTER COLUMN "seoOrganizationName" SET DEFAULT 'گالری حمیدیان';

-- Migrate only legacy fallback values; preserve any custom SEO values.
UPDATE "site_settings"
SET
  "seoSiteName" = CASE
    WHEN "seoSiteName" = 'نقره حمیدیان' THEN 'گالری حمیدیان'
    ELSE "seoSiteName"
  END,
  "seoDefaultTitle" = CASE
    WHEN "seoDefaultTitle" = 'نقره حمیدیان' THEN 'گالری حمیدیان'
    ELSE "seoDefaultTitle"
  END,
  "seoTitleTemplate" = CASE
    WHEN "seoTitleTemplate" = '%s | گالری حمدیان' THEN '%s | گالری حمیدیان'
    ELSE "seoTitleTemplate"
  END,
  "seoDefaultDescription" = CASE
    WHEN "seoDefaultDescription" = 'فروشگاه آنلاین و گالری نقره حمیدیان'
      THEN 'فروشگاه آنلاین نقره گالری حمیدیان'
    ELSE "seoDefaultDescription"
  END,
  "seoOrganizationName" = CASE
    WHEN "seoOrganizationName" = 'نقره حمیدیان' THEN 'گالری حمیدیان'
    ELSE "seoOrganizationName"
  END;
