-- AlterTable
ALTER TABLE "brands" ADD COLUMN "heroImageId" UUID;

-- CreateIndex
CREATE INDEX "brands_heroImageId_idx" ON "brands"("heroImageId");

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_heroImageId_fkey" FOREIGN KEY ("heroImageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
