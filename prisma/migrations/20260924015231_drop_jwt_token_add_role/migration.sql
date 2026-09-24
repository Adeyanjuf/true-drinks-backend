/*
  Warnings:

  - You are about to drop the column `jwt_token` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CUSTOMER');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "jwt_token",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'CUSTOMER';
