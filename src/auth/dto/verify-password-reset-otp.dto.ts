import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyPasswordResetOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, { message: 'OTP must be a 6-digit number' })
  otp!: string;
}
