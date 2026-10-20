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

  async findActivityById(maHD: number): Promise<ActivityInfo | null> {
    const rows = await this.db.query<ActivityInfo>(
      `SELECT MaHD, TenHoatDong, TgBatDau, TgKetThuc, HanDangKy, DiaDiem, SLToiDa, TrangThai
       FROM HOATDONGHOCTHUAT
       WHERE MaHD = @p1`,
      [maHD],
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
    nguonDK = "Sinh viên",
    trangThai = "Đã đăng ký",
  ): Promise<{ MaDK: number; NgayDK: Date }> {
    const rows = await this.db.query<{ MaDK: number; NgayDK: Date }>(
      `INSERT INTO DKTHAMGIA(MaHD, MaSV, NgayDK, HinhThuc, NguonDK, TrangThai)
       OUTPUT INSERTED.MaDK, INSERTED.NgayDK
       VALUES(@p1, @p2, SYSDATETIME(), @p3, @p4, @p5)`,
      [maHD, maSV, hinhThuc, nguonDK, trangThai],
    );
    return rows[0];
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
      // 1. Insert DOITHI
      const teamReq = new sql.Request(transaction);
      teamReq.input('maCThi', maCThi);
      teamReq.input('tenDoi', tenDoi);
      const teamRes = await teamReq.query<{ MaDoi: number }>(
        `INSERT INTO DOITHI(MaCThi, TenDoi)
         OUTPUT INSERTED.MaDoi
         VALUES(@maCThi, @tenDoi)`,
      );
      const maDoi = teamRes.recordset[0].MaDoi;

      // 2. Insert Captain into THANHVIENDOI
      const capReq = new sql.Request(transaction);
      capReq.input('maDoi', maDoi);
      capReq.input('maSV', captainMaSV);
      await capReq.query(
        `INSERT INTO THANHVIENDOI(MaDoi, MaSV, VaiTro) VALUES(@maDoi, @maSV, N'Trưởng đội')`,
      );

      // Register captain in DKTHAMGIA if not present
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

      // 3. Insert Members into THANHVIENDOI and DKTHAMGIA
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

  async updateRegistrationStatus(maDK: number, trangThai: string): Promise<boolean> {
    const result = await this.db.pool
      .request()
      .input('maDK', maDK)
      .input('trangThai', trangThai)
      .query(`UPDATE DKTHAMGIA SET TrangThai = @trangThai WHERE MaDK = @maDK`);
    return (result.rowsAffected[0] ?? 0) > 0;
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
