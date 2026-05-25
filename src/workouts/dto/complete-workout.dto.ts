import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { WorkoutEffortFeedback } from '@prisma/client';

export const difficultyAdjustments = ['increase', 'maintain', 'decrease'] as const;
export type DifficultyAdjustmentDto = (typeof difficultyAdjustments)[number];

export class CompleteWorkoutDto {
  @IsEnum(WorkoutEffortFeedback)
  effort!: WorkoutEffortFeedback;

  @IsEnum(difficultyAdjustments)
  difficultyAdjustment!: DifficultyAdjustmentDto;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  sorenessAreas?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  durationSeconds?: number;
}
