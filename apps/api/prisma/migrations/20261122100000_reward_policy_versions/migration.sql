CREATE TABLE "reward_policy_versions" (
  "version" SERIAL NOT NULL,
  "requestId" UUID NOT NULL,
  "definition" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" UUID NOT NULL,
  "requestedEffectiveAt" TIMESTAMPTZ(3),
  "publishedAt" TIMESTAMPTZ(3),
  "publishedById" UUID,
  "effectiveAt" TIMESTAMPTZ(3),
  CONSTRAINT "reward_policy_versions_pkey" PRIMARY KEY ("version"),
  CONSTRAINT "reward_policy_versions_definition_check" CHECK (jsonb_typeof("definition") = 'object'),
  CONSTRAINT "reward_policy_versions_publication_check" CHECK (
    ("publishedAt" IS NULL AND "publishedById" IS NULL AND "effectiveAt" IS NULL)
    OR (
      "publishedAt" IS NOT NULL AND "publishedById" IS NOT NULL AND "effectiveAt" IS NOT NULL
      AND "effectiveAt" >= "publishedAt"
      AND ("requestedEffectiveAt" IS NULL OR "effectiveAt" = "requestedEffectiveAt")
    )
  ),
  CONSTRAINT "reward_policy_versions_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reward_policy_versions_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "reward_policy_versions_requestId_key" ON "reward_policy_versions"("requestId");
CREATE INDEX "reward_policy_versions_effectiveAt_version_idx"
  ON "reward_policy_versions"("effectiveAt", "version");
