-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('private', 'public', 'system');

-- CreateTable
CREATE TABLE "BodyMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "muscleMass" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipsCm" DOUBLE PRECISION,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyMetric_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'private';

-- Backfill system exercises from the old boolean flag.
UPDATE "WorkoutExercise"
SET "visibility" = CASE WHEN "isGlobal" THEN 'system'::"Visibility" ELSE 'private'::"Visibility" END;

-- CreateTable
CREATE TABLE "WorkoutSet" (
    "id" TEXT NOT NULL,
    "workoutItemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "reps" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "restSeconds" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutSet_pkey" PRIMARY KEY ("id")
);

-- Backfill one set row per planned set from the old WorkoutItem columns.
INSERT INTO "WorkoutSet" (
    "id",
    "workoutItemId",
    "order",
    "reps",
    "weightKg",
    "durationSeconds",
    "restSeconds",
    "isCompleted",
    "createdAt",
    "updatedAt"
)
SELECT
    wi."id" || '-set-' || set_order,
    wi."id",
    set_order,
    wi."reps",
    wi."weightKg",
    wi."durationSeconds",
    wi."restSeconds",
    false,
    wi."createdAt",
    wi."updatedAt"
FROM "WorkoutItem" wi
CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(wi."sets", 1), 1)) AS set_order
WHERE wi."reps" IS NOT NULL OR wi."durationSeconds" IS NOT NULL;

-- AlterTable
ALTER TABLE "WorkoutItem" DROP COLUMN "sets",
DROP COLUMN "reps",
DROP COLUMN "weightKg",
DROP COLUMN "durationSeconds";

-- DropIndex
DROP INDEX "WorkoutExercise_isGlobal_idx";

-- AlterTable
ALTER TABLE "WorkoutExercise" DROP COLUMN "isGlobal";

-- CreateIndex
CREATE INDEX "BodyMetric_userId_idx" ON "BodyMetric"("userId");

-- CreateIndex
CREATE INDEX "BodyMetric_recordedAt_idx" ON "BodyMetric"("recordedAt");

-- CreateIndex
CREATE INDEX "WorkoutExercise_visibility_idx" ON "WorkoutExercise"("visibility");

-- CreateIndex
CREATE INDEX "Workout_isTemplate_idx" ON "Workout"("isTemplate");

-- CreateIndex
CREATE INDEX "WorkoutSet_workoutItemId_idx" ON "WorkoutSet"("workoutItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSet_workoutItemId_order_key" ON "WorkoutSet"("workoutItemId", "order");

-- AddForeignKey
ALTER TABLE "BodyMetric" ADD CONSTRAINT "BodyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSet" ADD CONSTRAINT "WorkoutSet_workoutItemId_fkey" FOREIGN KEY ("workoutItemId") REFERENCES "WorkoutItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
