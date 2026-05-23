export const exerciseDifficulties = [
  'beginner',
  'intermediate',
  'advanced',
] as const;

export const workoutGoals = [
  'strength',
  'muscle_gain',
  'fat_loss',
  'mobility',
  'general_fitness',
] as const;

export const workoutStatuses = [
  'draft',
  'planned',
  'completed',
  'archived',
] as const;

export const workoutScheduleDays = [
  'mo',
  'tu',
  'we',
  'th',
  'fr',
  'sa',
  'su',
] as const;

export const exerciseVisibilities = ['private', 'public', 'system'] as const;

export const userExerciseVisibilities = ['private', 'public'] as const;

export const commonMuscleGroups = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
] as const;

export const equipmentTypes = [
  'bodyweight',
  'dumbbell',
  'barbell',
  'machine',
  'cable',
  'band',
  'kettlebell',
  'other',
] as const;

export type ExerciseDifficultyDto = (typeof exerciseDifficulties)[number];
export type ExerciseVisibilityDto = (typeof exerciseVisibilities)[number];
export type UserExerciseVisibilityDto =
  (typeof userExerciseVisibilities)[number];
export type WorkoutGoalDto = (typeof workoutGoals)[number];
export type WorkoutStatusDto = (typeof workoutStatuses)[number];
export type WorkoutScheduleDayDto = (typeof workoutScheduleDays)[number];
