import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
@Injectable()
export class DatabaseService
  implements OnModuleInit, OnModuleDestroy
{
  readonly pool: Pool;
  constructor(@Inject(ConfigService) config: ConfigService) {
    this.pool = new Pool({ host: config.get<string>('PGHOST'), port: Number(config.get('PGPORT') ?? 5432), database: config.get<string>('PGDATABASE'), user: config.get<string>('PGUSER'), password: config.get<string>('PGPASSWORD'), max: 10, connectionTimeoutMillis: 5000 });
    this.pool.on('error', () => console.error('PostgreSQL connection lost; pool will reconnect on next request'));
  }
  async onModuleInit() {
    await this.pool.query('SELECT 1');
  }
  async onModuleDestroy() {
    await this.pool.end();
  }
}
