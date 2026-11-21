-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('PERCENT', 'FIXED', 'THRESHOLD', 'BUNDLE', 'FREE_SHIPPING');

-- CreateTable
CREATE TABLE "campaign_promotions" (
    "campaignId" UUID NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "minSubtotalToman" INTEGER NOT NULL,
    "maxDiscountToman" INTEGER NOT NULL,
    "maxDiscountBps" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    "bundleProductIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "couponCode" VARCHAR(32),
    "maxUses" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "actorUserId" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaign_promotions_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "order_price_quotes" (
    "orderId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "campaignId" UUID,
    "merchandiseDiscountToman" INTEGER NOT NULL,
    "shippingDiscountToman" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "order_price_quotes_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_promotions_couponCode_key" ON "campaign_promotions"("couponCode");

-- CreateIndex
CREATE INDEX "order_price_quotes_campaignId_idx" ON "order_price_quotes"("campaignId");

-- AddForeignKey
ALTER TABLE "campaign_promotions" ADD CONSTRAINT "campaign_promotions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_promotions" ADD CONSTRAINT "campaign_promotions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_price_quotes" ADD CONSTRAINT "order_price_quotes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_price_quotes" ADD CONSTRAINT "order_price_quotes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "campaign_promotions"
  ADD CONSTRAINT "campaign_promotions_limits_valid"
  CHECK (
    "value" >= 0 AND "minSubtotalToman" >= 0 AND "maxDiscountToman" > 0
    AND "maxDiscountBps" BETWEEN 1 AND 5000 AND "priority" BETWEEN 0 AND 100
    AND ("maxUses" IS NULL OR "maxUses" BETWEEN 1 AND 1000000)
    AND ("couponCode" IS NULL OR "maxUses" IS NOT NULL)
    AND ("kind" <> 'PERCENT' OR "value" BETWEEN 1 AND 5000)
    AND ("kind" <> 'THRESHOLD' OR "minSubtotalToman" > 0)
    AND ("kind" = 'FREE_SHIPPING') = ("value" = 0)
    AND (CASE WHEN "kind" = 'BUNDLE' THEN cardinality("bundleProductIds") BETWEEN 2 AND 10
              ELSE cardinality("bundleProductIds") = 0 END)
  );

ALTER TABLE "order_price_quotes"
  ADD CONSTRAINT "order_price_quotes_amounts_valid"
  CHECK (
    "merchandiseDiscountToman" >= 0 AND "shippingDiscountToman" >= 0
    AND ("campaignId" IS NOT NULL) = ("merchandiseDiscountToman" > 0 OR "shippingDiscountToman" > 0)
    AND ("merchandiseDiscountToman" = 0 OR "shippingDiscountToman" = 0)
  );
