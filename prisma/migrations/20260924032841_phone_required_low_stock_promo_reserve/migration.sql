/*
  Warnings:

  - Made the column `phone` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `UserAddress` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "phone" SET NOT NULL;

-- AlterTable
ALTER TABLE "PendingCheckout" ADD COLUMN     "promoReserved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "UserAddress" ALTER COLUMN "phone" SET NOT NULL;
