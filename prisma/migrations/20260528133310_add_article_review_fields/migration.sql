-- AlterTable
ALTER TABLE "LegalArticle" ADD COLUMN     "articleTextReviewed" TEXT,
ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- CreateIndex
CREATE INDEX "LegalArticle_reviewStatus_idx" ON "LegalArticle"("reviewStatus");
