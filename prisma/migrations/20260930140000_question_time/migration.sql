-- Each played question keeps its own time limit.
ALTER TABLE "GameQuestion" ADD COLUMN "timeLimitSec" INTEGER;

-- Games created before this used one time for every question.
UPDATE "GameQuestion" AS gq SET "timeLimitSec" = g."timeLimitSec" FROM "Game" AS g WHERE gq."gameId" = g."id";

ALTER TABLE "GameQuestion" ALTER COLUMN "timeLimitSec" SET NOT NULL;
