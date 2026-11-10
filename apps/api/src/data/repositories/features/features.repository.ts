import { ConflictException, Inject, Injectable } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../../database.service';
import type { CreateExpenseDto, CreateSeminarDto, CreateSettlementReportDto, UpdateSeminarDetailsDto } from '../../../presentation/features/features.dto';

const trainingPointsLockedSql = `CASE WHEN h.TrangThai=N'Đã công bố' OR d.CongBoLuc IS NOT NULL
  OR (d.MaKHToChuc IS NOT NULL AND d.TrangThai NOT IN(N'Chờ phân công thực hiện',N'Cần lập ban đề thi',N'Dự thảo',N'Cần bổ sung',N'Từ chối'))
  THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END`;

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

  async listMobileActivities(studentId: number | string, allowAfterDeadline: boolean) {
    return this.db.query(
      `SELECT TOP (100) h.MaHD,h.TenHoatDong,h.LoaiHoatDong,h.NoiDung,h.TgDuKien,
              schedule.StartsAt AS TgBatDau,schedule.StartsAt AS ThoiGianBatDau,
              d.ThoiGianKetThuc,COALESCE(h.HanDangKy,d.HanDangKy) AS HanDangKy,
              COALESCE(d.DiaDiem,s.DiaDiem,h.DiaDiem) AS DiaDiem,h.SLSVDuKien,h.BanThamGia,h.TrangThai,
              TRY_CONVERT(INT,NULLIF(h.SLSVDuKien,N'')) AS SLToiDa,
              COALESCE((SELECT SUM(k.SoTien) FROM KINHPHIHOATDONG k WHERE k.MaHD=h.MaHD),0) AS KinhPhiDuTru,
              d.TrangThai AS TrangThaiKeHoach,d.CongBoLuc,d.NguoiKyKhoa,d.NguoiKyCTSV,
              c.MaCThi,c.TenCuocThi,c.HinhThucThi,c.TheLe,s.MaSeminar,s.ChuDe,
              (SELECT COUNT(*) FROM DKTHAMGIA dk WHERE dk.MaHD=h.MaHD
                AND dk.TrangThai NOT IN(N'Đã hủy',N'Từ chối')) AS SoLuongDangKy,
              CASE WHEN EXISTS (SELECT 1 FROM DKTHAMGIA dk WHERE dk.MaHD=h.MaHD AND dk.MaSV=@p1
                AND dk.TrangThai NOT IN(N'Đã hủy',N'Từ chối')) THEN N'Đã đăng ký'
                WHEN EXISTS (SELECT 1 FROM HANGDOICHODANGKY q WHERE q.MaHD=h.MaHD AND q.MaSV=@p1
                AND q.TrangThai IN(N'Đang chờ',N'Đã mời')) THEN N'Đang chờ'
              END AS TrangThaiDangKyCuaToi,
              CAST(CASE WHEN d.TrangThai=N'Đã duyệt' AND d.NguoiKyKhoa IS NOT NULL
                     AND d.NguoiKyCTSV IS NOT NULL AND annual.TrangThai=N'Đã duyệt'
                     AND (@p2=1 OR h.HanDangKy IS NULL OR h.HanDangKy>SYSDATETIME())
                     THEN 1 ELSE 0 END AS BIT) AS CoTheDangKy
       FROM HOATDONGHOCTHUAT h
       LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
       LEFT JOIN KEHOACHHOCTHUAT annual ON annual.MaKeHoach=d.MaKeHoach
       LEFT JOIN CUOCTHI c ON c.MaHD=h.MaHD
       LEFT JOIN SEMINAR s ON s.MaHD=h.MaHD
       CROSS APPLY (SELECT COALESCE(d.ThoiGianBatDau,c.ThoiGian,
         TRY_CONVERT(DATETIME2,s.ThoiGian,121),
         TRY_CONVERT(DATETIME2,REPLACE(h.TgDuKien,N'Ngày ',N''),103)) AS StartsAt) schedule
       WHERE h.TrangThai=N'Đã công bố'
       ORDER BY schedule.StartsAt DESC,h.MaHD DESC`,
      [studentId, allowAfterDeadline ? 1 : 0],
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

  async listSeminars(includeUnpublished = false, managementOnly = false) {
    return this.db.query(
      `SELECT TOP (100) s.MaSeminar, h.MaHD, s.ChuDe, s.MucDich, s.NoiDung, s.DoiTuongTG, s.ThoiLuong,s.ChuongTrinh,
              s.DVChuTri, s.ThoiGian AS ThoiGianSeminar, COALESCE(d.DiaDiem, s.DiaDiem, h.DiaDiem) AS DiaDiem,
              COALESCE(d.DiemRenLuyen,s.DiemRenLuyenDeXuat) AS DiemRenLuyen, ${trainingPointsLockedSql} AS DiemRenLuyenDaKhoa,
              h.TenHoatDong, h.LoaiHoatDong, h.NoiDung AS MoTa, h.TgDuKien, h.SLSVDuKien, h.BanThamGia, h.NguoiLap,
              TRY_CONVERT(INT,NULLIF(h.SLSVDuKien,N'')) AS SLToiDa,
              COALESCE((SELECT SUM(k.SoTien) FROM KINHPHIHOATDONG k WHERE k.MaHD=h.MaHD),0) AS KinhPhiDuTru,
              CASE WHEN d.TrangThai=N'Đã duyệt' AND d.NguoiKyKhoa IS NOT NULL AND d.NguoiKyCTSV IS NOT NULL THEN N'Đã duyệt' ELSE COALESCE(d.TrangThai,h.TrangThai) END AS TrangThai,
              d.ThoiGianBatDau, d.ThoiGianKetThuc, COALESCE(d.HanDangKy,h.HanDangKy) AS HanDangKy,
              (SELECT c.DienGia as hoTen, c.TenChuDe as chuDeTrinhBay FROM CHUDE c WHERE c.MaSeminar=s.MaSeminar FOR JSON PATH) AS DienGia,
              (SELECT t.MaTep,t.TenTep,t.UrlTep,t.LoaiTep FROM TEPSEMINAR t WHERE t.MaSeminar=s.MaSeminar FOR JSON PATH) AS TaiLieu
       FROM HOATDONGHOCTHUAT h LEFT JOIN SEMINAR s ON s.MaHD = h.MaHD LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
       WHERE (s.MaSeminar IS NOT NULL OR h.LoaiHoatDong LIKE N'%Seminar%')
         AND (@p1=1 OR (d.TrangThai=N'Đã duyệt' AND d.NguoiKyKhoa IS NOT NULL AND d.NguoiKyCTSV IS NOT NULL))
         AND (@p2=0 OR s.TaoTuQuanLy=1 OR s.DaDangThongBao=1)
       ORDER BY CASE WHEN @p2=1 THEN h.MaHD END DESC, h.TgBatDau DESC`, [includeUnpublished ? 1 : 0, managementOnly ? 1 : 0]);
  }

  async includeAnnouncedSeminar(activityId: number, transaction: sql.Transaction) {
    await new sql.Request(transaction).input('activityId', sql.BigInt, activityId).query(`
      INSERT INTO SEMINAR(MaHD,ChuDe,NoiDung,DoiTuongTG,ThoiGian,DiaDiem,SLSVDuKien,DaDangThongBao)
      SELECT h.MaHD,h.TenHoatDong,COALESCE(d.NoiDung,h.NoiDung),h.DoiTuongThamDu,
        CASE WHEN d.ThoiGianBatDau IS NULL AND h.TgBatDau IS NOT NULL
          THEN CONCAT(CONVERT(CHAR(5),h.TgBatDau,108),N' ',LEFT(h.TgDuKien,219)) END,
        COALESCE(d.DiaDiem,h.DiaDiem),TRY_CONVERT(INT,NULLIF(h.SLSVDuKien,N'')),1
      FROM HOATDONGHOCTHUAT h
      LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
      WHERE h.MaHD=@activityId AND h.LoaiHoatDong=N'Seminar'
        AND NOT EXISTS (SELECT 1 FROM SEMINAR s WITH(UPDLOCK,HOLDLOCK) WHERE s.MaHD=h.MaHD);

      UPDATE s SET DaDangThongBao=1
      FROM SEMINAR s JOIN HOATDONGHOCTHUAT h ON h.MaHD=s.MaHD
      WHERE s.MaHD=@activityId AND h.LoaiHoatDong=N'Seminar' AND s.DaDangThongBao=0;
    `);
  }

  async listActivities() {
    return this.db.query(
      `SELECT TOP (100) h.MaHD, h.TenHoatDong, h.NamHoc, h.NoiDung, h.TgDuKien,
              COALESCE(d.DiaDiem, s.DiaDiem, h.DiaDiem) AS DiaDiem, h.SLSVDuKien, h.BanThamGia, h.TrangThai,
              TRY_CONVERT(INT,NULLIF(h.SLSVDuKien,N'')) AS SLToiDa,
              COALESCE((SELECT SUM(k.SoTien) FROM KINHPHIHOATDONG k WHERE k.MaHD=h.MaHD),0) AS KinhPhiDuTru,
              d.MaKeHoach, d.TrangThai AS TrangThaiKeHoach, d.CongBoLuc, d.NguoiKyKhoa, d.NguoiKyCTSV,
              c.MaCThi, c.TenCuocThi, c.HinhThucThi, c.TheLe, c.DoiTuongTG, c.GiaiThuong, COALESCE(d.DiemRenLuyen,s.DiemRenLuyenDeXuat) AS DiemRenLuyen,
              d.ThoiGianBatDau, d.ThoiGianKetThuc, d.HanDangKy,
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
              s.DVChuTri, s.ThoiGian AS ThoiGianSeminar, h.TenHoatDong, h.NoiDung AS MoTa, h.TgBatDau, h.TgKetThuc, h.TgDuKien, h.NguoiLap,
              COALESCE(d.DiemRenLuyen,s.DiemRenLuyenDeXuat) AS DiemRenLuyen, ${trainingPointsLockedSql} AS DiemRenLuyenDaKhoa,
              h.HanDangKy, h.DiaDiem, TRY_CONVERT(INT,NULLIF(h.SLSVDuKien,N'')) AS SLToiDa, h.TrangThai,
              COALESCE((SELECT SUM(k.SoTien) FROM KINHPHIHOATDONG k WHERE k.MaHD=h.MaHD),0) AS KinhPhiDuTru,
              h.BanThamGia,
              (SELECT c.DienGia as hoTen, c.TenChuDe as chuDeTrinhBay FROM CHUDE c WHERE c.MaSeminar=s.MaSeminar FOR JSON PATH) AS DienGia,
              (SELECT t.MaTep,t.TenTep,t.UrlTep,t.LoaiTep FROM TEPSEMINAR t WHERE t.MaSeminar=s.MaSeminar FOR JSON PATH) AS TaiLieu
       FROM SEMINAR s JOIN HOATDONGHOCTHUAT h ON h.MaHD = s.MaHD
       LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
       WHERE s.MaSeminar = @p1`, [id]);
    return rows[0] ?? null;
  }

  async findSeminarActivityId(id: number): Promise<number | null> {
    const rows = await this.db.query<{ MaHD: number }>('SELECT MaHD FROM SEMINAR WHERE MaSeminar = @p1', [id]);
    return rows[0]?.MaHD ?? null;
  }
  async updateSeminarDetails(accountId: string, admin: boolean, id: number, dto: UpdateSeminarDetailsDto) {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const access = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('accountId', sql.BigInt, accountId)
        .input('admin', sql.Bit, admin)
        .query<{ MaHD: number; DiemRenLuyen: number | null; DiemRenLuyenDaKhoa: boolean }>(`SELECT s.MaHD,COALESCE(d.DiemRenLuyen,s.DiemRenLuyenDeXuat) AS DiemRenLuyen,
          ${trainingPointsLockedSql} AS DiemRenLuyenDaKhoa
          FROM SEMINAR s JOIN HOATDONGHOCTHUAT h WITH(UPDLOCK,HOLDLOCK) ON h.MaHD=s.MaHD
          LEFT JOIN KEHOACHTOCHUC d WITH(UPDLOCK,HOLDLOCK) ON d.MaHD=h.MaHD
          WHERE s.MaSeminar=@id AND (@admin=1
            OR (s.TaoTuQuanLy=1 AND h.NguoiLap=@accountId)
            OR EXISTS(SELECT 1 FROM BANTOCHUC b JOIN TAIKHOAN t ON t.MaNgDung=b.MaNgDung WHERE b.MaHD=s.MaHD AND t.MaTK=@accountId)
            OR EXISTS(SELECT 1 FROM KEHOACHTOCHUC planAuth CROSS APPLY OPENJSON(planAuth.CacBan) WITH(loaiBan VARCHAR(30),thanhVien NVARCHAR(MAX) AS JSON) b
              CROSS APPLY OPENJSON(b.thanhVien) WITH(maTK BIGINT) m WHERE planAuth.MaHD=s.MaHD AND b.loaiBan='TO_CHUC' AND m.maTK=@accountId))`);
      const current = access.recordset[0];
      if (!current) {
        await transaction.commit();
        return null;
      }

      if (dto.diemRenLuyen !== undefined && current.DiemRenLuyenDaKhoa
          && (current.DiemRenLuyen === null || Number(dto.diemRenLuyen) !== Number(current.DiemRenLuyen))) {
        throw new ConflictException('Kế hoạch seminar đã được duyệt hoặc công bố nên không thể thay đổi quyền lợi điểm rèn luyện.');
      }

      const request = new sql.Request(transaction);
      request.input('id', sql.Int, id);
      request.input('dvChuTri', sql.NVarChar(200), dto.dvChuTri?.trim() ?? null);
      request.input('thoiLuong', sql.Int, dto.thoiLuong ?? null);
      request.input('chuongTrinh', sql.NVarChar(sql.MAX), dto.chuongTrinh ? JSON.stringify(dto.chuongTrinh) : null);
      request.input('noiDung', sql.NVarChar(sql.MAX), dto.noiDung?.trim() ?? null);
      request.input('mucDich', sql.NVarChar(sql.MAX), dto.mucDich?.trim() ?? null);
      request.input('diemRenLuyen', sql.Decimal(5, 2), dto.diemRenLuyen ?? null);
      const rows = await request.query(`UPDATE s SET DVChuTri=COALESCE(@dvChuTri,s.DVChuTri),
        ThoiLuong=COALESCE(@thoiLuong,s.ThoiLuong),ChuongTrinh=COALESCE(@chuongTrinh,s.ChuongTrinh),
        NoiDung=COALESCE(@noiDung,s.NoiDung),MucDich=COALESCE(@mucDich,s.MucDich),
        DiemRenLuyenDeXuat=CASE WHEN @diemRenLuyen IS NOT NULL AND NOT EXISTS(
          SELECT 1 FROM KEHOACHTOCHUC d WHERE d.MaHD=s.MaHD) AND (${trainingPointsLockedSql})=CAST(0 AS BIT)
          THEN @diemRenLuyen ELSE s.DiemRenLuyenDeXuat END
        OUTPUT INSERTED.* FROM SEMINAR s JOIN HOATDONGHOCTHUAT h ON h.MaHD=s.MaHD
        LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD WHERE s.MaSeminar=@id`);
      if (dto.diemRenLuyen !== undefined && !current.DiemRenLuyenDaKhoa) {
        await new sql.Request(transaction)
          .input('activityId', sql.BigInt, current.MaHD)
          .input('points', sql.Decimal(5, 2), dto.diemRenLuyen)
          .query(`UPDATE KEHOACHTOCHUC SET DiemRenLuyen=@points WHERE MaHD=@activityId
            AND TrangThai IN(N'Chờ phân công thực hiện',N'Cần lập ban đề thi',N'Dự thảo',N'Cần bổ sung',N'Từ chối')
            AND CongBoLuc IS NULL`);
      }
      await transaction.commit();
      return rows.recordset[0] ?? null;
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }

  async activityExists(id: number): Promise<boolean> {
    const rows = await this.db.query<{ MaHD: number }>('SELECT MaHD FROM HOATDONGHOCTHUAT WHERE MaHD = @p1', [id]);
    return rows.length > 0;
  }

  async createSeminar(dto: CreateSeminarDto, accountId: string) {
    const startsAt = new Date(dto.tgBatDau);
    const endsAt = new Date(dto.tgKetThuc);
    const localDateTime = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23',
    });
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    let maSeminar: number;
    try {
      const activityRequest = new sql.Request(transaction);
      activityRequest.input('name', sql.NVarChar(250), dto.tenHoatDong);
      activityRequest.input('description', sql.NVarChar(sql.MAX), dto.moTa ?? dto.noiDung ?? null);
      activityRequest.input('startsAt', sql.DateTime2, startsAt);
      activityRequest.input('endsAt', sql.DateTime2, endsAt);
      activityRequest.input('registrationDeadline', sql.DateTime2, dto.hanDangKy ? new Date(dto.hanDangKy) : null);
      activityRequest.input('location', sql.NVarChar(255), dto.diaDiem ?? null);
      activityRequest.input('capacity', sql.Int, dto.slToiDa ?? 150);
      activityRequest.input('owner', sql.BigInt, accountId);
      const activity = await activityRequest.query<{ MaHD: number }>(
        `INSERT INTO HOATDONGHOCTHUAT(TenHoatDong, NoiDung, TgDuKien, TgBatDau, TgKetThuc, HanDangKy, DiaDiem, SLSVDuKien, TrangThai, LoaiHoatDong, NguoiLap)
         OUTPUT INSERTED.MaHD VALUES(@name, @description, CONVERT(CHAR(10), DATEADD(HOUR,7,@startsAt), 23),
         CAST(DATEADD(HOUR,7,@startsAt) AS TIME), CAST(DATEADD(HOUR,7,@endsAt) AS TIME), @registrationDeadline, @location,
         CONVERT(NVARCHAR(225),@capacity), N'Dự thảo', N'Seminar', @owner)`);
      const maHD = activity.recordset[0].MaHD;

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
      seminarRequest.input('schedule', sql.NVarChar(225), `${localDateTime.format(startsAt)} – ${localDateTime.format(endsAt)}`);
      const seminar = await seminarRequest.query<{ MaSeminar: number }>(
        `INSERT INTO SEMINAR(MaHD, ChuDe, NoiDung, DoiTuongTG, ThoiLuong, DVChuTri, DiaDiem, SLSVDuKien, ChuongTrinh, ThoiGian, TaoTuQuanLy)
         OUTPUT INSERTED.MaSeminar
         VALUES(@activityId, @topic, @content, @audience, @duration, @hostUnit, @location, @capacity, @agenda, @schedule, 1)`);
      maSeminar = seminar.recordset[0].MaSeminar;

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

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    return this.findSeminar(maSeminar);
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
      expenseRequest.input('budgetLineId', sql.BigInt, dto.maKPHD ?? null);
      expenseRequest.input('budgetItem', sql.NVarChar(500), dto.hangMucDuTru?.trim() || null);
      expenseRequest.input('settlementId', sql.BigInt, settlementId);
      expenseRequest.input('description', sql.NVarChar(sql.MAX), dto.noiDung);
      expenseRequest.input('amount', sql.Decimal(18, 2), dto.soTien);
      expenseRequest.input('quantity', sql.Decimal(10, 2), dto.soLuong ?? null);
      expenseRequest.input('unit', sql.NVarChar(50), dto.donViTinh?.trim() || null);
      expenseRequest.input('spentOn', sql.Date, new Date(dto.ngChi));
      expenseRequest.input('accountId', sql.BigInt, accountId);
      expenseRequest.input('explanation', sql.NVarChar(500), dto.thuyetMinh?.trim() || null);
      expenseRequest.input('receipts', sql.NVarChar(sql.MAX), JSON.stringify(dto.chungTu ?? []));
      const expense = await expenseRequest.query<{ MaCP: number }>(
        `DECLARE @expenseKeys TABLE(MaCP BIGINT);
         INSERT INTO CHIPHITHUCTE(MaHD, MaHS, MaKPHD, HangMucDuTru, NoiDung, SoLuong, DonViTinh, SoTien, NgChi, NguoiGhi, ThuyetMinh, ChungTu)
         OUTPUT INSERTED.MaCP INTO @expenseKeys VALUES(@activityId, @settlementId, @budgetLineId, @budgetItem, @description, @quantity, @unit, @amount, @spentOn, @accountId, @explanation, @receipts);
         SELECT MaCP FROM @expenseKeys;`);
      await transaction.commit();
      return { maCP: expense.recordset[0].MaCP, maHS: settlementId, maHD: dto.maHD };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async activityBudgetLineExists(lineId: number, activityId: number) {
    const rows = await this.db.query('SELECT 1 AS found FROM KINHPHIHOATDONG WHERE MaKPHD=@p1 AND MaHD=@p2', [lineId,activityId]);
    return rows.length > 0;
  }

  async canManageActivitySettlement(accountId: string, activityId: number) {
    const rows = await this.db.query(
      `SELECT TOP (1) 1 AS allowed FROM HOATDONGHOCTHUAT h
       JOIN KEHOACHTOCHUC activityPlan ON activityPlan.MaHD=h.MaHD
       JOIN DUTRUKINHPHI budget ON budget.MaHD=h.MaHD AND budget.TrangThai=N'Đã duyệt'
       WHERE h.MaHD=@p1
         AND activityPlan.NguoiKyKhoa IS NOT NULL AND activityPlan.NgayKyKhoa IS NOT NULL
         AND activityPlan.TrangThai IN (N'Đã duyệt',N'Chờ CTSV ký')
         AND (h.NguoiLap=CAST(@p2 AS INT) OR EXISTS (
           SELECT 1 FROM PHANCONGTHUCHIEN task
           JOIN TAIKHOAN account ON account.MaNgDung=task.MaNgDung
           WHERE task.MaHD=h.MaHD AND account.MaTK=CAST(@p2 AS INT)
             AND (task.NoiDung LIKE N'%kinh phí%' OR task.NoiDung LIKE N'%quyết toán%'
               OR task.NoiDung LIKE N'%thanh toán%' OR task.NoiDung LIKE N'%chi phí%'
               OR task.NoiDung LIKE N'%hồ sơ%')
         ))`, [activityId,accountId]);
    return rows.length > 0;
  }

  async listSettlementActivitiesForUser(accountId: string, includeAll = false) {
    return this.db.query(
      `SELECT h.MaHD,h.TenHoatDong,h.NamHoc
       FROM HOATDONGHOCTHUAT h
       WHERE (@p1=1 OR h.NguoiLap=TRY_CONVERT(INT,@p2) OR EXISTS (
         SELECT 1 FROM PHANCONGTHUCHIEN task
         JOIN TAIKHOAN account ON account.MaNgDung=task.MaNgDung
         WHERE task.MaHD=h.MaHD AND account.MaTK=TRY_CONVERT(INT,@p2)
           AND (task.NoiDung LIKE N'%kinh phí%' OR task.NoiDung LIKE N'%quyết toán%'
             OR task.NoiDung LIKE N'%thanh toán%' OR task.NoiDung LIKE N'%chi phí%'
             OR task.NoiDung LIKE N'%hồ sơ%')
       ))
         AND EXISTS (
           SELECT 1 FROM KEHOACHTOCHUC activityPlan
           WHERE activityPlan.MaHD=h.MaHD AND activityPlan.NguoiKyKhoa IS NOT NULL AND activityPlan.NgayKyKhoa IS NOT NULL
             AND activityPlan.TrangThai IN (N'Đã duyệt',N'Chờ CTSV ký')
             AND EXISTS (SELECT 1 FROM DUTRUKINHPHI budget WHERE budget.MaHD=h.MaHD AND budget.TrangThai=N'Đã duyệt')
         )
       ORDER BY h.NamHoc DESC,h.TenHoatDong`, [includeAll ? 1 : 0,accountId]);
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
      `SELECT cp.MaCP, cp.MaHD, cp.MaKPHD, cp.HangMucDuTru, cp.NoiDung, cp.SoLuong, cp.DonViTinh, cp.SoTien, cp.NgChi, cp.NguoiGhi,cp.ThuyetMinh,cp.ChungTu,
              nd.HoTen AS TenNguoiGhi
       FROM CHIPHITHUCTE cp
       LEFT JOIN TAIKHOAN tk ON tk.MaTK = cp.NguoiGhi
       LEFT JOIN NGUOIDUNG nd ON nd.MaNgDung = tk.MaNgDung
       WHERE cp.MaHD = @p1 AND (@p2 IS NULL OR cp.MaHS = @p2)
       ORDER BY cp.NgChi, cp.MaCP`, [activityId, headers[0]?.MaHS ?? null]);
    const total = expenses.reduce((sum, row) => sum + Number(row.SoTien), 0);
    return { activityId, settlement: headers[0] ?? null, expenses, totalAmount: total };
  }

  async updateExpense(expenseId: number, accountId: string, dto: import('../../../presentation/features/features.dto').UpdateExpenseDto) {
    const rows = await this.db.query(
      `DECLARE @updatedExpense TABLE(MaCP BIGINT,MaHD BIGINT,MaKPHD BIGINT NULL);
       UPDATE expense SET MaKPHD=@p1,NoiDung=@p2,SoLuong=@p10,DonViTinh=@p11,SoTien=@p3,NgChi=@p4,ThuyetMinh=@p5,ChungTu=@p6,HangMucDuTru=@p12
       OUTPUT INSERTED.MaCP,INSERTED.MaHD,INSERTED.MaKPHD INTO @updatedExpense
       FROM CHIPHITHUCTE expense
       JOIN HOSOQUYETTOAN hs ON hs.MaHS=expense.MaHS AND hs.TrangThai=N'Dự thảo' AND hs.NguoiLap=@p7
       WHERE expense.MaCP=@p8 AND expense.MaHD=@p9
         AND (@p1 IS NULL OR EXISTS(SELECT 1 FROM KINHPHIHOATDONG kp WHERE kp.MaKPHD=@p1 AND kp.MaHD=expense.MaHD));
       SELECT MaCP,MaHD,MaKPHD FROM @updatedExpense;`,
      [dto.maKPHD ?? null,dto.noiDung,dto.soTien,new Date(dto.ngChi),dto.thuyetMinh?.trim()||null,JSON.stringify(dto.chungTu??[]),accountId,expenseId,dto.maHD,dto.soLuong??null,dto.donViTinh?.trim()||null,dto.hangMucDuTru?.trim()||null]);
    return rows[0] ?? null;
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

  async canManageSettlement(accountId: string, settlementId: number) {
    const rows = await this.db.query(
      `SELECT TOP (1) 1 AS allowed FROM HOSOQUYETTOAN hs
       JOIN HOATDONGHOCTHUAT h ON h.MaHD=hs.MaHD
       WHERE hs.MaHS=@p1 AND hs.NguoiLap=@p2 AND hs.TrangThai=N'Dự thảo'
         AND (h.NguoiLap=CAST(@p2 AS INT) OR EXISTS (SELECT 1 FROM PHANCONGTHUCHIEN task
           JOIN TAIKHOAN account ON account.MaNgDung=task.MaNgDung
           WHERE task.MaHD=hs.MaHD AND account.MaTK=@p2
             AND (task.NoiDung LIKE N'%kinh phí%' OR task.NoiDung LIKE N'%quyết toán%'
               OR task.NoiDung LIKE N'%thanh toán%' OR task.NoiDung LIKE N'%chi phí%'
               OR task.NoiDung LIKE N'%hồ sơ%')))` , [settlementId,accountId]);
    return rows.length > 0;
  }

  async listSettlementReports(accountId: string, includeAll = false) {
    return this.db.query(
      `SELECT report.MaBC,report.MaHD,activity.TenHoatDong,activity.NamHoc,
              report.NguoiLap,person.HoTen AS TenNguoiLap,report.NgayLap,
              report.TongDuToan,report.TongThucThi,report.TongChenhLech,
              (SELECT COUNT(*) FROM OPENJSON(report.CacDong)) AS SoDong,report.CacDong
       FROM BAOCAOQUYETTOAN report
       JOIN HOATDONGHOCTHUAT activity ON activity.MaHD=report.MaHD
       JOIN TAIKHOAN account ON account.MaTK=report.NguoiLap
       LEFT JOIN NGUOIDUNG person ON person.MaNgDung=account.MaNgDung
       WHERE @p1=1 OR report.NguoiLap=TRY_CONVERT(BIGINT,@p2) OR EXISTS (
         SELECT 1 FROM PHANCONGTHUCHIEN task
         JOIN TAIKHOAN assignedAccount ON assignedAccount.MaNgDung=task.MaNgDung
         WHERE task.MaHD=report.MaHD AND assignedAccount.MaTK=TRY_CONVERT(BIGINT,@p2)
           AND (task.NoiDung LIKE N'%kinh phí%' OR task.NoiDung LIKE N'%quyết toán%'
             OR task.NoiDung LIKE N'%thanh toán%' OR task.NoiDung LIKE N'%chi phí%' OR task.NoiDung LIKE N'%hồ sơ%')
       )
       ORDER BY report.NgayLap DESC,report.MaBC DESC`, [includeAll ? 1 : 0, accountId]);
  }

  async createSettlementReport(accountId: string, dto: CreateSettlementReportDto) {
    const lines = dto.cacDong.map((line, index) => ({
      stt: index + 1,
      noiDungThucHien: line.noiDungThucHien.trim(),
      duToan: line.duToan,
      thucThi: line.thucThi,
      chenhLech: Number((line.thucThi - line.duToan).toFixed(2)),
      ghiChu: line.ghiChu?.trim() ?? '',
    }));
    const totalBudget = Number(lines.reduce((sum, line) => sum + line.duToan, 0).toFixed(2));
    const totalActual = Number(lines.reduce((sum, line) => sum + line.thucThi, 0).toFixed(2));
    const totalDifference = Number((totalActual - totalBudget).toFixed(2));
    const rows = await this.db.query(
      `DECLARE @created TABLE(MaBC BIGINT);
       INSERT INTO BAOCAOQUYETTOAN(MaHD,NguoiLap,CacDong,TongDuToan,TongThucThi,TongChenhLech)
       OUTPUT INSERTED.MaBC INTO @created
       VALUES(@p1,@p2,@p3,@p4,@p5,@p6);
       SELECT report.MaBC,report.MaHD,activity.TenHoatDong,activity.NamHoc,
              report.NguoiLap,person.HoTen AS TenNguoiLap,report.NgayLap,
              report.TongDuToan,report.TongThucThi,report.TongChenhLech,
              (SELECT COUNT(*) FROM OPENJSON(report.CacDong)) AS SoDong,report.CacDong
       FROM BAOCAOQUYETTOAN report JOIN @created created ON created.MaBC=report.MaBC
       JOIN HOATDONGHOCTHUAT activity ON activity.MaHD=report.MaHD
       JOIN TAIKHOAN account ON account.MaTK=report.NguoiLap
       LEFT JOIN NGUOIDUNG person ON person.MaNgDung=account.MaNgDung;`,
      [dto.maHD, accountId, JSON.stringify(lines), totalBudget, totalActual, totalDifference],
    );
    return rows[0] ?? null;
  }

  async getActivityReport(activityId: number) {
    const rows = await this.db.query(
      `SELECT h.MaHD, h.TenHoatDong, h.TgBatDau, h.TgKetThuc, h.DiaDiem, h.TrangThai,
              (SELECT COUNT(*) FROM DKTHAMGIA dk WHERE dk.MaHD = h.MaHD AND dk.TrangThai NOT IN (N'Đã hủy', N'Từ chối')) AS SoLuotDangKy,
              (SELECT COUNT(*) FROM DKTHAMGIA dk JOIN DIEMDANH dd ON dd.MaDK = dk.MaDK
               WHERE dk.MaHD = h.MaHD AND dd.TrangThai IN (N'Đã điểm danh', N'Đã xác nhận')) AS SoLuotDiemDanh,
              (SELECT COALESCE(SUM(cp.SoTien), 0) FROM CHIPHITHUCTE cp JOIN HOSOQUYETTOAN hs ON hs.MaHS=cp.MaHS WHERE cp.MaHD = h.MaHD AND hs.TrangThai=N'Đã duyệt') AS TongChiPhi,
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
