-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "widgetEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "writeEnabled" BOOLEAN NOT NULL DEFAULT true;
