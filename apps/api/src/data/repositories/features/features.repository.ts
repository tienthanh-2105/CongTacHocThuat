import { Inject, Injectable } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../../database.service';
import type { CreateExpenseDto, CreateSeminarDto, UpdateSeminarDetailsDto } from '../../../presentation/features/features.dto';

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
      `SELECT dk.MaDK, dk.MaHD, h.TenHoatDong, h.NoiDung AS MoTa, h.TgBatDau, h.TgKetThuc, h.DiaDiem,
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
      `SELECT TOP(50) x.* FROM (
        SELECT h.MaHD,h.TenHoatDong,d.ThoiGianBatDau AS TgBatDau,d.ThoiGianKetThuc AS TgKetThuc,
          COALESCE(d.DiaDiem,h.DiaDiem) AS DiaDiem,d.HanDangKy,
          DATEDIFF(MINUTE,SYSDATETIME(),d.ThoiGianBatDau) AS ConBaoNhieuPhut,
          CASE WHEN d.ThoiGianBatDau<DATEADD(MINUTE,121,SYSDATETIME()) THEN N'Nhắc trước 2 giờ'
               WHEN d.ThoiGianBatDau<DATEADD(HOUR,25,SYSDATETIME()) THEN N'Nhắc trước 24 giờ' ELSE N'Hoạt động sắp tới' END AS LoaiNhac
        FROM TAIKHOAN a JOIN SINHVIEN sv ON sv.MaNgDung=a.MaNgDung JOIN DKTHAMGIA dk ON dk.MaSV=sv.MaSV
        JOIN HOATDONGHOCTHUAT h ON h.MaHD=dk.MaHD JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
        WHERE a.MaTK=@p1 AND dk.TrangThai IN(N'Đã đăng ký',N'Đã xác nhận') AND d.ThoiGianBatDau>=SYSDATETIME() AND d.ThoiGianBatDau<DATEADD(DAY,8,SYSDATETIME())
        UNION ALL
        SELECT h.MaHD,h.TenHoatDong,d.ThoiGianBatDau AS TgBatDau,d.ThoiGianKetThuc AS TgKetThuc,
          COALESCE(d.DiaDiem,h.DiaDiem) AS DiaDiem,d.HanDangKy,
          DATEDIFF(MINUTE,SYSDATETIME(),d.HanDangKy) AS ConBaoNhieuPhut,N'Hạn đăng ký sắp kết thúc' AS LoaiNhac
        FROM TAIKHOAN a JOIN SINHVIEN sv ON sv.MaNgDung=a.MaNgDung CROSS JOIN HOATDONGHOCTHUAT h
        JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
        WHERE a.MaTK=@p1 AND d.HanDangKy>=SYSDATETIME() AND d.HanDangKy<DATEADD(DAY,1,SYSDATETIME())
          AND h.TrangThai=N'Đã công bố' AND NOT EXISTS(SELECT 1 FROM DKTHAMGIA dk WHERE dk.MaHD=h.MaHD AND dk.MaSV=sv.MaSV AND dk.TrangThai NOT IN(N'Đã hủy',N'Từ chối'))
      ) x ORDER BY CASE WHEN x.LoaiNhac=N'Hạn đăng ký sắp kết thúc' THEN x.HanDangKy ELSE x.TgBatDau END`, [userId]);
  }

  async listMobileActivities() {
    return this.db.query(
      `SELECT TOP (100) h.MaHD,h.TenHoatDong,h.NoiDung,h.TgDuKien,
              COALESCE(d.ThoiGianBatDau,c.ThoiGian,s.ThoiGian,
                TRY_CONVERT(DATETIME2,REPLACE(h.TgDuKien,N'Ngày ',N''),103)) AS TgBatDau,
              COALESCE(d.ThoiGianBatDau,c.ThoiGian,s.ThoiGian,
                TRY_CONVERT(DATETIME2,REPLACE(h.TgDuKien,N'Ngày ',N''),103)) AS ThoiGianBatDau,
              d.ThoiGianKetThuc,COALESCE(h.HanDangKy,d.HanDangKy) AS HanDangKy,
              COALESCE(d.DiaDiem,s.DiaDiem,h.DiaDiem) AS DiaDiem,h.SLSVDuKien,h.TrangThai,
              d.TrangThai AS TrangThaiKeHoach,d.CongBoLuc,d.NguoiKyKhoa,d.NguoiKyCTSV,
              c.MaCThi,c.TenCuocThi,c.HinhThucThi,c.TheLe,s.MaSeminar,s.ChuDe,
              CAST(CASE WHEN d.TrangThai=N'Đã duyệt' AND d.NguoiKyKhoa IS NOT NULL
                     AND d.NguoiKyCTSV IS NOT NULL AND annual.TrangThai=N'Đã duyệt'
                     AND (h.HanDangKy IS NULL OR h.HanDangKy>SYSDATETIME())
                     THEN 1 ELSE 0 END AS BIT) AS CoTheDangKy
       FROM HOATDONGHOCTHUAT h
       LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
       LEFT JOIN KEHOACHHOCTHUAT annual ON annual.MaKeHoach=d.MaKeHoach
       LEFT JOIN CUOCTHI c ON c.MaHD=h.MaHD
       LEFT JOIN SEMINAR s ON s.MaHD=h.MaHD
       WHERE h.TrangThai=N'Đã công bố'
       ORDER BY COALESCE(d.ThoiGianBatDau,c.ThoiGian,s.ThoiGian,
                TRY_CONVERT(DATETIME2,REPLACE(h.TgDuKien,N'Ngày ',N''),103)) DESC,h.MaHD DESC`,
    );
  }

  async listMobileTopics() {
    return this.db.query(
      `SELECT t.MaDeTai,t.MaCThi,t.TenDeTai,t.LinhVuc,t.MoTa,t.GVHD,t.TrangThai,
              c.TenCuocThi,h.TenHoatDong,d.TenDoi
       FROM DETAI t
       JOIN CUOCTHI c ON c.MaCThi=t.MaCThi
       JOIN HOATDONGHOCTHUAT h ON h.MaHD=c.MaHD
       LEFT JOIN DOITHI d ON d.MaDoi=t.MaDoi
       WHERE h.TrangThai=N'Đã công bố'
       ORDER BY t.MaDeTai DESC`,
    );
  }

  async getMobileNotifications(userId: string) {
    await this.db.query(
      `INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung,GuiLuc)
       SELECT @p1,n.MaHD,CONCAT(N'Tin học thuật #',n.MaTin),n.TieuDe,n.NoiDung,COALESCE(n.CongBoLuc,n.NgayTao)
       FROM TINTUCHOCTHUAT n
       WHERE n.TrangThai=N'Đã công bố'
         AND NOT EXISTS(SELECT 1 FROM THONGBAO old WHERE old.MaTK=@p1 AND old.Loai=CONCAT(N'Tin học thuật #',n.MaTin))`,
      [userId],
    );
    return this.db.query(
      `SELECT TOP(100) MaThongBao,MaHD,Loai,TieuDe,NoiDung,GuiLuc,DocLuc
       FROM THONGBAO WHERE MaTK=@p1 ORDER BY GuiLuc DESC,MaThongBao DESC`,
      [userId],
    );
  }

  async listSeminars() {
    return this.db.query(
      `SELECT TOP (100) s.MaSeminar, s.MaHD, s.ChuDe, s.MucDich, s.NoiDung, s.DoiTuongTG, s.ThoiLuong,s.ChuongTrinh,
              s.DVChuTri, s.ThoiGian AS ThoiGianSeminar, COALESCE(d.DiaDiem, s.DiaDiem, h.DiaDiem) AS DiaDiem,
              h.TenHoatDong, h.NoiDung AS MoTa, h.TgDuKien, h.SLSVDuKien, h.TrangThai, d.ThoiGianBatDau, d.ThoiGianKetThuc, d.HanDangKy,
              (SELECT c.DienGia as hoTen, c.TenChuDe as chuDeTrinhBay FROM CHUDE c WHERE c.MaSeminar=s.MaSeminar FOR JSON PATH) AS DienGia,
              (SELECT t.MaTep,t.TenTep,t.UrlTep,t.LoaiTep FROM TEPSEMINAR t WHERE t.MaSeminar=s.MaSeminar FOR JSON PATH) AS TaiLieu
       FROM SEMINAR s JOIN HOATDONGHOCTHUAT h ON h.MaHD = s.MaHD LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
       ORDER BY h.TgBatDau DESC`);
  }

  async listActivities() {
    return this.db.query(
      `SELECT TOP (100) h.MaHD, h.TenHoatDong, h.NoiDung, h.TgDuKien,
              COALESCE(d.DiaDiem, s.DiaDiem, h.DiaDiem) AS DiaDiem, h.SLSVDuKien, h.TrangThai,
              d.MaKeHoach, d.TrangThai AS TrangThaiKeHoach, d.CongBoLuc, d.NguoiKyKhoa, d.NguoiKyCTSV,
              c.MaCThi, c.TenCuocThi, c.HinhThucThi, c.TheLe, d.ThoiGianBatDau, d.ThoiGianKetThuc, d.HanDangKy,
              s.MaSeminar, s.ChuDe, s.ThoiGian AS ThoiGianSeminar
       FROM HOATDONGHOCTHUAT h
       LEFT JOIN CUOCTHI c ON c.MaHD = h.MaHD
       LEFT JOIN SEMINAR s ON s.MaHD = h.MaHD
       LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
       WHERE ISNULL(h.TrangThai,N'') <> N'Đã hủy'
       ORDER BY h.MaHD DESC`,
    );
  }

  async findSeminar(id: number) {
    const rows = await this.db.query(
      `SELECT s.MaSeminar, s.MaHD, s.ChuDe, s.MucDich, s.NoiDung, s.DoiTuongTG, s.ThoiLuong,s.ChuongTrinh,
              s.DVChuTri, h.TenHoatDong, h.NoiDung AS MoTa, h.TgBatDau, h.TgKetThuc,
              h.HanDangKy, h.DiaDiem, h.SLToiDa, h.TrangThai,
              (SELECT c.DienGia as hoTen, c.TenChuDe as chuDeTrinhBay FROM CHUDE c WHERE c.MaSeminar=s.MaSeminar FOR JSON PATH) AS DienGia,
              (SELECT t.MaTep,t.TenTep,t.UrlTep,t.LoaiTep FROM TEPSEMINAR t WHERE t.MaSeminar=s.MaSeminar FOR JSON PATH) AS TaiLieu
       FROM SEMINAR s JOIN HOATDONGHOCTHUAT h ON h.MaHD = s.MaHD
       WHERE s.MaSeminar = @p1`, [id]);
    return rows[0] ?? null;
  }

  async findSeminarActivityId(id: number): Promise<number | null> {
    const rows = await this.db.query<{ MaHD: number }>('SELECT MaHD FROM SEMINAR WHERE MaSeminar = @p1', [id]);
    return rows[0]?.MaHD ?? null;
  }
  async updateSeminarDetails(accountId: string, admin: boolean, id: number, dto: UpdateSeminarDetailsDto) {
    return (await this.db.query(`UPDATE s SET DVChuTri=COALESCE(@p4,s.DVChuTri),
      ThoiLuong=COALESCE(@p5,s.ThoiLuong),ChuongTrinh=COALESCE(@p6,s.ChuongTrinh),NoiDung=COALESCE(@p7,s.NoiDung),MucDich=COALESCE(@p8,s.MucDich) OUTPUT INSERTED.*
      FROM SEMINAR s WHERE s.MaSeminar=@p1 AND (@p3=1
        OR EXISTS(SELECT 1 FROM BANTOCHUC b JOIN TAIKHOAN t ON t.MaNgDung=b.MaNgDung WHERE b.MaHD=s.MaHD AND t.MaTK=@p2)
        OR EXISTS(SELECT 1 FROM KEHOACHTOCHUC d CROSS APPLY OPENJSON(d.CacBan) WITH(loaiBan VARCHAR(30),thanhVien NVARCHAR(MAX) AS JSON) b
          CROSS APPLY OPENJSON(b.thanhVien) WITH(maTK BIGINT) m WHERE d.MaHD=s.MaHD AND b.loaiBan='TO_CHUC' AND m.maTK=@p2))`,
      [id,accountId,admin ? 1 : 0,dto.dvChuTri?.trim() ?? null,dto.thoiLuong ?? null,dto.chuongTrinh ? JSON.stringify(dto.chuongTrinh) : null,dto.noiDung?.trim() ?? null,dto.mucDich?.trim() ?? null]))[0] ?? null;
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
      activityRequest.input('description', sql.NVarChar(sql.MAX), dto.moTa ?? dto.noiDung ?? null);
      activityRequest.input('startsAt', sql.DateTime2, new Date(dto.tgBatDau));
      activityRequest.input('endsAt', sql.DateTime2, new Date(dto.tgKetThuc));
      activityRequest.input('registrationDeadline', sql.DateTime2, dto.hanDangKy ? new Date(dto.hanDangKy) : null);
      activityRequest.input('location', sql.NVarChar(255), dto.diaDiem ?? null);
      activityRequest.input('capacity', sql.Int, dto.slToiDa ?? 150);
      const activity = await activityRequest.query<{ MaHD: number }>(
        `INSERT INTO HOATDONGHOCTHUAT(TenHoatDong, MoTa, NoiDung, TgBatDau, TgKetThuc, HanDangKy, DiaDiem, SLToiDa, SLSVDuKien, TrangThai, LoaiHoatDong)
         OUTPUT INSERTED.MaHD VALUES(@name, @description, @description, @startsAt, @endsAt, @registrationDeadline, @location, @capacity, @capacity, N'Đã công bố', N'Seminar')`);
      const maHD = activity.recordset[0].MaHD;

      const keHoachRequest = new sql.Request(transaction);
      keHoachRequest.input('activityId', sql.BigInt, maHD);
      keHoachRequest.input('name', sql.NVarChar(250), dto.tenHoatDong);
      keHoachRequest.input('startsAt', sql.DateTime2, new Date(dto.tgBatDau));
      keHoachRequest.input('endsAt', sql.DateTime2, new Date(dto.tgKetThuc));
      keHoachRequest.input('registrationDeadline', sql.DateTime2, dto.hanDangKy ? new Date(dto.hanDangKy) : null);
      keHoachRequest.input('location', sql.NVarChar(255), dto.diaDiem ?? null);
      await keHoachRequest.query(
        `INSERT INTO KEHOACHTOCHUC(MaHD, TenKeHoach, ThoiGianBatDau, ThoiGianKetThuc, HanDangKy, DiaDiem, TrangThai, CongBoLuc)
         VALUES(@activityId, @name, @startsAt, @endsAt, @registrationDeadline, @location, N'Đã duyệt', SYSDATETIMEOFFSET())`);

      const seminarRequest = new sql.Request(transaction);
      seminarRequest.input('activityId', sql.BigInt, maHD);
      seminarRequest.input('topic', sql.NVarChar(250), dto.chuDe || dto.tenHoatDong);
      seminarRequest.input('content', sql.NVarChar(sql.MAX), dto.noiDung ?? null);
      seminarRequest.input('audience', sql.NVarChar(sql.MAX), dto.doiTuongTG ?? 'Sinh viên Khoa CNTT');
      seminarRequest.input('duration', sql.Int, dto.thoiLuong ?? 240);
      seminarRequest.input('hostUnit', sql.NVarChar(200), dto.dvChuTri ?? 'Khoa Công nghệ Thông tin');
      seminarRequest.input('location', sql.NVarChar(255), dto.diaDiem ?? null);
      seminarRequest.input('capacity', sql.Int, dto.slToiDa ?? 150);
      seminarRequest.input('agenda', sql.NVarChar(sql.MAX), JSON.stringify(dto.chuongTrinh ?? []));
      const seminar = await seminarRequest.query<{ MaSeminar: number }>(
        `INSERT INTO SEMINAR(MaHD, ChuDe, NoiDung, DoiTuongTG, ThoiLuong, DVChuTri, DiaDiem, SLSVDuKien, ChuongTrinh)
         OUTPUT INSERTED.MaSeminar
         VALUES(@activityId, @topic, @content, @audience, @duration, @hostUnit, @location, @capacity, @agenda)`);
      const maSeminar = seminar.recordset[0].MaSeminar;

      if (Array.isArray(dto.dienGia) && dto.dienGia.length > 0) {
        for (let i = 0; i < dto.dienGia.length; i++) {
          const sp = dto.dienGia[i];
          if (!sp.hoTen) continue;
          const speakerRequest = new sql.Request(transaction);
          speakerRequest.input('seminarId', sql.BigInt, maSeminar);
          speakerRequest.input('stt', sql.Int, i + 1);
          speakerRequest.input('topic', sql.NVarChar(255), sp.chuDeTrinhBay ?? `Báo cáo chuyên đề ${i + 1}`);
          speakerRequest.input('speaker', sql.NVarChar(255), sp.donVi ? `${sp.hoTen} – ${sp.donVi}` : sp.hoTen);
          await speakerRequest.query(
            `INSERT INTO CHUDE(MaSeminar, STT, TenChuDe, DienGia) VALUES(@seminarId, @stt, @topic, @speaker)`);
        }
      }

      const notificationRequest = new sql.Request(transaction);
      notificationRequest.input('activityId', sql.BigInt, maHD);
      notificationRequest.input('title', sql.NVarChar(250), dto.tenHoatDong);
      await notificationRequest.query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
        SELECT DISTINCT tk.MaTK,@activityId,N'Hoạt động mới',@title,
          CONCAT(N'Seminar học thuật mới đã được công bố. Thời gian: ',CONVERT(nvarchar(30),h.TgBatDau,126),N'; địa điểm: ',COALESCE(h.DiaDiem,N'Chưa cập nhật'))
        FROM TAIKHOAN tk JOIN SINHVIEN sv ON sv.MaNgDung=tk.MaNgDung JOIN HOATDONGHOCTHUAT h ON h.MaHD=@activityId`);
      await transaction.commit();
      return this.findSeminar(maSeminar);
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
        `DECLARE @expenseKeys TABLE(MaCP BIGINT);
         INSERT INTO CHIPHITHUCTE(MaHD, MaHS, NoiDung, SoTien, NgChi, NguoiGhi, ChungTu)
         OUTPUT INSERTED.MaCP INTO @expenseKeys VALUES(@activityId, @settlementId, @description, @amount, @spentOn, @accountId, @receipts);
         SELECT MaCP FROM @expenseKeys;`);
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
      `SELECT cp.MaCP, cp.MaHD, cp.NoiDung, cp.SoTien, cp.NgChi, cp.NguoiGhi,cp.ChungTu,
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
       WHERE MaHS = @p1 AND TrangThai = N'Chờ duyệt'`, [id, accountId]);
    return rows[0] ?? null;
  }

  async submitSettlement(id: number, accountId: string) {
    const rows = await this.db.query(
      `UPDATE HOSOQUYETTOAN SET TrangThai=N'Chờ duyệt'
       OUTPUT INSERTED.MaHS,INSERTED.MaHD,INSERTED.TrangThai
       WHERE MaHS=@p1 AND NguoiLap=@p2 AND TrangThai=N'Dự thảo'
         AND EXISTS(SELECT 1 FROM CHIPHITHUCTE cp WHERE cp.MaHS=HOSOQUYETTOAN.MaHS)`, [id,accountId]);
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
    const attendees = await this.db.query(
      `SELECT dk.MaDK,s.MSSV,nd.HoTen,l.TenLop,dk.NgayDK,dk.TrangThai AS TrangThaiDangKy,
              dd.BatDauLuc,dd.TrangThai AS TrangThaiDiemDanh
       FROM DKTHAMGIA dk JOIN SINHVIEN s ON s.MaSV=dk.MaSV JOIN NGUOIDUNG nd ON nd.MaNgDung=s.MaNgDung
       JOIN LOP l ON l.MaLop=s.MaLop LEFT JOIN DIEMDANH dd ON dd.MaDK=dk.MaDK
       WHERE dk.MaHD=@p1 AND dk.TrangThai NOT IN(N'Đã hủy',N'Từ chối') ORDER BY l.TenLop,nd.HoTen`,[activityId]);
    return { ...rows[0], danhSachThamDu: attendees, giaiThuongVaKetQua: awards };
  }
}
