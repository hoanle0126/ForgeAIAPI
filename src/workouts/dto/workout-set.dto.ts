import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class WorkoutSetDto {
  @IsInt()
  @Min(1)
  order!: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  reps?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  weightKg?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  durationSeconds?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  restSeconds?: number;

  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;
}
