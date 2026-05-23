import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  exerciseDifficulties,
  workoutGoals,
  workoutScheduleDays,
  workoutStatuses,
} from './workout.enums';
import type {
  ExerciseDifficultyDto,
  WorkoutGoalDto,
  WorkoutScheduleDayDto,
  WorkoutStatusDto,
} from './workout.enums';
import { WorkoutItemDto } from './workout-item.dto';

export class CreateWorkoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isTemplate?: boolean;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  scheduledFor?: Date;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(workoutScheduleDays, { each: true })
  @IsOptional()
  scheduledDays?: WorkoutScheduleDayDto[];

  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;

  @IsIn(exerciseDifficulties)
  @IsOptional()
  difficulty?: ExerciseDifficultyDto;

  @IsIn(workoutGoals)
  @IsOptional()
  goal?: WorkoutGoalDto;

  @IsIn(workoutStatuses)
  @IsOptional()
  status?: WorkoutStatusDto;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkoutItemDto)
  items!: WorkoutItemDto[];
}
