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

export interface SupportAssignmentRecord {
  MaCoVu: number;
  MaHD: number;
  MaLop: number;
  TenLop: string;
  SoLuong: number;
  LoaiPhanCong: string;
  NhiemVu: string | null;
  NgayPhCong: Date | null;
  TrangThai: string | null;
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

  async getSupportAssignments(maHD: number): Promise<SupportAssignmentRecord[]> {
    const rows = await this.db.query<SupportAssignmentRecord>(
      `SELECT 
        pc.MaCoVu,
        pc.MaHD,
        pc.MaLop,
        l.TenLop,
        pc.SoLuong,
        pc.LoaiPhanCong,
        pc.NhiemVu,
        pc.NgayPhCong,
        pc.TrangThai
      FROM PHANCONGCOVU pc
      JOIN LOP l ON l.MaLop = pc.MaLop
      WHERE pc.MaHD = @p1
      ORDER BY l.TenLop`,
      [maHD],
    );
    return rows;
  }
}
