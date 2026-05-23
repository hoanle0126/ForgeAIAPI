import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  equipmentTypes,
  workoutGoals,
  workoutScheduleDays,
} from '../../workouts/dto/workout.enums';

export const aiActivityLevels = [
  'sedentary',
  'light',
  'active',
  'very_active',
] as const;

export const aiPreferredTimes = [
  'morning',
  'afternoon',
  'evening',
  'flexible',
] as const;

export const aiTrainingDays = workoutScheduleDays;

export const aiExperienceLevels = [
  'beginner',
  'intermediate',
  'advanced',
] as const;

export const aiFatigueLevels = ['low', 'normal', 'high'] as const;

export type AiActivityLevel = (typeof aiActivityLevels)[number];
export type AiPreferredTime = (typeof aiPreferredTimes)[number];
export type AiTrainingDay = (typeof aiTrainingDays)[number];
export type AiExperienceLevel = (typeof aiExperienceLevels)[number];

export class BuildWorkoutPlanFeedbackDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  missedWorkouts?: number;

  @IsIn(aiFatigueLevels)
  @IsOptional()
  fatigueLevel?: (typeof aiFatigueLevels)[number];

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  sorenessAreas?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  completedWorkouts?: number;
}

export class BuildWorkoutPlanDto {
  @IsIn(workoutGoals)
  goal!: (typeof workoutGoals)[number];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(equipmentTypes, { each: true })
  equipment!: string[];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(120)
  @Max(230)
  heightCm!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(35)
  @Max(250)
  weightKg!: number;

  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(80)
  age!: number;

  @IsIn(aiActivityLevels)
  activityLevel!: AiActivityLevel;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(aiTrainingDays, { each: true })
  trainingDays!: AiTrainingDay[];

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(120)
  sessionMinutes!: number;

  @IsIn(aiPreferredTimes)
  preferredTime!: AiPreferredTime;

  @IsIn(aiExperienceLevels)
  @IsOptional()
  experienceLevel?: AiExperienceLevel;

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  injuries?: string[];

  @ValidateNested()
  @Type(() => BuildWorkoutPlanFeedbackDto)
  @IsOptional()
  feedback?: BuildWorkoutPlanFeedbackDto;
}
