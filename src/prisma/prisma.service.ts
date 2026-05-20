import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const databaseUrl = resolveDatabaseUrl();

    super(
      databaseUrl
        ? {
            datasources: {
              db: { url: databaseUrl },
            },
          }
        : undefined,
    );
  }

  async onModuleInit() {
    await this.$connect();
  }
}

function resolveDatabaseUrl(): string | undefined {
  const host = process.env.DB_HOST?.trim();
  const database = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();

  if (!host || !database || !user) {
    return undefined;
  }

  const port = process.env.DB_PORT?.trim() || '5432';
  const password = process.env.DB_PASSWORD ?? '';
  const schema = process.env.DB_SCHEMA?.trim() || 'public';

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedSchema = encodeURIComponent(schema);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}?schema=${encodedSchema}`;
}
