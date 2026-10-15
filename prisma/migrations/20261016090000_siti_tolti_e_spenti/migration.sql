-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "disabledSites" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hiddenSites" TEXT[] DEFAULT ARRAY[]::TEXT[];

