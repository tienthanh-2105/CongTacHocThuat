import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database.service';

export interface StudentInfo {
  MaSV: number;
  MSSV: string;
  MaLop: number;
  HoTen: string;
  TenLop: string;
}

export interface RegistrationRecord {
  MaDK: number;
  MaHD: number;
  TenHoatDong: string;
  DiaDiem: string | null;
  TgBatDau: Date;
  TgKetThuc: Date;
  NgayDK: Date;
  HinhThuc: string;
  TrangThai: string;
  TenDoi: string | null;
  VaiTroDoi: string | null;
}

@Injectable()
export class RegistrationRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findStudentByUserId(userId: string | number): Promise<StudentInfo | null> {
    const rows = await this.db.query<StudentInfo>(
      `SELECT s.MaSV, s.MSSV, s.MaLop, n.HoTen, l.TenLop
       FROM TAIKHOAN a
       JOIN NGUOIDUNG n ON n.MaNgDung = a.MaNgDung
       JOIN SINHVIEN s ON s.MaNgDung = n.MaNgDung
       JOIN LOP l ON l.MaLop = s.MaLop
       WHERE a.MaTK = @p1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async getMyRegistrations(maSV: number): Promise<RegistrationRecord[]> {
    const rows = await this.db.query<RegistrationRecord>(
      `SELECT 
        dk.MaDK, 
        dk.MaHD, 
        h.TenHoatDong, 
        h.DiaDiem, 
        h.TgBatDau, 
        h.TgKetThuc, 
        dk.NgayDK, 
        dk.HinhThuc, 
        dk.TrangThai, 
        d.TenDoi, 
        tv.VaiTro AS VaiTroDoi
      FROM DKTHAMGIA dk
      JOIN HOATDONGHOCTHUAT h ON h.MaHD = dk.MaHD
      LEFT JOIN CUOCTHI c ON c.MaHD = h.MaHD
      LEFT JOIN THANHVIENDOI tv ON tv.MaSV = dk.MaSV
      LEFT JOIN DOITHI d ON d.MaDoi = tv.MaDoi AND d.MaCThi = c.MaCThi
      WHERE dk.MaSV = @p1
      ORDER BY dk.NgayDK DESC`,
      [maSV],
    );
    return rows;
  }
}
