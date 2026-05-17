import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ArrayMinSize,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  exerciseDifficulties,
  workoutGoals,
  workoutStatuses,
} from './workout.enums';
import type {
  ExerciseDifficultyDto,
  WorkoutGoalDto,
  WorkoutStatusDto,
} from './workout.enums';
import { WorkoutItemDto } from './workout-item.dto';

export class UpdateWorkoutDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

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
  @IsOptional()
  items?: WorkoutItemDto[];
}
