import 'dotenv/config';
import { MailService } from '../src/auth/mail.service';

async function main() {
  const to = process.argv[2] ?? 'hoanle0126@gmail.com';
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const mail = new MailService();

  // eslint-disable-next-line no-console
  console.log(`[test-mail] sending OTP ${otp} to ${to} ...`);

  await mail.sendPasswordResetOtp({
    to,
    fullName: 'ForgeAI Tester',
    otp,
  });

  // eslint-disable-next-line no-console
  console.log('[test-mail] done');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[test-mail] failed:', err);
  process.exit(1);
});
