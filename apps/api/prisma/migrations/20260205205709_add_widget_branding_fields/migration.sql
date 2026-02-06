-- Update existing NULL primaryColor values to default before making it NOT NULL
UPDATE "organizations" SET "primaryColor" = '#0F5C5C' WHERE "primaryColor" IS NULL;

-- AlterTable: Add widget branding fields
ALTER TABLE "organizations" 
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "launcherText" TEXT,
ADD COLUMN     "position" TEXT NOT NULL DEFAULT 'right',
ADD COLUMN     "widgetName" TEXT NOT NULL DEFAULT 'Brand Name',
ADD COLUMN     "widgetSubtitle" TEXT NOT NULL DEFAULT 'Default Subtitle',
ALTER COLUMN "primaryColor" SET NOT NULL,
ALTER COLUMN "primaryColor" SET DEFAULT '#0F5C5C';
