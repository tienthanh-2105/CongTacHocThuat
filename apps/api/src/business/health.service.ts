import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HealthRepository } from '../data/health.repository';
@Injectable()
export class HealthService {
  constructor(@Inject(HealthRepository) private readonly repository: HealthRepository) {}
  async check() {
    try {
      await this.repository.ping();
      return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
    } catch { throw new ServiceUnavailableException('Database unavailable'); }
  }
}
