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

export interface ActivityRegistrationDetail {
  MaDK: number;
  MaHD: number;
  MaSV: number;
  MSSV: string;
  HoTen: string;
  Email: string | null;
  SDT: string | null;
  TenLop: string;
  NgayDK: Date;
  HinhThuc: string;
  NguonDK: string;
  TrangThai: string;
  TenDoi: string | null;
  VaiTroDoi: string | null;
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

  async getRegistrationsByActivity(maHD: number): Promise<ActivityRegistrationDetail[]> {
    const rows = await this.db.query<ActivityRegistrationDetail>(
      `SELECT 
        dk.MaDK,
        dk.MaHD,
        dk.MaSV,
        s.MSSV,
        n.HoTen,
        n.Email,
        n.SDT,
        l.TenLop,
        dk.NgayDK,
        dk.HinhThuc,
        dk.NguonDK,
        dk.TrangThai,
        d.TenDoi,
        tv.VaiTro AS VaiTroDoi
      FROM DKTHAMGIA dk
      JOIN SINHVIEN s ON s.MaSV = dk.MaSV
      JOIN NGUOIDUNG n ON n.MaNgDung = s.MaNgDung
      JOIN LOP l ON l.MaLop = s.MaLop
      LEFT JOIN CUOCTHI c ON c.MaHD = dk.MaHD
      LEFT JOIN THANHVIENDOI tv ON tv.MaSV = s.MaSV
      LEFT JOIN DOITHI d ON d.MaDoi = tv.MaDoi AND d.MaCThi = c.MaCThi
      WHERE dk.MaHD = @p1
      ORDER BY dk.NgayDK DESC`,
      [maHD],
    );
    return rows;
  }
}
