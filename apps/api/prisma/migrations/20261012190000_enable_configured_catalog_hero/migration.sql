-- Existing responsive catalog hero images were uploaded while the visibility toggle remained off.
-- Enable only the fully configured hero once; future manual disable actions remain effective.
UPDATE "site_settings"
SET "catalogHeroEnabled" = TRUE
WHERE "catalogHeroEnabled" = FALSE
  AND "catalogHeroMediaId" IS NOT NULL
  AND "catalogHeroMobileMediaId" IS NOT NULL;
