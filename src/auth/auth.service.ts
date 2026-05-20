import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { randomInt } from 'crypto';

import {
  ACCESS_TOKEN_EXPIRES_IN,
  DEFAULT_ACCESS_TOKEN_SECRET,
  DEFAULT_PASSWORD_RESET_TOKEN_SECRET,
  DEFAULT_REFRESH_TOKEN_SECRET,
  PASSWORD_RESET_OTP_MAX_ATTEMPTS,
  PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS,
  PASSWORD_RESET_OTP_TTL_MINUTES,
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
  REFRESH_TOKEN_EXPIRES_IN,
} from './auth.constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyPasswordResetOtpDto } from './dto/verify-password-reset-otp.dto';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUserResponse } from './types/auth-user-response.type';
import {
  AccessTokenPayload,
  PasswordResetTokenPayload,
  RefreshTokenPayload,
} from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    this.validateConfirmedPassword(dto.password, dto.confirmPassword);

    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException({
        message: 'Validation failed',
        errors: { email: ['Email already exists'] },
      });
    }

    const passwordHash = await hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email,
        passwordHash,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth,
      },
    });

    const tokens = await this.createSessionTokens(user.id, user.email);

    return {
      message: 'Authentication successful',
      data: {
        user: this.buildUserResponse(user),
        ...tokens,
      },
    };
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.createSessionTokens(user.id, user.email);

    return {
      message: 'Authentication successful',
      data: {
        user: this.buildUserResponse(user),
        ...tokens,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: payload.sessionId },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenMatches = await compare(dto.refreshToken, session.tokenHash);

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.createSessionTokens(user.id, user.email);

    return {
      message: 'Token refreshed successfully',
      data: tokens,
    };
  }

  async logout(dto: LogoutDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenMatches = await compare(dto.refreshToken, session.tokenHash);

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return {
      message: 'Logged out successfully',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    const successResponse = {
      message: 'If an account exists for that email, an OTP has been sent.',
    };

    if (!user) {
      return successResponse;
    }

    const latest = await this.prisma.passwordResetOtp.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (
      latest &&
      Date.now() - latest.createdAt.getTime() <
        PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS * 1000
    ) {
      throw new BadRequestException({
        message: 'Please wait before requesting another OTP',
        errors: {
          email: ['You can only request a new OTP every minute'],
        },
      });
    }

    await this.prisma.passwordResetOtp.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const otp = this.generateNumericOtp();
    const otpHash = await hash(otp, 10);

    await this.prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt: new Date(
          Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000,
        ),
      },
    });

    await this.mailService.sendPasswordResetOtp({
      to: user.email,
      fullName: user.fullName,
      otp,
    });

    return successResponse;
  }

  async verifyPasswordResetOtp(dto: VerifyPasswordResetOtpDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new BadRequestException({
        message: 'Invalid OTP',
        errors: { otp: ['Invalid or expired OTP'] },
      });
    }

    const record = await this.prisma.passwordResetOtp.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        message: 'Invalid OTP',
        errors: { otp: ['Invalid or expired OTP'] },
      });
    }

    if (record.attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
      await this.prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestException({
        message: 'Too many attempts',
        errors: {
          otp: ['Too many invalid attempts. Please request a new OTP.'],
        },
      });
    }

    const matches = await compare(dto.otp, record.otpHash);

    if (!matches) {
      await this.prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException({
        message: 'Invalid OTP',
        errors: { otp: ['Invalid or expired OTP'] },
      });
    }

    const resetToken = await this.signPasswordResetToken(user.id, record.id);
    const resetTokenHash = await hash(resetToken, 10);

    await this.prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { resetTokenHash },
    });

    return {
      message: 'OTP verified successfully',
      data: {
        resetToken,
        expiresInMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES,
      },
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    this.validateConfirmedPassword(dto.password, dto.confirmPassword);

    const payload = await this.verifyPasswordResetToken(dto.resetToken);
    const record = await this.prisma.passwordResetOtp.findUnique({
      where: { id: payload.otpId },
    });

    if (
      !record ||
      record.consumedAt ||
      !record.resetTokenHash ||
      record.userId !== payload.sub ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const tokenMatches = await compare(dto.resetToken, record.resetTokenHash);
    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await hash(dto.password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      message: 'Password has been reset successfully',
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Current user fetched successfully',
      data: {
        user: this.buildUserResponse(user),
      },
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private validateConfirmedPassword(password: string, confirmPassword: string) {
    if (password !== confirmPassword) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: {
          confirmPassword: ['Confirm password must match password'],
        },
      });
    }
  }

  private async createSessionTokens(userId: string, email: string) {
    const session = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: 'pending',
        expiresAt: this.buildRefreshTokenExpiry(),
      },
    });

    const accessToken = await this.signAccessToken(userId, email);
    const refreshToken = await this.signRefreshToken(userId, session.id);
    const tokenHash = await hash(refreshToken, 10);

    await this.prisma.refreshToken.update({
      where: { id: session.id },
      data: { tokenHash },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async signAccessToken(userId: string, email: string) {
    const payload: AccessTokenPayload = {
      sub: userId,
      email,
    };

    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? DEFAULT_ACCESS_TOKEN_SECRET,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  private async signRefreshToken(userId: string, sessionId: string) {
    const payload: RefreshTokenPayload = {
      sub: userId,
      sessionId,
    };

    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? DEFAULT_REFRESH_TOKEN_SECRET,
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
  }

  private async verifyRefreshToken(token: string) {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: process.env.JWT_REFRESH_SECRET ?? DEFAULT_REFRESH_TOKEN_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async signPasswordResetToken(userId: string, otpId: string) {
    const payload: PasswordResetTokenPayload = {
      sub: userId,
      otpId,
    };

    return this.jwtService.signAsync(payload, {
      secret:
        process.env.JWT_PASSWORD_RESET_SECRET ??
        DEFAULT_PASSWORD_RESET_TOKEN_SECRET,
      expiresIn: `${PASSWORD_RESET_TOKEN_TTL_MINUTES}m`,
    });
  }

  private async verifyPasswordResetToken(token: string) {
    try {
      return await this.jwtService.verifyAsync<PasswordResetTokenPayload>(
        token,
        {
          secret:
            process.env.JWT_PASSWORD_RESET_SECRET ??
            DEFAULT_PASSWORD_RESET_TOKEN_SECRET,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
  }

  private generateNumericOtp() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private buildUserResponse(user: User): AuthUserResponse {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth.toISOString().slice(0, 10),
      createdAt: user.createdAt.toISOString(),
    };
  }

  private buildRefreshTokenExpiry() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
}
