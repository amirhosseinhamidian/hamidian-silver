CREATE TABLE "policy_simulation_reviews" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "decision" VARCHAR(12) NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_simulation_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "policy_simulation_reviews_actorUserId_fkey"
        FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "policy_simulation_reviews_valid" CHECK (
        "mode" IN ('BASKET', 'HISTORY')
        AND "decision" IN ('RECOMMEND', 'HOLD', 'REJECT')
        AND jsonb_typeof("input") = 'object'
        AND jsonb_typeof("result") = 'object'
    )
);

CREATE INDEX "policy_simulation_reviews_createdAt_id_idx" ON "policy_simulation_reviews"("createdAt", "id");
