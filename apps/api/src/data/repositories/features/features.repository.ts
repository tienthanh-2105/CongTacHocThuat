import { Inject, Injectable } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../../database.service';
import type { CreateExpenseDto, CreateSeminarDto } from '../../../presentation/features/features.dto';

@Injectable()
export class FeaturesRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async getMobileProfile(userId: string) {
    const rows = await this.db.query(
      `SELECT a.MaTK, a.TenDangNhap, n.MaNgDung, n.HoTen, n.Email, n.SDT, n.NgaySinh,
              s.MaSV, s.MSSV, l.MaLop, l.TenLop, l.KhoaHoc, k.MaKhoa, k.TenKhoa,
              COALESCE((SELECT SUM(drl.SoDiem) FROM DIEMRENLUYEN drl WHERE drl.MaSV = s.MaSV AND drl.TrangThai = N'Đã xác nhận'), 0) AS TongDiemRenLuyen
       FROM TAIKHOAN a
       LEFT JOIN NGUOIDUNG n ON n.MaNgDung = a.MaNgDung
       LEFT JOIN SINHVIEN s ON s.MaNgDung = n.MaNgDung
       LEFT JOIN LOP l ON l.MaLop = s.MaLop
       LEFT JOIN KHOA k ON k.MaKhoa = l.MaKhoa
       WHERE a.MaTK = @p1`, [userId]);
    return rows[0] ?? null;
  }

  async getMobileActivities(userId: string) {
    return this.db.query(
      `SELECT dk.MaDK, dk.MaHD, h.TenHoatDong, h.MoTa, h.TgBatDau, h.TgKetThuc, h.DiaDiem,
              dk.NgayDK, dk.HinhThuc, dk.TrangThai, s.MaSeminar, s.ChuDe,
              c.MaCThi, c.TenCuocThi
       FROM TAIKHOAN a
       JOIN SINHVIEN sv ON sv.MaNgDung = a.MaNgDung
       JOIN DKTHAMGIA dk ON dk.MaSV = sv.MaSV
       JOIN HOATDONGHOCTHUAT h ON h.MaHD = dk.MaHD
       LEFT JOIN SEMINAR s ON s.MaHD = h.MaHD
       LEFT JOIN CUOCTHI c ON c.MaHD = h.MaHD
       WHERE a.MaTK = @p1
       ORDER BY dk.NgayDK DESC`, [userId]);
  }

  async getMobileTrainingPoints(userId: string) {
    return this.db.query(
      `SELECT d.MaDiem, d.MaHD, h.TenHoatDong, d.HocKy, d.NamHoc, d.SoDiem, d.LyDo, d.TrangThai
       FROM TAIKHOAN a
       JOIN SINHVIEN sv ON sv.MaNgDung = a.MaNgDung
       JOIN DIEMRENLUYEN d ON d.MaSV = sv.MaSV
       JOIN HOATDONGHOCTHUAT h ON h.MaHD = d.MaHD
       WHERE a.MaTK = @p1
       ORDER BY d.NamHoc DESC, d.HocKy DESC, d.MaDiem DESC`, [userId]);
  }

  async getReminders(userId: string) {
    return this.db.query(
      `SELECT TOP (20) h.MaHD, h.TenHoatDong, h.TgBatDau, h.TgKetThuc, h.DiaDiem,
              DATEDIFF(MINUTE, SYSDATETIME(), h.TgBatDau) AS ConBaoNhieuPhut
       FROM TAIKHOAN a
       JOIN SINHVIEN sv ON sv.MaNgDung = a.MaNgDung
       JOIN DKTHAMGIA dk ON dk.MaSV = sv.MaSV
       JOIN HOATDONGHOCTHUAT h ON h.MaHD = dk.MaHD
       WHERE a.MaTK = @p1 AND dk.TrangThai IN (N'Đã đăng ký', N'Đã xác nhận')
         AND h.TgBatDau >= SYSDATETIME() AND h.TgBatDau < DATEADD(DAY, 8, SYSDATETIME())
       ORDER BY h.TgBatDau`, [userId]);
  }

  async listSeminars() {
    return this.db.query(
      `SELECT TOP (100) s.MaSeminar, s.MaHD, s.ChuDe, s.NoiDung, s.DoiTuongTG, s.ThoiLuong,
              s.DVChuTri, s.DVPhoiHop, h.TenHoatDong, h.MoTa, h.TgBatDau, h.TgKetThuc,
              h.HanDangKy, h.DiaDiem, h.SLToiDa, h.TrangThai
       FROM SEMINAR s JOIN HOATDONGHOCTHUAT h ON h.MaHD = s.MaHD
       ORDER BY h.TgBatDau DESC`);
  }

  async findSeminar(id: number) {
    const rows = await this.db.query(
      `SELECT s.MaSeminar, s.MaHD, s.ChuDe, s.NoiDung, s.DoiTuongTG, s.ThoiLuong,
              s.DVChuTri, s.DVPhoiHop, h.TenHoatDong, h.MoTa, h.TgBatDau, h.TgKetThuc,
              h.HanDangKy, h.DiaDiem, h.SLToiDa, h.TrangThai
       FROM SEMINAR s JOIN HOATDONGHOCTHUAT h ON h.MaHD = s.MaHD
       WHERE s.MaSeminar = @p1`, [id]);
    return rows[0] ?? null;
  }

  async findSeminarActivityId(id: number): Promise<number | null> {
    const rows = await this.db.query<{ MaHD: number }>('SELECT MaHD FROM SEMINAR WHERE MaSeminar = @p1', [id]);
    return rows[0]?.MaHD ?? null;
  }

  async activityExists(id: number): Promise<boolean> {
    const rows = await this.db.query<{ MaHD: number }>('SELECT MaHD FROM HOATDONGHOCTHUAT WHERE MaHD = @p1', [id]);
    return rows.length > 0;
  }

  async createSeminar(dto: CreateSeminarDto) {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const activityRequest = new sql.Request(transaction);
      activityRequest.input('name', sql.NVarChar(250), dto.tenHoatDong);
      activityRequest.input('description', sql.NVarChar(sql.MAX), dto.moTa ?? null);
      activityRequest.input('startsAt', sql.DateTime2, new Date(dto.tgBatDau));
      activityRequest.input('endsAt', sql.DateTime2, new Date(dto.tgKetThuc));
      activityRequest.input('registrationDeadline', sql.DateTime2, dto.hanDangKy ? new Date(dto.hanDangKy) : null);
      activityRequest.input('location', sql.NVarChar(255), dto.diaDiem ?? null);
      activityRequest.input('capacity', sql.Int, dto.slToiDa ?? null);
      const activity = await activityRequest.query<{ MaHD: number }>(
        `INSERT INTO HOATDONGHOCTHUAT(TenHoatDong, MoTa, TgBatDau, TgKetThuc, HanDangKy, DiaDiem, SLToiDa, TrangThai)
         OUTPUT INSERTED.MaHD VALUES(@name, @description, @startsAt, @endsAt, @registrationDeadline, @location, @capacity, N'Đã công bố')`);
      const maHD = activity.recordset[0].MaHD;
      const seminarRequest = new sql.Request(transaction);
      seminarRequest.input('activityId', sql.BigInt, maHD);
      seminarRequest.input('topic', sql.NVarChar(250), dto.chuDe);
      seminarRequest.input('content', sql.NVarChar(sql.MAX), dto.noiDung ?? null);
      seminarRequest.input('audience', sql.NVarChar(sql.MAX), dto.doiTuongTG ?? null);
      seminarRequest.input('duration', sql.Int, dto.thoiLuong ?? null);
      seminarRequest.input('hostUnit', sql.NVarChar(200), dto.dvChuTri ?? null);
      seminarRequest.input('coordinator', sql.NVarChar(200), dto.dvPhoiHop ?? null);
      const seminar = await seminarRequest.query<{ MaSeminar: number }>(
        `INSERT INTO SEMINAR(MaHD, ChuDe, NoiDung, DoiTuongTG, ThoiLuong, DVChuTri, DVPhoiHop)
         OUTPUT INSERTED.MaSeminar
         VALUES(@activityId, @topic, @content, @audience, @duration, @hostUnit, @coordinator)`);
      await transaction.commit();
      return this.findSeminar(seminar.recordset[0].MaSeminar);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async createExpense(accountId: string, dto: CreateExpenseDto) {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const headerRequest = new sql.Request(transaction);
      headerRequest.input('activityId', sql.BigInt, dto.maHD);
      headerRequest.input('accountId', sql.BigInt, accountId);
      const header = await headerRequest.query<{ MaHS: number }>(
        `SELECT TOP (1) MaHS FROM HOSOQUYETTOAN WITH (UPDLOCK, HOLDLOCK)
         WHERE MaHD = @activityId AND TrangThai = N'Dự thảo' ORDER BY MaHS DESC`);
      let settlementId = header.recordset[0]?.MaHS;
      if (!settlementId) {
        const createHeader = new sql.Request(transaction);
        createHeader.input('activityId', sql.BigInt, dto.maHD);
        createHeader.input('accountId', sql.BigInt, accountId);
        const createdHeader = await createHeader.query<{ MaHS: number }>(
          `INSERT INTO HOSOQUYETTOAN(MaHD, NguoiLap, TrangThai, NgayLap)
           OUTPUT INSERTED.MaHS VALUES(@activityId, @accountId, N'Dự thảo', SYSDATETIMEOFFSET())`);
        settlementId = createdHeader.recordset[0].MaHS;
      }
      const expenseRequest = new sql.Request(transaction);
      expenseRequest.input('activityId', sql.BigInt, dto.maHD);
      expenseRequest.input('settlementId', sql.BigInt, settlementId);
      expenseRequest.input('description', sql.NVarChar(sql.MAX), dto.noiDung);
      expenseRequest.input('amount', sql.Decimal(18, 2), dto.soTien);
      expenseRequest.input('spentOn', sql.Date, new Date(dto.ngChi));
      expenseRequest.input('accountId', sql.BigInt, accountId);
      expenseRequest.input('receipts', sql.NVarChar(sql.MAX), JSON.stringify(dto.chungTu ?? []));
      const expense = await expenseRequest.query<{ MaCP: number }>(
        `INSERT INTO CHIPHITHUCTE(MaHD, MaHS, NoiDung, SoTien, NgChi, NguoiGhi, ChungTu)
         OUTPUT INSERTED.MaCP VALUES(@activityId, @settlementId, @description, @amount, @spentOn, @accountId, @receipts)`);
      await transaction.commit();
      return { maCP: expense.recordset[0].MaCP, maHS: settlementId, maHD: dto.maHD };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getSettlement(activityId: number) {
    const headers = await this.db.query(
      `SELECT TOP (1) hs.MaHS, hs.MaHD, hs.NguoiLap, hs.NguoiDuyet, hs.TrangThai,
              hs.NgayLap, hs.NgayDuyet, hs.GhiChu, nguoiLap.HoTen AS TenNguoiLap,
              nguoiDuyet.HoTen AS TenNguoiDuyet
       FROM HOSOQUYETTOAN hs
       JOIN TAIKHOAN tkLap ON tkLap.MaTK = hs.NguoiLap
       LEFT JOIN NGUOIDUNG nguoiLap ON nguoiLap.MaNgDung = tkLap.MaNgDung
       LEFT JOIN TAIKHOAN tkDuyet ON tkDuyet.MaTK = hs.NguoiDuyet
       LEFT JOIN NGUOIDUNG nguoiDuyet ON nguoiDuyet.MaNgDung = tkDuyet.MaNgDung
       WHERE hs.MaHD = @p1 ORDER BY hs.MaHS DESC`, [activityId]);
    const expenses = await this.db.query(
      `SELECT cp.MaCP, cp.MaHD, cp.NoiDung, cp.SoTien, cp.NgChi, cp.NguoiGhi,
              nd.HoTen AS TenNguoiGhi
       FROM CHIPHITHUCTE cp
       LEFT JOIN TAIKHOAN tk ON tk.MaTK = cp.NguoiGhi
       LEFT JOIN NGUOIDUNG nd ON nd.MaNgDung = tk.MaNgDung
       WHERE cp.MaHD = @p1 AND (@p2 IS NULL OR cp.MaHS = @p2)
       ORDER BY cp.NgChi, cp.MaCP`, [activityId, headers[0]?.MaHS ?? null]);
    const total = expenses.reduce((sum, row) => sum + Number(row.SoTien), 0);
    return { activityId, settlement: headers[0] ?? null, expenses, totalAmount: total };
  }

  async approveSettlement(id: number, accountId: string) {
    const rows = await this.db.query(
      `UPDATE HOSOQUYETTOAN
       SET TrangThai = N'Đã duyệt', NguoiDuyet = @p2, NgayDuyet = SYSDATETIMEOFFSET()
       OUTPUT INSERTED.MaHS, INSERTED.MaHD, INSERTED.TrangThai, INSERTED.NgayDuyet
       WHERE MaHS = @p1 AND TrangThai IN (N'Dự thảo', N'Chờ duyệt')`, [id, accountId]);
    return rows[0] ?? null;
  }

  async getActivityReport(activityId: number) {
    const rows = await this.db.query(
      `SELECT h.MaHD, h.TenHoatDong, h.TgBatDau, h.TgKetThuc, h.DiaDiem, h.TrangThai,
              (SELECT COUNT(*) FROM DKTHAMGIA dk WHERE dk.MaHD = h.MaHD AND dk.TrangThai NOT IN (N'Đã hủy', N'Từ chối')) AS SoLuotDangKy,
              (SELECT COUNT(*) FROM DKTHAMGIA dk JOIN DIEMDANH dd ON dd.MaDK = dk.MaDK
               WHERE dk.MaHD = h.MaHD AND dd.TrangThai IN (N'Đã điểm danh', N'Đã xác nhận')) AS SoLuotDiemDanh,
              (SELECT COALESCE(SUM(cp.SoTien), 0) FROM CHIPHITHUCTE cp WHERE cp.MaHD = h.MaHD) AS TongChiPhi,
              (SELECT COUNT(*) FROM KETQUAHOCTHUAT kq JOIN CUOCTHI c ON c.MaCThi = kq.MaCThi
               WHERE c.MaHD = h.MaHD AND kq.TrangThai IN (N'Đã xác nhận', N'Đã công bố')) AS SoKetQuaCongBo
       FROM HOATDONGHOCTHUAT h WHERE h.MaHD = @p1`, [activityId]);
    if (!rows[0]) return null;
    const awards = await this.db.query(
      `SELECT kq.MaKQ, c.MaCThi, c.TenCuocThi, gt.TenGT, gt.CapGiai,
              kq.LoaiKQ, kq.XepHang, kq.Diem, kq.GhiChu
       FROM KETQUAHOCTHUAT kq
       JOIN CUOCTHI c ON c.MaCThi = kq.MaCThi
       LEFT JOIN GIAITHUONG gt ON gt.MaGT = kq.MaGT
       WHERE c.MaHD = @p1 AND kq.TrangThai IN (N'Đã xác nhận', N'Đã công bố')
       ORDER BY kq.XepHang, gt.TenGT`, [activityId]);
    return { ...rows[0], giaiThuongVaKetQua: awards };
  }
}
