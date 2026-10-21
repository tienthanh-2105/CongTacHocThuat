import { Inject, Injectable } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../../database.service';

export interface StudentInfo {
  MaSV: number;
  MSSV: string;
  MaLop: number;
  HoTen: string;
  TenLop: string;
}

export interface CompetitionInfo {
  MaCThi: number;
  MaHD: number;
  TenCuocThi: string;
  HinhThucThi: string | null;
  TheLe: string;
  TenHoatDong: string;
  HanDangKy: Date | null;
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

  async findStudentByMssv(mssv: string): Promise<StudentInfo | null> {
    const rows = await this.db.query<StudentInfo>(
      `SELECT s.MaSV, s.MSSV, s.MaLop, n.HoTen, l.TenLop
       FROM SINHVIEN s
       JOIN NGUOIDUNG n ON n.MaNgDung = s.MaNgDung
       JOIN LOP l ON l.MaLop = s.MaLop
       WHERE s.MSSV = @p1`,
      [mssv],
    );
    return rows[0] ?? null;
  }

  async findCompetitionById(maCThi: number): Promise<CompetitionInfo | null> {
    const rows = await this.db.query<CompetitionInfo>(
      `SELECT c.MaCThi, c.MaHD, c.TenCuocThi, c.HinhThucThi, c.TheLe, h.TenHoatDong, h.HanDangKy, h.TrangThai
       FROM CUOCTHI c
       JOIN HOATDONGHOCTHUAT h ON h.MaHD = c.MaHD
       WHERE c.MaCThi = @p1`,
      [maCThi],
    );
    return rows[0] ?? null;
  }

  async findTeamByName(maCThi: number, tenDoi: string) {
    const rows = await this.db.query(
      `SELECT MaDoi, TenDoi FROM DOITHI WHERE MaCThi = @p1 AND TenDoi = @p2`,
      [maCThi, tenDoi],
    );
    return rows[0] ?? null;
  }

  async findStudentTeamInCompetition(maCThi: number, maSV: number) {
    const rows = await this.db.query<{ MaDoi: number; TenDoi: string; VaiTro: string }>(
      `SELECT d.MaDoi, d.TenDoi, tv.VaiTro
       FROM DOITHI d
       JOIN THANHVIENDOI tv ON tv.MaDoi = d.MaDoi
       WHERE d.MaCThi = @p1 AND tv.MaSV = @p2`,
      [maCThi, maSV],
    );
    return rows[0] ?? null;
  }

  async createTeamWithMembers(
    maCThi: number,
    maHD: number,
    tenDoi: string,
    captainMaSV: number,
    memberMaSVs: number[],
  ): Promise<{ maDoi: number; tenDoi: string; totalMembers: number }> {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();

    try {
      const teamReq = new sql.Request(transaction);
      teamReq.input('maCThi', maCThi);
      teamReq.input('tenDoi', tenDoi);
      const teamRes = await teamReq.query<{ MaDoi: number }>(
        `INSERT INTO DOITHI(MaCThi, TenDoi)
         OUTPUT INSERTED.MaDoi
         VALUES(@maCThi, @tenDoi)`,
      );
      const maDoi = teamRes.recordset[0].MaDoi;

      const capReq = new sql.Request(transaction);
      capReq.input('maDoi', maDoi);
      capReq.input('maSV', captainMaSV);
      await capReq.query(
        `INSERT INTO THANHVIENDOI(MaDoi, MaSV, VaiTro) VALUES(@maDoi, @maSV, N'Trưởng đội')`,
      );

      const capDkReq = new sql.Request(transaction);
      capDkReq.input('maHD', maHD);
      capDkReq.input('maSV', captainMaSV);
      await capDkReq.query(
        `IF NOT EXISTS (SELECT 1 FROM DKTHAMGIA WHERE MaHD = @maHD AND MaSV = @maSV)
         BEGIN
           INSERT INTO DKTHAMGIA(MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai)
           VALUES(@maHD, @maSV, SYSDATETIME(), N'Dự thi', N'Sinh viên', N'Đã đăng ký')
         END`,
      );

      for (const memberMaSV of memberMaSVs) {
        const memReq = new sql.Request(transaction);
        memReq.input('maDoi', maDoi);
        memReq.input('maSV', memberMaSV);
        await memReq.query(
          `INSERT INTO THANHVIENDOI(MaDoi, MaSV, VaiTro) VALUES(@maDoi, @maSV, N'Thành viên')`,
        );

        const memDkReq = new sql.Request(transaction);
        memDkReq.input('maHD', maHD);
        memDkReq.input('maSV', memberMaSV);
        await memDkReq.query(
          `IF NOT EXISTS (SELECT 1 FROM DKTHAMGIA WHERE MaHD = @maHD AND MaSV = @maSV)
           BEGIN
             INSERT INTO DKTHAMGIA(MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai)
             VALUES(@maHD, @maSV, SYSDATETIME(), N'Dự thi', N'Sinh viên', N'Đã đăng ký')
           END`,
        );
      }

      await transaction.commit();
      return { maDoi, tenDoi, totalMembers: 1 + memberMaSVs.length };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
