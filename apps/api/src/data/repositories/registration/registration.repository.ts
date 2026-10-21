import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database.service';

export interface ActivityInfo {
  MaHD: number;
  TenHoatDong: string;
  TgBatDau: Date;
  TgKetThuc: Date;
  HanDangKy: Date | null;
  DiaDiem: string | null;
  SLToiDa: number | null;
  TrangThai: string;
}

@Injectable()
export class RegistrationRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findActivityById(maHD: number): Promise<ActivityInfo | null> {
    const rows = await this.db.query<ActivityInfo>(
      `SELECT MaHD, TenHoatDong, TgBatDau, TgKetThuc, HanDangKy, DiaDiem, SLToiDa, TrangThai
       FROM HOATDONGHOCTHUAT
       WHERE MaHD = @p1`,
      [maHD],
    );
    return rows[0] ?? null;
  }

  async assignSupport(
    maHD: number,
    maLop: number,
    soLuong: number,
    loaiPhanCong: string,
    nhiemVu: string | null = null,
  ): Promise<void> {
    await this.db.pool
      .request()
      .input('maHD', maHD)
      .input('maLop', maLop)
      .input('soLuong', soLuong)
      .input('loaiPhanCong', loaiPhanCong)
      .input('nhiemVu', nhiemVu)
      .query(
        `IF EXISTS (SELECT 1 FROM PHANCONGCOVU WHERE MaHD = @maHD AND MaLop = @maLop)
         BEGIN
           UPDATE PHANCONGCOVU 
           SET SoLuong = @soLuong, LoaiPhanCong = @loaiPhanCong, NhiemVu = @nhiemVu, NgayPhCong = SYSDATETIME()
           WHERE MaHD = @maHD AND MaLop = @maLop
         END
         ELSE
         BEGIN
           INSERT INTO PHANCONGCOVU(MaHD, MaLop, SoLuong, LoaiPhanCong, NhiemVu, NgayPhCong, TrangThai)
           VALUES(@maHD, @maLop, @soLuong, @loaiPhanCong, @nhiemVu, SYSDATETIME(), N'Chờ thực hiện')
         END`,
      );
  }
}
