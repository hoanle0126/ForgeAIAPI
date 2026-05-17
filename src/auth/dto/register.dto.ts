import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export enum GenderDto {
  male = 'male',
  female = 'female',
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(8)
  confirmPassword!: string;

  @IsEnum(GenderDto)
  gender!: GenderDto;

  @Type(() => Date)
  @IsDate()
  dateOfBirth!: Date;
}
