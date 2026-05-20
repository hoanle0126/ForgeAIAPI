export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
}

export interface PasswordResetTokenPayload {
  sub: string;
  otpId: string;
}
