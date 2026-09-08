ALTER TABLE "site_settings"
ADD COLUMN "headerCategoryIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
ADD COLUMN "announcementEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "announcementMessage" VARCHAR(500),
ADD COLUMN "announcementCountdownMode" VARCHAR(16) NOT NULL DEFAULT 'NONE',
ADD COLUMN "announcementDurationSeconds" INTEGER,
ADD COLUMN "announcementEndsAt" TIMESTAMPTZ(3),
ADD COLUMN "announcementCtaLabel" VARCHAR(100),
ADD COLUMN "announcementCtaHref" VARCHAR(1000);

ALTER TABLE "site_settings"
ADD CONSTRAINT "site_settings_announcement_countdown_mode_check"
CHECK ("announcementCountdownMode" IN ('NONE', 'FIXED', 'DEADLINE'));

ALTER TABLE "site_settings"
ADD CONSTRAINT "site_settings_announcement_duration_check"
CHECK (
  "announcementDurationSeconds" IS NULL OR
  ("announcementDurationSeconds" >= 60 AND "announcementDurationSeconds" <= 604800)
);
