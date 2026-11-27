ALTER TYPE "NotificationOutboxEventType" ADD VALUE 'WALLET_CREDIT_ACTIVATED';
ALTER TYPE "NotificationOutboxStatus" ADD VALUE 'SKIPPED';

ALTER TABLE "notification_outbox_events"
  DROP CONSTRAINT "notification_outbox_events_lifecycle_valid",
  ADD CONSTRAINT "notification_outbox_events_lifecycle_valid" CHECK (
    ("status"::text IN ('PENDING', 'FAILED', 'UNKNOWN')
      AND "claimedAt" IS NULL AND "processedAt" IS NULL)
    OR ("status"::text IN ('PROCESSING', 'DISPATCHING')
      AND "claimedAt" IS NOT NULL AND "processedAt" IS NULL)
    OR (("status"::text = 'SENT'
        OR ("status"::text = 'SKIPPED' AND "type"::text = 'WALLET_CREDIT_ACTIVATED'))
      AND "claimedAt" IS NULL AND "processedAt" IS NOT NULL)
  );

CREATE TABLE "wallet_notification_settings" (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  "activationSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "activationConsentKey" UUID,
  "activationTemplateVersion" VARCHAR(32),
  "activationIntervalMinutes" INTEGER NOT NULL DEFAULT 15 CHECK ("activationIntervalMinutes" BETWEEN 0 AND 1440),
  "expiryInAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "expiryNoticeDays" INTEGER NOT NULL DEFAULT 30 CHECK ("expiryNoticeDays" BETWEEN 1 AND 90),
  "expiryUrgentDays" INTEGER NOT NULL DEFAULT 7 CHECK ("expiryUrgentDays" BETWEEN 1 AND "expiryNoticeDays"),
  CHECK ("activationSmsEnabled" = ("activationConsentKey" IS NOT NULL)
    AND "activationSmsEnabled" = ("activationTemplateVersion" IS NOT NULL))
);
INSERT INTO "wallet_notification_settings" (id) VALUES (1);

CREATE TABLE "wallet_notification_preferences" (
  "userId" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "activationSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "activationConsentKey" UUID,
  "expiryInAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastDispatchAt" TIMESTAMPTZ(3),
  CHECK ("activationSmsEnabled" = ("activationConsentKey" IS NOT NULL))
);
