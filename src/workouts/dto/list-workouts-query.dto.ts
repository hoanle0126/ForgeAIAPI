import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsOptional } from 'class-validator';

import { workoutStatuses } from './workout.enums';

export class ListWorkoutsQueryDto {
  @IsIn(workoutStatuses)
  @IsOptional()
  status?: string;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  isTemplate?: boolean;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  from?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  to?: Date;
}
