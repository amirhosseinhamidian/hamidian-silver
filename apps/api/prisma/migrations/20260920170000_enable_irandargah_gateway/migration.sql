-- Retire legacy gateways from new checkout sessions while preserving their rows
-- for historical payment verification and audit records.
UPDATE "payment_gateway_settings"
SET "isEnabled" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "provider" IN ('zarinpal', 'zibal');

-- IranDargah becomes the active customer-facing gateway. Runtime availability
-- still requires a valid IRANDARGAH_API_TOKEN on the API service.
INSERT INTO "payment_gateway_settings" (
  "provider",
  "isEnabled",
  "createdAt",
  "updatedAt"
)
VALUES ('irandargah', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("provider") DO UPDATE
SET "isEnabled" = true, "updatedAt" = CURRENT_TIMESTAMP;
