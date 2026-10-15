-- CreateEnum
CREATE TYPE "RecipeSiteKind" AS ENUM ('WORDPRESS', 'HTML');

-- CreateTable
CREATE TABLE "RecipeSite" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RecipeSiteKind" NOT NULL,
    "searchUrl" TEXT NOT NULL,
    "linkSelector" TEXT,
    "linkPrefix" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeSite_familyId_host_key" ON "RecipeSite"("familyId", "host");

-- AddForeignKey
ALTER TABLE "RecipeSite" ADD CONSTRAINT "RecipeSite_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSite" ADD CONSTRAINT "RecipeSite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

