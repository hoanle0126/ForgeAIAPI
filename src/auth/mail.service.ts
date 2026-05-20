import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

import {
  BREVO_DEFAULT_SMTP_HOST,
  BREVO_DEFAULT_SMTP_PORT,
  PASSWORD_RESET_OTP_TTL_MINUTES,
} from './auth.constants';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  async sendPasswordResetOtp(params: {
    to: string;
    fullName: string;
    otp: string;
  }) {
    const { to, fullName, otp } = params;
    const subject = 'ForgeAI password reset code';
    const html = this.buildOtpEmailHtml(fullName, otp);
    const text = this.buildOtpEmailText(fullName, otp);

    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(
        `Brevo SMTP not configured. OTP for ${to} (debug only): ${otp}`,
      );
      return;
    }

    const from = process.env.BREVO_FROM_EMAIL ?? 'no-reply@forgeai.local';
    const fromName = process.env.BREVO_FROM_NAME ?? 'ForgeAI';

    await transporter.sendMail({
      from: `"${fromName}" <${from}>`,
      to,
      subject,
      text,
      html,
    });
  }

  private getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const user = process.env.BREVO_SMTP_USER;
    const pass = process.env.BREVO_SMTP_KEY;

    if (!user || !pass) {
      return null;
    }

    const host = process.env.BREVO_SMTP_HOST ?? BREVO_DEFAULT_SMTP_HOST;
    const port = Number(process.env.BREVO_SMTP_PORT ?? BREVO_DEFAULT_SMTP_PORT);

    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    return this.transporter;
  }

  private buildOtpEmailText(fullName: string, otp: string) {
    return [
      `Hi ${fullName},`,
      '',
      `Your ForgeAI password reset code is: ${otp}`,
      `This code expires in ${PASSWORD_RESET_OTP_TTL_MINUTES} minutes.`,
      '',
      "If you didn't request this, you can safely ignore this email.",
      '',
      '— ForgeAI',
    ].join('\n');
  }

  private buildOtpEmailHtml(fullName: string, otp: string) {
    return `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0b0c;color:#f5f5f5;margin:0;padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#141416;border-radius:16px;padding:32px;border:1px solid #1f1f22;">
      <h1 style="margin:0 0 16px;font-size:20px;letter-spacing:-0.01em;">ForgeAI password reset</h1>
      <p style="margin:0 0 24px;color:#bfbfc4;line-height:1.5;">Hi ${fullName}, use the code below to reset your password.</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:600;background:#1c1c20;padding:18px 24px;border-radius:12px;text-align:center;">${otp}</div>
      <p style="margin:24px 0 0;color:#7d7d83;font-size:13px;line-height:1.5;">This code expires in ${PASSWORD_RESET_OTP_TTL_MINUTES} minutes. If you didn't request a reset, ignore this email.</p>
    </div>
  </body>
</html>`;
  }
}
