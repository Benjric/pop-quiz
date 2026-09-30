-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "autoAdvance" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "revealedAt" TIMESTAMP(3);
