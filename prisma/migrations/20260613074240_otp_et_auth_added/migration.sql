-- AlterTable
ALTER TABLE "User" ADD COLUMN     "jwt_token" TEXT,
ADD COLUMN     "otp_expiresAt" TIMESTAMP(3),
ADD COLUMN     "otp_hashed" TEXT;
