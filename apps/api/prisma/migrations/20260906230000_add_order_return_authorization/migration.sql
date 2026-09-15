ALTER TABLE "orders"
ADD COLUMN "returnAuthorizedAt" TIMESTAMPTZ(3),
ADD COLUMN "returnAuthorizedByUserId" UUID,
ADD COLUMN "returnAuthorizationReason" VARCHAR(500);

CREATE INDEX "orders_returnAuthorizedByUserId_idx"
ON "orders"("returnAuthorizedByUserId");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_returnAuthorizedByUserId_fkey"
FOREIGN KEY ("returnAuthorizedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
