import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sql, { ConnectionPool, config as SqlConfig, IRecordSet } from 'mssql';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly pool: ConnectionPool;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const port = config.get<string | number>('DB_PORT');
    const sqlConfig: SqlConfig = {
      server: config.get<string>('DB_SERVER') ?? 'localhost',
      port: port ? Number(port) : 1433,
      database: config.get<string>('DB_NAME') ?? 'QL_CongTacHocThuat',
      user: config.get<string>('DB_USER') ?? 'sa',
      password: config.get<string>('DB_PASSWORD') ?? '',
      options: {
        encrypt: config.get<string>('DB_ENCRYPT') === 'true',
        trustServerCertificate: config.get<string>('DB_TRUST_SERVER_CERTIFICATE') !== 'false',
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      connectionTimeout: 10000,
      requestTimeout: 15000,
    };

    this.pool = new ConnectionPool(sqlConfig);
    this.pool.on('error', (err) => {
      console.error('SQL Server pool error:', err);
    });
  }

  async onModuleInit() {
    await this.pool.connect();
    await this.pool.request().query('SELECT 1 AS ping');
  }

  async onModuleDestroy() {
    if (this.pool.connected) {
      await this.pool.close();
    }
  }

  /**
   * Helper to execute parameterized queries.
   * Parameters are provided as array [param1, param2, ...] and mapped to @p1, @p2, ...
   */
  async query<T = any>(sqlText: string, params: unknown[] = []): Promise<IRecordSet<T>> {
    const request = this.pool.request();
    params.forEach((param, index) => {
      request.input(`p${index + 1}`, param);
    });
    const result = await request.query<T>(sqlText);
    return result.recordset;
  }
}
