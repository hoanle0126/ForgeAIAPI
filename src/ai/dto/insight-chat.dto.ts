import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class InsightChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  prompt!: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  muscleId?: string;
}
