-- AlterTable
ALTER TABLE "Workout"
ADD COLUMN "scheduledDays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill one recurring day from existing scheduled dates.
UPDATE "Workout"
SET "scheduledDays" = ARRAY[
  CASE EXTRACT(ISODOW FROM "scheduledFor")
    WHEN 1 THEN 'mo'
    WHEN 2 THEN 'tu'
    WHEN 3 THEN 'we'
    WHEN 4 THEN 'th'
    WHEN 5 THEN 'fr'
    WHEN 6 THEN 'sa'
    WHEN 7 THEN 'su'
    ELSE 'mo'
  END
]
WHERE "scheduledFor" IS NOT NULL
  AND COALESCE(array_length("scheduledDays", 1), 0) = 0;
