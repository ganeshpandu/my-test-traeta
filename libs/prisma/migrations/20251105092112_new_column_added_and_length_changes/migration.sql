-- AlterTable
ALTER TABLE "public"."ListItems" ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Lists" ADD COLUMN     "listIcon" VARCHAR(50);
