CREATE TYPE "GuideArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "GuideArticleFormat" AS ENUM ('GUIDE', 'ANSWER', 'BUYING_GUIDE', 'CARE_GUIDE', 'COMPARISON', 'STORY');
CREATE TYPE "GuideBlockType" AS ENUM ('LEAD', 'RICH_TEXT', 'IMAGE', 'IMAGE_TEXT', 'STEPS', 'QUOTE', 'TABLE', 'FAQ', 'GALLERY', 'PRODUCT_CARDS', 'CTA', 'DIVIDER');

ALTER TYPE "SeoRedirectEntityType" ADD VALUE IF NOT EXISTS 'GUIDE_ARTICLE';

CREATE TABLE "guide_topics" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(150) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "description" VARCHAR(1000),
  "coverMediaId" UUID,
  "seoTitle" VARCHAR(200),
  "seoDescription" VARCHAR(500),
  "seoCanonicalPath" VARCHAR(1000),
  "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
  "seoOgMediaId" UUID,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "deletedAt" TIMESTAMPTZ(3),
  CONSTRAINT "guide_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guide_articles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" VARCHAR(220) NOT NULL,
  "slug" VARCHAR(220) NOT NULL,
  "eyebrow" VARCHAR(100),
  "excerpt" VARCHAR(700),
  "format" "GuideArticleFormat" NOT NULL DEFAULT 'GUIDE',
  "status" "GuideArticleStatus" NOT NULL DEFAULT 'DRAFT',
  "heroMediaId" UUID,
  "heroMobileMediaId" UUID,
  "seoTitle" VARCHAR(200),
  "seoDescription" VARCHAR(500),
  "seoCanonicalPath" VARCHAR(1000),
  "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
  "seoOgMediaId" UUID,
  "searchKeywords" VARCHAR(120)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(120)[],
  "readingTimeMinutes" INTEGER,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID,
  "updatedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "deletedAt" TIMESTAMPTZ(3),
  CONSTRAINT "guide_articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guide_article_blocks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "articleId" UUID NOT NULL,
  "type" "GuideBlockType" NOT NULL,
  "variant" VARCHAR(50),
  "anchorId" VARCHAR(80),
  "primaryMediaId" UUID,
  "content" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "guide_article_blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guide_article_topics" (
  "articleId" UUID NOT NULL,
  "topicId" UUID NOT NULL,
  CONSTRAINT "guide_article_topics_pkey" PRIMARY KEY ("articleId", "topicId")
);

CREATE TABLE "guide_article_products" (
  "articleId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "guide_article_products_pkey" PRIMARY KEY ("articleId", "productId")
);

CREATE TABLE "guide_article_categories" (
  "articleId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  CONSTRAINT "guide_article_categories_pkey" PRIMARY KEY ("articleId", "categoryId")
);

CREATE TABLE "guide_article_brands" (
  "articleId" UUID NOT NULL,
  "brandId" UUID NOT NULL,
  CONSTRAINT "guide_article_brands_pkey" PRIMARY KEY ("articleId", "brandId")
);

CREATE UNIQUE INDEX "guide_topics_slug_key" ON "guide_topics"("slug");
CREATE INDEX "guide_topics_isActive_sortOrder_idx" ON "guide_topics"("isActive", "sortOrder");
CREATE INDEX "guide_topics_coverMediaId_idx" ON "guide_topics"("coverMediaId");
CREATE INDEX "guide_topics_seoOgMediaId_idx" ON "guide_topics"("seoOgMediaId");
CREATE INDEX "guide_topics_deletedAt_idx" ON "guide_topics"("deletedAt");
CREATE UNIQUE INDEX "guide_articles_slug_key" ON "guide_articles"("slug");
CREATE INDEX "guide_articles_status_publishedAt_idx" ON "guide_articles"("status", "publishedAt");
CREATE INDEX "guide_articles_isFeatured_publishedAt_idx" ON "guide_articles"("isFeatured", "publishedAt");
CREATE INDEX "guide_articles_heroMediaId_idx" ON "guide_articles"("heroMediaId");
CREATE INDEX "guide_articles_heroMobileMediaId_idx" ON "guide_articles"("heroMobileMediaId");
CREATE INDEX "guide_articles_seoOgMediaId_idx" ON "guide_articles"("seoOgMediaId");
CREATE INDEX "guide_articles_createdByUserId_idx" ON "guide_articles"("createdByUserId");
CREATE INDEX "guide_articles_updatedByUserId_idx" ON "guide_articles"("updatedByUserId");
CREATE INDEX "guide_articles_deletedAt_idx" ON "guide_articles"("deletedAt");
CREATE UNIQUE INDEX "guide_article_blocks_articleId_sortOrder_key" ON "guide_article_blocks"("articleId", "sortOrder");
CREATE UNIQUE INDEX "guide_article_blocks_articleId_anchorId_key" ON "guide_article_blocks"("articleId", "anchorId");
CREATE INDEX "guide_article_blocks_primaryMediaId_idx" ON "guide_article_blocks"("primaryMediaId");
CREATE INDEX "guide_article_topics_topicId_idx" ON "guide_article_topics"("topicId");
CREATE INDEX "guide_article_products_productId_idx" ON "guide_article_products"("productId");
CREATE INDEX "guide_article_products_articleId_sortOrder_idx" ON "guide_article_products"("articleId", "sortOrder");
CREATE INDEX "guide_article_categories_categoryId_idx" ON "guide_article_categories"("categoryId");
CREATE INDEX "guide_article_brands_brandId_idx" ON "guide_article_brands"("brandId");

ALTER TABLE "guide_topics" ADD CONSTRAINT "guide_topics_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guide_topics" ADD CONSTRAINT "guide_topics_seoOgMediaId_fkey" FOREIGN KEY ("seoOgMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guide_articles" ADD CONSTRAINT "guide_articles_heroMediaId_fkey" FOREIGN KEY ("heroMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guide_articles" ADD CONSTRAINT "guide_articles_heroMobileMediaId_fkey" FOREIGN KEY ("heroMobileMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guide_articles" ADD CONSTRAINT "guide_articles_seoOgMediaId_fkey" FOREIGN KEY ("seoOgMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guide_articles" ADD CONSTRAINT "guide_articles_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guide_articles" ADD CONSTRAINT "guide_articles_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guide_article_blocks" ADD CONSTRAINT "guide_article_blocks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "guide_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guide_article_blocks" ADD CONSTRAINT "guide_article_blocks_primaryMediaId_fkey" FOREIGN KEY ("primaryMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guide_article_topics" ADD CONSTRAINT "guide_article_topics_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "guide_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guide_article_topics" ADD CONSTRAINT "guide_article_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "guide_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guide_article_products" ADD CONSTRAINT "guide_article_products_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "guide_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guide_article_products" ADD CONSTRAINT "guide_article_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guide_article_categories" ADD CONSTRAINT "guide_article_categories_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "guide_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guide_article_categories" ADD CONSTRAINT "guide_article_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "guide_article_brands" ADD CONSTRAINT "guide_article_brands_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "guide_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guide_article_brands" ADD CONSTRAINT "guide_article_brands_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
