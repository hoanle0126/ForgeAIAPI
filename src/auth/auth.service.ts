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

import {
  ACCESS_TOKEN_EXPIRES_IN,
  DEFAULT_ACCESS_TOKEN_SECRET,
  DEFAULT_REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN,
} from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUserResponse } from './types/auth-user-response.type';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
