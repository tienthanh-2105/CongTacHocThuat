import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database.service';

@Injectable()
export class RegistrationRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async updateRegistrationStatus(maDK: number, trangThai: string): Promise<boolean> {
    const result = await this.db.pool
      .request()
      .input('maDK', maDK)
      .input('trangThai', trangThai)
      .query(`UPDATE DKTHAMGIA SET TrangThai = @trangThai WHERE MaDK = @maDK`);
    return (result.rowsAffected[0] ?? 0) > 0;
  }
}
