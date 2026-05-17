import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { WorkoutSetDto } from './workout-set.dto';

export class WorkoutItemDto {
  @IsUUID()
  @IsOptional()
  exerciseId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  exerciseName?: string;

  @IsInt()
  @Min(1)
  order!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  restSeconds?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetDto)
  sets!: WorkoutSetDto[];
}
