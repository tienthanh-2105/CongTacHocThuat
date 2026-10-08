import { HealthService } from './business/health.service';
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./data/database.module";
import { AuthModule } from "./composition/auth.module";
import { HealthController } from "./presentation/health.controller";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, unknown>) => {
        for (const key of ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) {
          if (typeof env[key] !== 'string' || !String(env[key]).trim()) throw new Error(`Missing ${key}; configure apps/api/.env`);
        }
        const port = Number(env.PORT ?? 3001);
        if (!Number.isInteger(port) || port < 1 || port > 65535)
          throw new Error("Invalid PORT");
        const origin = String(env.WEB_ORIGIN ?? "http://localhost:3000");
        new URL(origin);
        const apiOrigin = String(env.API_ORIGIN ?? `http://localhost:${port}`);
        new URL(apiOrigin);
        const ttl = Number(env.SESSION_TTL_SECONDS ?? 28800);
        if (!Number.isInteger(ttl) || ttl < 60 || ttl > 604800) throw new Error('SESSION_TTL_SECONDS must be between 60 and 604800');
        if (env.NODE_ENV === 'production' && (!origin.startsWith('https://') || !apiOrigin.startsWith('https://'))) throw new Error('Production origins must use HTTPS');
        return { ...env, PORT: port, WEB_ORIGIN: origin, API_ORIGIN: apiOrigin, SESSION_TTL_SECONDS: ttl };
      },
    }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [HealthController], providers: [HealthService],
})
export class AppModule {}

