import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class HealthRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  ping() {
    return this.database.query('SELECT 1 AS ping');
  }
}
