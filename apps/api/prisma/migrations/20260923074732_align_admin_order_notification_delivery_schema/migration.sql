-- AlterTable
ALTER TABLE "admin_order_notification_deliveries" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "admin_order_notification_deliveries_orderId_recipientUserId_cha" RENAME TO "admin_order_notification_deliveries_orderId_recipientUserId_key";

-- RenameIndex
ALTER INDEX "admin_order_notification_deliveries_recipientUserId_createdAt_i" RENAME TO "admin_order_notification_deliveries_recipientUserId_created_idx";
