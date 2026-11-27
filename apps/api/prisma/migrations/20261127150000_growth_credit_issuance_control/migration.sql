CREATE TABLE "growth_credit_issuance_control" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mode" VARCHAR(8) NOT NULL DEFAULT 'LIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "growth_credit_issuance_control_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "growth_credit_issuance_control_valid"
        CHECK ("id" = 1 AND "mode" IN ('LIVE', 'SHADOW', 'PAUSED') AND "version" > 0)
);

INSERT INTO "growth_credit_issuance_control" ("id") VALUES (1);
