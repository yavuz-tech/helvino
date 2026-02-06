-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];
