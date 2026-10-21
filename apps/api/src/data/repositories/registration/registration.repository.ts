import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database.service';

export interface StudentInfo {
  MaSV: number;
  MSSV: string;
  MaLop: number;
  HoTen: string;
  TenLop: string;
}

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

  async findActivityById(maHD: number): Promise<ActivityInfo | null> {
    const rows = await this.db.query<ActivityInfo>(
      `SELECT MaHD, TenHoatDong, TgBatDau, TgKetThuc, HanDangKy, DiaDiem, SLToiDa, TrangThai
       FROM HOATDONGHOCTHUAT
       WHERE MaHD = @p1`,
      [maHD],
    );
    return rows[0] ?? null;
  }

  async findRegistration(maHD: number, maSV: number) {
    const rows = await this.db.query(
      `SELECT MaDK, MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai
       FROM DKTHAMGIA
       WHERE MaHD = @p1 AND MaSV = @p2`,
      [maHD, maSV],
    );
    return rows[0] ?? null;
  }

  async countRegistrations(maHD: number): Promise<number> {
    const rows = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM DKTHAMGIA
       WHERE MaHD = @p1 AND TrangThai NOT IN (N'Từ chối', N'Đã hủy')`,
      [maHD],
    );
    return rows[0]?.total ?? 0;
  }

  async createIndividualRegistration(
    maHD: number,
    maSV: number,
    hinhThuc: string,
    nguonDK = 'Sinh viên',
    trangThai = 'Đã đăng ký',
  ): Promise<{ MaDK: number; NgayDK: Date }> {
    const rows = await this.db.query<{ MaDK: number; NgayDK: Date }>(
      `INSERT INTO DKTHAMGIA(MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai)
       OUTPUT INSERTED.MaDK, INSERTED.NgayDK
       VALUES(@p1, @p2, SYSDATETIME(), @p3, @p4, @p5)`,
      [maHD, maSV, hinhThuc, nguonDK, trangThai],
    );
    return rows[0];
  }
}
