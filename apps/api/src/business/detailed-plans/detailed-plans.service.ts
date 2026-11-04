import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../../data/database.service';
import type { SessionContext } from '../auth/auth.types';
import type { ReviewDetailedPlanDto, SaveDetailedPlanDto } from '../../presentation/detailed-plans/detailed-plans.dto';
import { readPlanCommittees, validatePlanCommittees } from './plan-committees';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const readerRoles = ['ADMIN','GIANGVIEN','TRUONGBOMON','CANBOKHOA','TRUONGKHOA','PHONGCTSV','PHONGKHCN','HIEUTRUONG','BANTOCHUC'];
const editableStatuses = ['Chờ phân công thực hiện', 'Cần lập ban đề thi', 'Dự thảo', 'Cần bổ sung', 'Từ chối'];

export function formatAcademicTitle(hocVi?: string | null): string {
  if (!hocVi) return '';
  const norm = (hocVi + '')
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('pho giao su') || norm.includes('pgs')) {
    if (norm.includes('tien si') || norm.includes('ts')) return 'PGS.TS.';
    return 'PGS.';
  }
  if (norm.includes('giao su') || norm.includes('gs')) {
    if (norm.includes('tien si') || norm.includes('ts')) return 'GS.TS.';
    return 'GS.';
  }
  if (norm.includes('tien si') || norm.includes('ts')) {
    return 'TS.';
  }
  if (norm.includes('thac si') || norm.includes('ths')) {
    return 'ThS.';
  }
  if (norm.includes('ky su') || norm.includes('ks')) {
    return 'KS.';
  }
  if (norm.includes('cu nhan') || norm.includes('cn')) {
    return 'CN.';
  }
  return '';
}

export function formatTeacherName(hoTen: string, hocVi?: string | null): string {
  if (!hoTen) return '';
  const prefix = formatAcademicTitle(hocVi);
  if (!prefix) return hoTen;
  if (/^(PGS\.TS\.|GS\.TS\.|PGS\.|GS\.|TS\.|ThS\.|KS\.|CN\.)\s+/i.test(hoTen)) {
    return hoTen;
  }
  return `${prefix} ${hoTen}`;
}

type ReviewAction = ReviewDetailedPlanDto['action'];
type Faculty = { MaKhoa: number; TenKhoa: string };
type DetailedPlan = {
  MaHD: number; TenHoatDong: string; LoaiHoatDong: string; NamHoc: string | null;
  MaBM: number | null; TenBM: string | null; MaKhoa: number; MaKeHoach: number; TenKeHoachNam: string;
  TrangThaiHoatDong: string; NoiDungHoatDong: string | null; DoiTuongThamDu: string | null; SLSVDuKien: number | null;
  MaKHToChuc: number | null; TenKeHoach: string | null; NoiDung: string | null; TheLe: string | null; TieuChiCham: string | null;
  HinhThucThi: string | null; ThoiGianBatDau: Date | null; ThoiGianKetThuc: Date | null; HanDangKy: Date | null;
  DiaDiem: string | null; DiemRenLuyen: number | null; TrangThai: string | null; NguoiLap: number | null;
  NguoiKyKhoa: number | null; NgayKyKhoa: Date | null; NguoiKyCTSV: number | null; NgayKyCTSV: Date | null;
  LichSuDuyet: string | null; CongBoLuc: Date | null; MaCThi: number | null; MaSeminar: number | null;
  TongDuToan: number; TrangThaiDuTru: string | null; CacBan: string | null;
};

export function detailedPlanReviewStage(status: string, roles: string[], action: ReviewAction) {
  const roleKeys = roles.map(normalize);
  const stage = (status === 'Chờ khoa xét duyệt' || status === 'Chờ khoa ký') ? 'faculty' : status === 'Chờ CTSV ký' ? 'student-affairs' : null;
  if (!stage) throw new BadRequestException('Kế hoạch chi tiết không ở bước chờ ký hoặc xét duyệt');
  const requiredRole = stage === 'faculty' ? 'TRUONGKHOA' : 'PHONGCTSV';
  if (!roleKeys.includes('ADMIN') && !roleKeys.includes(requiredRole) && !roleKeys.includes('CANBOKHOA')) {
    throw new ForbiddenException(stage === 'faculty' ? 'Kế hoạch đang chờ Khoa xét duyệt' : 'Kế hoạch đang chờ Phòng CTSV ký');
  }
  if (!['approve','request_changes','reject'].includes(action)) throw new BadRequestException('Thao tác duyệt không hợp lệ');
  return {
    stage,
    status: action === 'approve' ? (status === 'Chờ khoa xét duyệt' ? 'Đã duyệt' : (stage === 'faculty' ? 'Chờ CTSV ký' : 'Đã duyệt')) : action === 'request_changes' ? 'Cần bổ sung' : 'Từ chối',
  };
}

export function validateDetailedPlanDates(dto: SaveDetailedPlanDto, fallbackName = '', fallbackContent = '', fallbackStart?: Date | null, fallbackEnd?: Date | null, fallbackDeadline?: Date | null) {
  let start: Date;
  if (dto.thoiGianBatDau && Number.isFinite(new Date(dto.thoiGianBatDau).getTime())) {
    start = new Date(dto.thoiGianBatDau);
  } else if (dto.thoiGian && Number.isFinite(new Date(dto.thoiGian).getTime())) {
    start = new Date(dto.thoiGian);
  } else if (fallbackStart && Number.isFinite(new Date(fallbackStart).getTime())) {
    start = new Date(fallbackStart);
  } else {
    start = new Date();
  }

  let end: Date;
  if (dto.thoiGianKetThuc && Number.isFinite(new Date(dto.thoiGianKetThuc).getTime())) {
    end = new Date(dto.thoiGianKetThuc);
  } else if (fallbackEnd && Number.isFinite(new Date(fallbackEnd).getTime()) && new Date(fallbackEnd) > start) {
    end = new Date(fallbackEnd);
  } else {
    end = new Date(start.getTime() + 2 * 3600 * 1000);
  }

  if (end <= start) throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
  const deadline = dto.hanDangKy && Number.isFinite(new Date(dto.hanDangKy).getTime())
    ? new Date(dto.hanDangKy)
    : (fallbackDeadline && Number.isFinite(new Date(fallbackDeadline).getTime()) ? new Date(fallbackDeadline) : null);
  if (deadline && deadline > start) {
    throw new BadRequestException('Hạn đăng ký phải trước hoặc bằng thời gian bắt đầu');
  }
  const name = (dto.tenCuocThi || dto.tenKeHoach || dto.chuDe || fallbackName).trim();
  const content = (dto.noiDung || dto.mucDich || fallbackContent).trim();
  if (!name || !content) throw new BadRequestException('Cần nhập tên/chủ đề và nội dung/mục đích kế hoạch chi tiết');
  return { start, end, deadline, name, content };
}

@Injectable()
export class DetailedPlansService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private hasRole(context: SessionContext, roles: string[]) { return context.user.roles.some(role => roles.includes(normalize(role))); }
  private requireRole(context: SessionContext, roles: string[]) {
    if (!this.hasRole(context, roles)) throw new ForbiddenException('Bạn không có quyền thực hiện chức năng này');
  }
  private async query<T>(statement: string, params: unknown[] = [], transaction?: sql.Transaction): Promise<T[]> {
    if (!transaction) return this.db.query<T>(statement, params);
    const request = new sql.Request(transaction);
    params.forEach((param, index) => request.input(`p${index + 1}`, param));
    return (await request.query<T>(statement)).recordset;
  }
  private async inTransaction<T>(work: (transaction: sql.Transaction) => Promise<T>): Promise<T> {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await work(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }
  private async faculty() {
    const faculties = await this.query<Faculty>('SELECT MaKhoa,TenKhoa FROM KHOA ORDER BY MaKhoa');
    const allowed = ['Công nghệ thông tin','Khoa Công nghệ thông tin','CNTT','Khoa CNTT'].map(normalize);
    const matches = faculties.filter(row => allowed.includes(normalize(row.TenKhoa)));
    if (matches.length !== 1) throw new ServiceUnavailableException('Cần cấu hình duy nhất Khoa Công nghệ thông tin để lập kế hoạch chi tiết');
    return matches[0];
  }
  private activityQuery(lock: boolean) {
    const hint = lock ? 'WITH(UPDLOCK,HOLDLOCK)' : '';
    return `SELECT h.MaHD,h.TenHoatDong,h.LoaiHoatDong,h.NamHoc,
      COALESCE(h.MaBM,gv.MaBM) AS MaBM,bm.TenBM,p.MaKhoa,p.MaKeHoach,p.TenKeHoach AS TenKeHoachNam,
      h.TrangThai AS TrangThaiHoatDong,h.NoiDung AS NoiDungHoatDong,h.DoiTuongThamDu,
      TRY_CONVERT(INT,NULLIF(h.SLSVDuKien,N'')) AS SLSVDuKien,
      d.MaKHToChuc,d.TenKeHoach,d.NoiDung,d.TheLe,d.TieuChiCham,d.HinhThucThi,
      d.ThoiGianBatDau,d.ThoiGianKetThuc,d.HanDangKy,d.DiaDiem,d.DiemRenLuyen,d.TrangThai,d.NguoiLap,d.CacBan,
      d.NguoiKyKhoa,d.NgayKyKhoa,d.NguoiKyCTSV,d.NgayKyCTSV,d.LichSuDuyet,d.CongBoLuc,
      c.MaCThi,s.MaSeminar,COALESCE(budget.TongKinhPhi,0) AS TongDuToan,budget.TrangThai AS TrangThaiDuTru
      FROM HOATDONGHOCTHUAT h ${hint}
      JOIN KEHOACHHOCTHUAT p ${hint} ON p.MaKeHoach=COALESCE(h.MaKeHoachKhoa,h.MaKeHoach)
      LEFT JOIN TAIKHOAN owner ON owner.MaTK=h.NguoiLap
      LEFT JOIN GIANGVIEN gv ON gv.MaNgDung=owner.MaNgDung
      LEFT JOIN BOMON bm ON bm.MaBM=COALESCE(h.MaBM,gv.MaBM)
      LEFT JOIN KEHOACHTOCHUC d ${hint} ON d.MaHD=h.MaHD
      OUTER APPLY(SELECT TOP(1) MaCThi FROM CUOCTHI WHERE MaHD=h.MaHD ORDER BY MaCThi) c
      OUTER APPLY(SELECT TOP(1) MaSeminar FROM SEMINAR WHERE MaHD=h.MaHD ORDER BY MaSeminar) s
      OUTER APPLY(SELECT TOP(1) TongKinhPhi,TrangThai FROM DUTRUKINHPHI WHERE MaHD=h.MaHD ORDER BY MaDuTruKP DESC) budget
      WHERE p.MaKhoa=@p1 AND p.TrangThai=N'Đã duyệt' AND p.LoaiKeHoach IN(N'KHOA',N'Khoa')
        AND h.TrangThai IN(N'Đã duyệt',N'Đã công bố')`;
  }
  private async activity(activityId: number, faculty: Faculty, transaction?: sql.Transaction) {
    const row = (await this.query<DetailedPlan>(`${this.activityQuery(Boolean(transaction))} AND h.MaHD=@p2`, [faculty.MaKhoa, activityId], transaction))[0];
    if (!row) throw new NotFoundException('Hoạt động chưa thuộc kế hoạch năm học CNTT đã được duyệt');
    return row;
  }
  private async requireDepartment(context: SessionContext, departmentId: number | null, transaction?: sql.Transaction) {
    if (this.hasRole(context, ['ADMIN'])) return;
    if (!departmentId) throw new BadRequestException('Hoạt động cần được phân công cho một bộ môn');
    const rows = await this.query<{ ok: number }>(`SELECT TOP(1) 1 AS ok FROM TAIKHOAN t
      JOIN GIANGVIEN gv ON gv.MaNgDung=t.MaNgDung
      WHERE t.MaTK=@p1 AND (gv.MaBM=@p2 OR EXISTS(SELECT 1 FROM GIANGVIEN_BOMON link WHERE link.MaGV=gv.MaGV AND link.MaBM=@p2))`, [context.userId, departmentId], transaction);
    if (!rows.length) throw new ForbiddenException('Bạn chỉ được lập kế hoạch chi tiết cho bộ môn được phân công');
  }
  private assertEditable(row: DetailedPlan) {
    if (row.CongBoLuc || row.TrangThaiHoatDong === 'Đã công bố') throw new BadRequestException('Hoạt động đã công bố; không thể sửa kế hoạch đã ký');
    if (row.MaKHToChuc && !editableStatuses.includes(row.TrangThai ?? '')) throw new BadRequestException('Chỉ sửa được kế hoạch dự thảo, cần bổ sung hoặc bị từ chối');
  }
  private assertDocument(row: DetailedPlan) {
    if (!row.MaKHToChuc) throw new BadRequestException('Hãy lập và lưu kế hoạch chi tiết trước');
  }
  private staff(facultyId: number, transaction?: sql.Transaction) {
    return this.query<{ MaTK: number; MaNgDung: number; HoTen: string; MaBM: number | null; TenBM: string | null; HocVi: string | null; ChucDanh: string; ChucVu: string | null }>(`
      SELECT t.MaTK, t.MaNgDung, n.HoTen, bm.MaBM, bm.TenBM, gv.HocVi,
             COALESCE(cb.ChucVu, CASE WHEN gv.HocVi IS NOT NULL THEN gv.HocVi ELSE N'Giảng viên' END) AS ChucDanh,
             cb.ChucVu
      FROM TAIKHOAN t
      JOIN NGUOIDUNG n ON n.MaNgDung = t.MaNgDung
      LEFT JOIN GIANGVIEN gv ON gv.MaNgDung = n.MaNgDung
      LEFT JOIN BOMON bm ON bm.MaBM = gv.MaBM
      LEFT JOIN CANBOKHOA cb ON cb.MaNgDung = n.MaNgDung AND cb.MaKhoa = @p1
      WHERE t.TrangThai = N'Hoạt động'
        AND (bm.MaKhoa = @p1 OR cb.MaKhoa = @p1 OR EXISTS (
          SELECT 1 FROM GIANGVIEN_BOMON link JOIN BOMON linked ON linked.MaBM = link.MaBM WHERE link.MaGV = gv.MaGV AND linked.MaKhoa = @p1))
      ORDER BY n.HoTen, t.MaTK`, [facultyId], transaction);
  }
  private isDepartmentRestricted(context: SessionContext) {
    return !this.hasRole(context, ['ADMIN', 'CANBOKHOA', 'TRUONGKHOA', 'PHONGCTSV', 'PHONGKHCN', 'HIEUTRUONG']);
  }
  async list(context: SessionContext) {
    this.requireRole(context, readerRoles);
    const faculty = await this.faculty();
    const isFacultyWide = !this.isDepartmentRestricted(context);
    const rows = await this.query<DetailedPlan & { canManage: number }>(
      `SELECT h.MaHD,h.TenHoatDong,h.LoaiHoatDong,h.NamHoc,
        COALESCE(h.MaBM,gv.MaBM) AS MaBM,bm.TenBM,p.MaKhoa,p.MaKeHoach,p.TenKeHoach AS TenKeHoachNam,
        h.TrangThai AS TrangThaiHoatDong,h.NoiDung AS NoiDungHoatDong,h.DoiTuongThamDu,
        TRY_CONVERT(INT,NULLIF(h.SLSVDuKien,N'')) AS SLSVDuKien,
        d.MaKHToChuc,d.TenKeHoach,d.NoiDung,d.TheLe,d.TieuChiCham,d.HinhThucThi,
        d.ThoiGianBatDau,d.ThoiGianKetThuc,d.HanDangKy,d.DiaDiem,d.DiemRenLuyen,d.TrangThai,d.NguoiLap,d.CacBan,
        d.NguoiKyKhoa,d.NgayKyKhoa,d.NguoiKyCTSV,d.NgayKyCTSV,d.LichSuDuyet,d.CongBoLuc,
        c.MaCThi,s.MaSeminar,COALESCE(budget.TongKinhPhi,0) AS TongDuToan,budget.TrangThai AS TrangThaiDuTru,
        CASE WHEN @p2 = 1
          OR COALESCE(h.MaBM, gv.MaBM) IN (
            SELECT gv0.MaBM FROM GIANGVIEN gv0 JOIN TAIKHOAN t0 ON t0.MaNgDung=gv0.MaNgDung WHERE t0.MaTK=@p3 AND gv0.MaBM IS NOT NULL
            UNION
            SELECT gb0.MaBM FROM GIANGVIEN gv0 JOIN TAIKHOAN t0 ON t0.MaNgDung=gv0.MaNgDung JOIN GIANGVIEN_BOMON gb0 ON gb0.MaGV=gv0.MaGV WHERE t0.MaTK=@p3
          )
          OR EXISTS (SELECT 1 FROM BANTOCHUC b0 JOIN TAIKHOAN t0 ON t0.MaNgDung=b0.MaNgDung WHERE b0.MaHD=h.MaHD AND t0.MaTK=@p3)
          OR EXISTS (
            SELECT 1 FROM KEHOACHTOCHUC d0
            CROSS APPLY OPENJSON(d0.CacBan) WITH(loaiBan VARCHAR(30), thanhVien NVARCHAR(MAX) AS JSON) b0
            CROSS APPLY OPENJSON(b0.thanhVien) WITH(maTK BIGINT) m0
            WHERE d0.MaHD=h.MaHD AND m0.maTK=@p3
          )
          OR EXISTS (
            SELECT 1 FROM PHANCONGTHUCHIEN p0 JOIN TAIKHOAN t0 ON t0.MaNgDung=p0.MaNgDung
            WHERE p0.MaHD=h.MaHD AND t0.MaTK=@p3
          )
        THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS canManage
        FROM HOATDONGHOCTHUAT h
        JOIN KEHOACHHOCTHUAT p ON p.MaKeHoach=COALESCE(h.MaKeHoachKhoa,h.MaKeHoach)
        LEFT JOIN TAIKHOAN owner ON owner.MaTK=h.NguoiLap
        LEFT JOIN GIANGVIEN gv ON gv.MaNgDung=owner.MaNgDung
        LEFT JOIN BOMON bm ON bm.MaBM=COALESCE(h.MaBM,gv.MaBM)
        LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
        OUTER APPLY(SELECT TOP(1) MaCThi FROM CUOCTHI WHERE MaHD=h.MaHD ORDER BY MaCThi) c
        OUTER APPLY(SELECT TOP(1) MaSeminar FROM SEMINAR WHERE MaHD=h.MaHD ORDER BY MaSeminar) s
        OUTER APPLY(SELECT TOP(1) TongKinhPhi,TrangThai FROM DUTRUKINHPHI WHERE MaHD=h.MaHD ORDER BY MaDuTruKP DESC) budget
        WHERE p.MaKhoa=@p1 AND p.TrangThai=N'Đã duyệt' AND p.LoaiKeHoach IN(N'KHOA',N'Khoa')
          AND h.TrangThai IN(N'Đã duyệt',N'Đã công bố')
        ORDER BY h.NamHoc DESC,h.MaHD DESC`,
      [faculty.MaKhoa, isFacultyWide ? 1 : 0, context.userId],
    );
    return rows.map((r) => ({ ...r, canManage: Boolean(r.canManage) }));
  }
  async get(context: SessionContext, activityId: number) {
    this.requireRole(context, readerRoles);
    const faculty = await this.faculty();
    const row = await this.activity(activityId, faculty);
    const isFacultyWide = !this.isDepartmentRestricted(context);
    let canEdit = this.hasRole(context, ['ADMIN','GIANGVIEN','TRUONGBOMON','CANBOKHOA','BANTOCHUC'])
      && !row.CongBoLuc && row.TrangThaiHoatDong !== 'Đã công bố' && (!row.MaKHToChuc || editableStatuses.includes(row.TrangThai ?? ''));
    if (canEdit && !isFacultyWide) {
      try { await this.requireDepartment(context, row.MaBM); }
      catch (error) { if (error instanceof ForbiddenException || error instanceof BadRequestException) canEdit = false; else throw error; }
    }
    const staff = await this.staff(faculty.MaKhoa);
    const canPublish = this.hasRole(context, ['ADMIN']) || Boolean((await this.query(`SELECT TOP(1) 1 AS ok
      FROM TAIKHOAN t WHERE t.MaTK=@p1 AND (EXISTS(SELECT 1 FROM BANTOCHUC b WHERE b.MaHD=@p2 AND b.MaNgDung=t.MaNgDung)
      OR EXISTS(SELECT 1 FROM KEHOACHTOCHUC d CROSS APPLY OPENJSON(d.CacBan) WITH(loaiBan VARCHAR(30),thanhVien NVARCHAR(MAX) AS JSON) b
        CROSS APPLY OPENJSON(b.thanhVien) WITH(maTK BIGINT) m WHERE d.MaHD=@p2 AND b.loaiBan='TO_CHUC' AND m.maTK=t.MaTK)
      OR EXISTS(SELECT 1 FROM PHANCONGTHUCHIEN p WHERE p.MaHD=@p2 AND p.LoaiBan='TO_CHUC' AND p.MaNgDung=t.MaNgDung))`,
    [context.userId,activityId])).length);
    const canManage = isFacultyWide || canEdit || canPublish;

    let seminar: Record<string, unknown> | null = null;
    let chuongTrinh: Record<string, unknown>[] = [];
    let chuDeList: Record<string, unknown>[] = [];

    const semRows = await this.query<Record<string, unknown>>(`
      SELECT s.MaSeminar, s.SoKeHoach, s.MaHD, s.ChuDe, s.CanCu, s.MucDich, s.YeuCau,
             s.ThoiGian, s.DiaDiem, s.SLSVDuKien, s.DoiTuongTG, s.NoiDung, s.ThoiLuong,
             s.DVChuTri, s.DSChiDao, s.DSToChuc, s.ChuongTrinh
      FROM SEMINAR s WHERE s.MaHD = @p1
    `, [activityId]);

    if (semRows.length > 0) {
      seminar = semRows[0];
      try {
        chuongTrinh = JSON.parse(String(seminar.ChuongTrinh || '[]'));
      } catch {
        chuongTrinh = [];
      }
      chuDeList = await this.query<Record<string, unknown>>(`
        SELECT MaChuDe, MaSeminar, STT, TenChuDe,
               CONVERT(VARCHAR(5), TgBatDau, 108) AS TgBatDau,
               CONVERT(VARCHAR(5), TgKetThuc, 108) AS TgKetThuc,
               DienGia, NoiDungKhac
        FROM CHUDE
        WHERE MaSeminar = @p1
        ORDER BY ISNULL(STT, 9999), MaChuDe
      `, [seminar.MaSeminar]);
    }

    
    const pcthRows = await this.query<{
      MaPhanCong: number; MaHD: number; TenBan: string; LoaiBan: string | null;
      MaNgDung: number | null; HoTen: string | null; VaiTro: string; NoiDung: string;
      ThoiGian: Date | null; STT: number | null; MaTK: number | null;
    }>(
      `SELECT p.MaPhanCong, p.MaHD, p.TenBan, p.LoaiBan, p.MaNgDung, p.HoTen, p.VaiTro, p.NoiDung, p.ThoiGian, p.STT, t.MaTK
       FROM PHANCONGTHUCHIEN p
       LEFT JOIN TAIKHOAN t ON t.MaNgDung = p.MaNgDung
       WHERE p.MaHD = @p1
       ORDER BY ISNULL(p.STT, 9999), p.MaPhanCong`,
      [activityId],
    );

    const noiDungThucHien: Array<{ stt: number; noiDung: string; thoiGian: string; maTK: number; maNgDung?: number; hoTen?: string }> = [];
    const banRows = pcthRows.filter(r => {
      if (r.LoaiBan === 'NOI_DUNG' || r.TenBan === 'Phân công nội dung thực hiện') {
        noiDungThucHien.push({
          stt: r.STT ?? (noiDungThucHien.length + 1),
          noiDung: r.NoiDung,
          thoiGian: r.ThoiGian ? new Date(r.ThoiGian).toISOString().split('T')[0] : '',
          maTK: r.MaTK ?? 0,
          maNgDung: r.MaNgDung ?? undefined,
          hoTen: r.HoTen ?? undefined,
        });
        return false;
      }
      return true;
    });

    let cacBan: ReturnType<typeof readPlanCommittees> = readPlanCommittees(row.CacBan);
    if (banRows.length > 0) {
      const banMap = new Map<string, (typeof cacBan)[0]>();
      for (const b of cacBan) {
        banMap.set(b.tenBan, { ...b, thanhVien: [] });
      }
      for (const r of banRows) {
        if (!banMap.has(r.TenBan)) {
          banMap.set(r.TenBan, {
            loaiBan: (r.LoaiBan as any) || 'KHAC',
            tenBan: r.TenBan,
            thanhVien: [],
          });
        }
        const ban = banMap.get(r.TenBan)!;
        if (r.MaTK != null || r.HoTen) {
          ban.thanhVien.push({
            maTK: r.MaTK ?? 0,
            hoTen: r.HoTen ?? undefined,
            chucDanh: r.NoiDung,
            vaiTro: r.VaiTro as any,
            nhiemVu: r.VaiTro,
            hanHoanThanh: r.ThoiGian ? new Date(r.ThoiGian).toISOString().split('T')[0] : undefined,
          });
        }
      }
      cacBan = Array.from(banMap.values());
    }

            let nextMaCThi = 1;
    const nextCthiRows = await this.query<{ nextId: number }>(`
      SELECT CAST(COALESCE(IDENT_CURRENT('CUOCTHI') + IDENT_INCR('CUOCTHI'), 1) AS INT) AS nextId
    `);
    if (nextCthiRows.length > 0 && nextCthiRows[0].nextId) {
      nextMaCThi = nextCthiRows[0].nextId;
    }

    let cuocThi: Record<string, unknown> | null = null;
    const cthiRows = await this.query<Record<string, unknown>>(`
      SELECT MaCThi, MaHD, SoKeHoach, TenCuocThi, VongThi, CanCu, MucDich, YeuCau,
             ThoiGian, DiaDiem, DoiTuongTG, SLSVDuKien, CapToChuc, TheLe, TieuChiCham,
             HinhThucThi, DSBanGiamKhao, GiaiThuong
      FROM CUOCTHI WHERE MaHD = @p1
    `, [activityId]);
    if (cthiRows.length > 0) {
      cuocThi = cthiRows[0];
    }

    return {
      ...row,
      cacBan,
      noiDungThucHien,
      staff,
      canEdit,
      canPublish,
      canManage,
      seminar,
      chuongTrinh,
      chuDeList,
      cuocThi,
      nextMaCThi,
    };
  }
  async save(context: SessionContext, activityId: number, dto: SaveDetailedPlanDto) {
    this.requireRole(context, ['ADMIN','GIANGVIEN','TRUONGBOMON','CANBOKHOA','BANTOCHUC']);

    const faculty = await this.faculty();
    await this.inTransaction(async transaction => {
      const row = await this.activity(activityId, faculty, transaction);
      this.assertEditable(row);
      if (!row.MaBM) throw new BadRequestException('Hoạt động cần được phân công cho một bộ môn');
      const dates = validateDetailedPlanDates(
        dto,
        row.TenKeHoach || row.TenHoatDong,
        row.NoiDung || row.NoiDungHoatDong || 'Kế hoạch tổ chức',
        row.ThoiGianBatDau,
        row.ThoiGianKetThuc,
        row.HanDangKy,
      );
      await this.requireDepartment(context, row.MaBM, transaction);

      const staff = await this.staff(faculty.MaKhoa, transaction);
      const committees = validatePlanCommittees(dto.cacBan ?? readPlanCommittees(row.CacBan), staff.map(person => Number(person.MaTK)))
        .map(committee => ({ ...committee, thanhVien: committee.thanhVien.map(member => ({ ...member,
          hoTen: (() => { const p = staff.find(person => Number(person.MaTK) === member.maTK); return p ? formatTeacherName(p.HoTen, p.HocVi) : member.hoTen; })() })) }));
      let targetStatus = dto.trangThai?.trim();
      if (!targetStatus) {
        const hasAssignedMembers = committees.length > 0 && committees.some(c => c.thanhVien && c.thanhVien.length > 0);
        targetStatus = hasAssignedMembers ? 'Dự thảo' : 'Chờ phân công thực hiện';
      }
      const theLe = dto.theLe !== undefined ? (dto.theLe?.trim() || null) : (row.TheLe || null);
      const tieuChiCham = dto.tieuChiCham !== undefined ? (dto.tieuChiCham?.trim() || null) : (row.TieuChiCham || null);
      const hinhThucThi = dto.hinhThucThi ?? row.HinhThucThi ?? 'Cá nhân';
      const diaDiem = dto.diaDiem !== undefined ? (dto.diaDiem?.trim() || null) : (row.DiaDiem || null);
      const diemRenLuyen = dto.diemRenLuyen ?? row.DiemRenLuyen ?? 5;
      const params = [activityId,row.MaKeHoach,row.MaBM,dates.name,dates.content,theLe,tieuChiCham,hinhThucThi,dates.start,dates.end,dates.deadline,diaDiem,diemRenLuyen,Number(context.userId),JSON.stringify(committees),targetStatus];
      await this.query(`IF EXISTS(SELECT 1 FROM KEHOACHTOCHUC WHERE MaHD=@p1)
        UPDATE KEHOACHTOCHUC SET MaKeHoach=@p2,MaBM=@p3,TenKeHoach=@p4,NoiDung=@p5,TheLe=@p6,TieuChiCham=@p7,
          HinhThucThi=@p8,ThoiGianBatDau=@p9,ThoiGianKetThuc=@p10,HanDangKy=@p11,DiaDiem=@p12,DiemRenLuyen=@p13,
          CacBan=@p15,TrangThai=@p16,NguoiKyKhoa=NULL,NgayKyKhoa=NULL,NguoiKyCTSV=NULL,NgayKyCTSV=NULL
          WHERE MaHD=@p1 AND TrangThai IN(N'Chờ phân công thực hiện',N'Cần lập ban đề thi',N'Dự thảo',N'Cần bổ sung',N'Từ chối') AND CongBoLuc IS NULL;
        ELSE INSERT INTO KEHOACHTOCHUC(MaHD,MaKeHoach,MaBM,TenKeHoach,NoiDung,TheLe,TieuChiCham,HinhThucThi,
          ThoiGianBatDau,ThoiGianKetThuc,HanDangKy,DiaDiem,DiemRenLuyen,NguoiLap,CacBan,TrangThai)
          VALUES(@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11,@p12,@p13,@p14,@p15,@p16);`, params, transaction);
      await this.query(`DELETE FROM PHANCONGTHUCHIEN WHERE MaHD = @p1`, [activityId], transaction);
      let pcthStt = 1;
      for (const committee of committees) {
        if (!committee.thanhVien || committee.thanhVien.length === 0) continue;
        for (const member of committee.thanhVien) {
          const person = staff.find(p => Number(p.MaTK) === Number(member.maTK));
          const maNgDung = person ? person.MaNgDung : null;
          const hoTen = person ? formatTeacherName(person.HoTen, person.HocVi) : (member.hoTen || null);
          const vaiTro = member.vaiTro || 'Thành viên';
          const chucDanh = (member as any).chucDanh || person?.ChucDanh || 'Giảng viên';
          await this.query(
            `INSERT INTO PHANCONGTHUCHIEN (MaHD, TenBan, LoaiBan, MaNgDung, HoTen, VaiTro, NoiDung, ThoiGian, STT)
             VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9)`,
            [activityId, committee.tenBan, committee.loaiBan || null, maNgDung, hoTen, vaiTro, chucDanh, null, pcthStt++],
            transaction,
          );
        }
      }

      if (dto.noiDungThucHien && Array.isArray(dto.noiDungThucHien)) {
        let workStt = 1;
        for (const item of dto.noiDungThucHien) {
          if (!item.noiDung?.trim()) continue;
          const person = staff.find(p => Number(p.MaTK) === Number(item.maTK));
          const maNgDung = person ? person.MaNgDung : null;
          const hoTen = person ? formatTeacherName(person.HoTen, person.HocVi) : (item.hoTen || null);
          const thoiGian = item.thoiGian && Number.isFinite(new Date(item.thoiGian).getTime())
            ? new Date(item.thoiGian)
            : null;
          await this.query(
            `INSERT INTO PHANCONGTHUCHIEN (MaHD, TenBan, LoaiBan, MaNgDung, HoTen, VaiTro, NoiDung, ThoiGian, STT)
             VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9)`,
            [activityId, 'Phân công nội dung thực hiện', 'NOI_DUNG', maNgDung, hoTen, 'Thực hiện', item.noiDung.trim(), thoiGian, item.stt ?? workStt++],
            transaction,
          );
        }
      }


      const isCompetition = row.LoaiHoatDong === 'Cuộc thi' || (!row.LoaiHoatDong && Boolean(dto.tenCuocThi || dto.vongThi));
      const isSeminar = row.LoaiHoatDong === 'Seminar' || (!isCompetition && Boolean(dto.chuDe || dto.chuDeList));

      if (isSeminar) {
        const soKeHoach = dto.soKeHoach?.trim() || `SEM-CNTT-${activityId}/${new Date().getFullYear()}`;
        const chuDe = dto.chuDe?.trim() || dates.name;
        const canCu = dto.canCu?.trim() || `Kế hoạch năm học của Khoa CNTT`;
        const mucDich = dto.mucDich?.trim() || dates.content;
        const yeuCau = dto.yeuCau?.trim() || null;
        const thoiGian = dto.thoiGian?.trim() || (dates.start ? dates.start.toISOString() : null);
        const diaDiem = dto.diaDiem?.trim() || row.DiaDiem || null;
        const slsvDuKien = dto.slsvDuKien ?? (row.SLSVDuKien ? Number(row.SLSVDuKien) : null);
        const doiTuongTG = dto.doiTuongTG?.trim() || row.DoiTuongThamDu || null;
        const noiDungKhac = dto.noiDungKhac?.trim() || null;
        const chuongTrinhJson = JSON.stringify(dto.chuongTrinh ?? []);


        let maSeminar: number;
        const existingSem = await this.query<Record<string, unknown>>(
          `SELECT * FROM SEMINAR WHERE MaHD = @p1`,
          [activityId],
          transaction
        );
        const curSem = existingSem[0];
        const semSoKeHoach = dto.soKeHoach?.trim() || (curSem?.SoKeHoach ? String(curSem.SoKeHoach) : `SEM-CNTT-${activityId}/${new Date().getFullYear()}`);
        const semChuDe = dto.chuDe?.trim() || (curSem?.ChuDe ? String(curSem.ChuDe) : dates.name);
        const semCanCu = dto.canCu?.trim() || (curSem?.CanCu ? String(curSem.CanCu) : `Kế hoạch năm học của Khoa CNTT`);
        const semMucDich = dto.mucDich?.trim() || (curSem?.MucDich ? String(curSem.MucDich) : dates.content);
        const semYeuCau = dto.yeuCau !== undefined ? (dto.yeuCau?.trim() || null) : (curSem?.YeuCau ? String(curSem.YeuCau) : null);
        const semThoiGian = dto.thoiGian?.trim() || (curSem?.ThoiGian ? String(curSem.ThoiGian) : (dates.start ? dates.start.toISOString() : null));
        const semDiaDiem = dto.diaDiem?.trim() || (curSem?.DiaDiem ? String(curSem.DiaDiem) : (diaDiem || null));
        const semSlsvDuKien = dto.slsvDuKien ?? (curSem?.SLSVDuKien ? Number(curSem.SLSVDuKien) : (row.SLSVDuKien ? Number(row.SLSVDuKien) : null));
        const semDoiTuongTG = dto.doiTuongTG?.trim() || (curSem?.DoiTuongTG ? String(curSem.DoiTuongTG) : (row.DoiTuongThamDu || null));
        const semNoiDungKhac = dto.noiDungKhac !== undefined ? (dto.noiDungKhac?.trim() || null) : (curSem?.NoiDung ? String(curSem.NoiDung) : null);
        const semChuongTrinh = dto.chuongTrinh !== undefined ? JSON.stringify(dto.chuongTrinh) : (curSem?.ChuongTrinh ? String(curSem.ChuongTrinh) : JSON.stringify([]));

        if (existingSem.length > 0) {
          maSeminar = Number(existingSem[0].MaSeminar);
          await this.query(
            `UPDATE SEMINAR SET
              SoKeHoach = @p2,
              ChuDe = @p3,
              CanCu = @p4,
              MucDich = @p5,
              YeuCau = @p6,
              ThoiGian = @p7,
              DiaDiem = @p8,
              SLSVDuKien = @p9,
              DoiTuongTG = @p10,
              NoiDung = @p11,
              ChuongTrinh = @p12
             WHERE MaSeminar = @p1`,
            [maSeminar, semSoKeHoach, semChuDe, semCanCu, semMucDich, semYeuCau, semThoiGian, semDiaDiem, semSlsvDuKien, semDoiTuongTG, semNoiDungKhac, semChuongTrinh],
            transaction
          );
        } else {
          const ins = await this.query<{ MaSeminar: number }>(
            `INSERT INTO SEMINAR (SoKeHoach, MaHD, ChuDe, CanCu, MucDich, YeuCau, ThoiGian, DiaDiem, SLSVDuKien, DoiTuongTG, NoiDung, ChuongTrinh)
             OUTPUT INSERTED.MaSeminar
             VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12)`,
            [semSoKeHoach, activityId, semChuDe, semCanCu, semMucDich, semYeuCau, semThoiGian, semDiaDiem, semSlsvDuKien, semDoiTuongTG, semNoiDungKhac, semChuongTrinh],
            transaction
          );
          maSeminar = ins[0].MaSeminar;
        }

        // Synchronize CHUDE table
        if (dto.chuDeList) {
          const keptIds: number[] = [];
          for (const [index, cd] of dto.chuDeList.entries()) {
            const stt = cd.stt ?? (index + 1);
            const tenChuDe = cd.tenChuDe.trim();
            const dienGia = cd.dienGia?.trim() || null;
            const tgBatDau = cd.tgBatDau?.trim() || null;
            const tgKetThuc = cd.tgKetThuc?.trim() || null;
            const noiDungKhac = cd.noiDungKhac?.trim() || null;

            if (cd.maChuDe) {
              const upd = await this.query<{ MaChuDe: number }>(
                `UPDATE CHUDE SET
                  STT = @p2,
                  TenChuDe = @p3,
                  TgBatDau = CASE WHEN @p4 IS NOT NULL AND @p4 <> '' THEN CAST(@p4 AS TIME) ELSE NULL END,
                  TgKetThuc = CASE WHEN @p5 IS NOT NULL AND @p5 <> '' THEN CAST(@p5 AS TIME) ELSE NULL END,
                  DienGia = @p6,
                  NoiDungKhac = @p7
                 OUTPUT INSERTED.MaChuDe
                 WHERE MaChuDe = @p1 AND MaSeminar = @p8`,
                [cd.maChuDe, stt, tenChuDe, tgBatDau, tgKetThuc, dienGia, noiDungKhac, maSeminar],
                transaction
              );
              if (upd.length > 0) keptIds.push(upd[0].MaChuDe);
            } else {
              const insCd = await this.query<{ MaChuDe: number }>(
                `INSERT INTO CHUDE (MaSeminar, STT, TenChuDe, TgBatDau, TgKetThuc, DienGia, NoiDungKhac)
                 OUTPUT INSERTED.MaChuDe
                 VALUES (@p1, @p2, @p3,
                         CASE WHEN @p4 IS NOT NULL AND @p4 <> '' THEN CAST(@p4 AS TIME) ELSE NULL END,
                         CASE WHEN @p5 IS NOT NULL AND @p5 <> '' THEN CAST(@p5 AS TIME) ELSE NULL END,
                         @p6, @p7)`,
                [maSeminar, stt, tenChuDe, tgBatDau, tgKetThuc, dienGia, noiDungKhac],
                transaction
              );
              keptIds.push(insCd[0].MaChuDe);
            }
          }

          if (keptIds.length > 0) {
            const idList = keptIds.map(Number).filter(Boolean).join(',');
            await this.query(`DELETE FROM CHUDE WHERE MaSeminar = @p1 AND MaChuDe NOT IN (${idList})`, [maSeminar], transaction);
          } else {
            await this.query(`DELETE FROM CHUDE WHERE MaSeminar = @p1`, [maSeminar], transaction);
          }
        }
      }
      if (isCompetition || dto.tenCuocThi || dto.vongThi) {
        const cthiSoKeHoach = dto.soKeHoach?.trim() || `KH-CT-${activityId}/${new Date().getFullYear()}`;
        const cthiTen = dto.tenCuocThi?.trim() || dto.tenKeHoach?.trim() || dates.name;
        const cthiVongThi = dto.vongThi?.trim() || null;
        const cthiCanCu = dto.canCu?.trim() || null;
        const cthiMucDich = dto.mucDich?.trim() || null;
        const cthiYeuCau = dto.yeuCau?.trim() || null;
        const cthiThoiGian = dto.thoiGian?.trim() || (dates.start ? dates.start.toISOString() : null);
        const cthiDiaDiem = dto.diaDiem?.trim() || row.DiaDiem || null;
        const cthiDoiTuongTG = dto.doiTuongTG?.trim() || row.DoiTuongThamDu || null;
        const cthiSlsv = dto.slsvDuKien ?? (row.SLSVDuKien ? Number(row.SLSVDuKien) : null);
        const cthiCapTC = dto.capToChuc?.trim() || 'Cấp Khoa';
        const cthiTheLe = dto.theLe?.trim() || row.TheLe || null;
        const cthiTieuChiCham = dto.tieuChiCham?.trim() || row.TieuChiCham || null;
        const cthiHinhThuc = dto.hinhThucThi || row.HinhThucThi || 'Cá nhân';
        const cthiDsBanGiamKhao = dto.dsBanGiamKhao?.trim() || null;
        const cthiGiaiThuong = dto.giaiThuong?.trim() || null;

        await this.query(`
          IF EXISTS (SELECT 1 FROM CUOCTHI WHERE MaHD = @p1)
            UPDATE CUOCTHI SET
              SoKeHoach = @p2,
              TenCuocThi = @p3,
              VongThi = @p4,
              CanCu = @p5,
              MucDich = @p6,
              YeuCau = @p7,
              ThoiGian = @p8,
              DiaDiem = @p9,
              DoiTuongTG = @p10,
              SLSVDuKien = @p11,
              CapToChuc = @p12,
              TheLe = @p13,
              TieuChiCham = @p14,
              HinhThucThi = @p15,
              DSBanGiamKhao = @p16,
              GiaiThuong = @p17
            WHERE MaHD = @p1;
          ELSE
            INSERT INTO CUOCTHI (MaHD, SoKeHoach, TenCuocThi, VongThi, CanCu, MucDich, YeuCau, ThoiGian, DiaDiem, DoiTuongTG, SLSVDuKien, CapToChuc, TheLe, TieuChiCham, HinhThucThi, DSBanGiamKhao, GiaiThuong)
            VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12, @p13, @p14, @p15, @p16, @p17);
        `, [activityId, cthiSoKeHoach, cthiTen, cthiVongThi, cthiCanCu, cthiMucDich, cthiYeuCau, cthiThoiGian, cthiDiaDiem, cthiDoiTuongTG, cthiSlsv, cthiCapTC, cthiTheLe, cthiTieuChiCham, cthiHinhThuc, cthiDsBanGiamKhao, cthiGiaiThuong], transaction);

        await this.query(`
          UPDATE HOATDONGHOCTHUAT SET
            TenHoatDong = COALESCE(@p2, TenHoatDong),
            DiaDiem = COALESCE(@p3, DiaDiem),
            DoiTuongThamDu = COALESCE(@p4, DoiTuongThamDu),
            SLSVDuKien = COALESCE(@p5, SLSVDuKien),
            CapTC = COALESCE(@p6, CapTC)
          WHERE MaHD = @p1;
        `, [activityId, cthiTen, cthiDiaDiem, cthiDoiTuongTG, cthiSlsv, cthiCapTC], transaction);

        const cthiIdRows = await this.query<{ MaCThi: number }>(`SELECT MaCThi FROM CUOCTHI WHERE MaHD = @p1`, [activityId], transaction);
        if (cthiIdRows.length > 0) {
          await this.query(`UPDATE KEHOACHTOCHUC SET TenKeHoach = COALESCE(@p2, TenKeHoach), TheLe = COALESCE(@p3, TheLe), TieuChiCham = COALESCE(@p4, TieuChiCham), HinhThucThi = COALESCE(@p5, HinhThucThi), DiaDiem = COALESCE(@p6, DiaDiem) WHERE MaHD = @p1`, [activityId, cthiTen, cthiTheLe, cthiTieuChiCham, cthiHinhThuc, cthiDiaDiem], transaction);
        }
      }

    });
    return this.get(context, activityId);
  }
  async submit(context: SessionContext, activityId: number) {
    this.requireRole(context, ['ADMIN','GIANGVIEN','TRUONGBOMON','CANBOKHOA','BANTOCHUC']);
    const faculty = await this.faculty();
    await this.inTransaction(async transaction => {
      const row = await this.activity(activityId, faculty, transaction);
      await this.requireDepartment(context, row.MaBM, transaction);

      this.assertDocument(row);
      if (row.TrangThai === 'Chờ phân công thực hiện') {
        throw new BadRequestException('Kế hoạch đang ở trạng thái Chờ phân công thực hiện. Vui lòng hoàn tất phân công thực hiện trước khi trình khoa xét duyệt.');
      }
      this.assertEditable(row);
      validatePlanCommittees(readPlanCommittees(row.CacBan), (await this.staff(faculty.MaKhoa, transaction)).map(staff => Number(staff.MaTK)), true, row.LoaiHoatDong === 'Cuộc thi');
      const event = JSON.stringify({action:'submit',userId:context.userId,at:new Date().toISOString()});
      const changed = await this.query<{ MaHD: number }>(`UPDATE KEHOACHTOCHUC SET TrangThai=N'Chờ khoa xét duyệt',
        NguoiKyKhoa=NULL,NgayKyKhoa=NULL,NguoiKyCTSV=NULL,NgayKyCTSV=NULL,
        LichSuDuyet=JSON_MODIFY(LichSuDuyet,'append $',JSON_QUERY(@p2)) OUTPUT INSERTED.MaHD
        WHERE MaHD=@p1 AND TrangThai IN(N'Dự thảo',N'Cần lập ban đề thi',N'Cần bổ sung',N'Từ chối') AND CongBoLuc IS NULL`, [activityId,event], transaction);
      if (!changed.length) throw new ConflictException('Kế hoạch vừa thay đổi, hãy tải lại');

      await this.query(`
        INSERT INTO THONGBAO(MaTK, MaHD, Loai, TieuDe, NoiDung, GuiLuc)
        SELECT DISTINCT t.MaTK, @p1, N'Kế hoạch chi tiết',
          CONCAT(N'Kế hoạch chi tiết chờ duyệt: ', @p2),
          CONCAT(N'Kế hoạch chi tiết cho hoạt động "', @p2, N'" (', @p3, N') của bộ môn ', @p4, N' đang ở trạng thái Chờ khoa xét duyệt.'),
          SYSDATETIMEOFFSET()
        FROM TAIKHOAN t
        JOIN VAITRO v ON v.MaVaiTro = t.MaVaiTro
        LEFT JOIN NGUOIDUNG nd ON nd.MaNgDung = t.MaNgDung
        LEFT JOIN CANBOKHOA cb ON cb.MaNgDung = nd.MaNgDung
        WHERE t.TrangThai = N'Hoạt động'
          AND (
            v.TenVaiTro IN (N'Trưởng khoa', N'ADMIN', N'Quản trị viên')
            OR cb.ChucVu LIKE N'%Trưởng khoa%'
          )
          AND NOT EXISTS (
            SELECT 1 FROM THONGBAO tb
            WHERE tb.MaTK = t.MaTK
              AND tb.MaHD = @p1
              AND tb.Loai = N'Kế hoạch chi tiết'
              AND tb.DocLuc IS NULL
          )
      `, [activityId, row.TenHoatDong, row.LoaiHoatDong || 'Cuộc thi', row.TenBM || 'Khoa CNTT'], transaction);
    });
    return this.get(context, activityId);
  }
  async review(context: SessionContext, activityId: number, dto: ReviewDetailedPlanDto) {
    this.requireRole(context, ['ADMIN','TRUONGKHOA','CANBOKHOA','PHONGCTSV']);
    const faculty = await this.faculty();
    await this.inTransaction(async transaction => {
      const row = await this.activity(activityId, faculty, transaction);
      this.assertDocument(row);
      if (row.TrangThai === 'Chờ phân công thực hiện') {
        throw new BadRequestException('Kế hoạch đang ở trạng thái Chờ phân công thực hiện. Vui lòng hoàn tất phân công thực hiện trước khi trình khoa xét duyệt.');
      }
      if (row.CongBoLuc || row.TrangThaiHoatDong === 'Đã công bố') throw new BadRequestException('Không thể thay đổi kế hoạch đã công bố');
      const next = detailedPlanReviewStage(row.TrangThai ?? '', context.user.roles, dto.action);
      if (next.stage === 'faculty' && !this.hasRole(context, ['ADMIN'])) {
        const scoped = await this.query<{ ok: number }>(`SELECT TOP(1) 1 AS ok FROM TAIKHOAN t
          JOIN CANBOKHOA cb ON cb.MaNgDung=t.MaNgDung WHERE t.MaTK=@p1 AND cb.MaKhoa=@p2`, [context.userId,faculty.MaKhoa], transaction);
        if (!scoped.length) throw new ForbiddenException('Trưởng khoa chỉ được ký kế hoạch của khoa mình');
      }
      if (next.stage === 'student-affairs' && (!row.NguoiKyKhoa || !row.NgayKyKhoa)) throw new BadRequestException('Kế hoạch chưa có chữ ký của Trưởng khoa');
      const event = JSON.stringify({action:dto.action,stage:next.stage,userId:context.userId,roles:context.user.roles,note:dto.ghiChu?.trim() || null,signed:dto.action==='approve',at:new Date().toISOString()});
      const changed = await this.query<{ MaHD: number }>(`UPDATE KEHOACHTOCHUC SET TrangThai=@p2,
        NguoiKyKhoa=CASE WHEN @p5<>N'approve' THEN NULL WHEN @p6=N'faculty' THEN @p3 ELSE NguoiKyKhoa END,
        NgayKyKhoa=CASE WHEN @p5<>N'approve' THEN NULL WHEN @p6=N'faculty' THEN SYSDATETIMEOFFSET() ELSE NgayKyKhoa END,
        NguoiKyCTSV=CASE WHEN @p5=N'approve' AND @p6=N'student-affairs' THEN @p3 ELSE NULL END,
        NgayKyCTSV=CASE WHEN @p5=N'approve' AND @p6=N'student-affairs' THEN SYSDATETIMEOFFSET() ELSE NULL END,
        LichSuDuyet=JSON_MODIFY(LichSuDuyet,'append $',JSON_QUERY(@p4)) OUTPUT INSERTED.MaHD
        WHERE MaHD=@p1 AND TrangThai=@p7 AND CongBoLuc IS NULL`, [activityId,next.status,Number(context.userId),event,dto.action,next.stage,row.TrangThai], transaction);
      if (!changed.length) throw new ConflictException('Bước ký vừa thay đổi, hãy tải lại');

      await this.query(`
        UPDATE THONGBAO SET DocLuc = SYSDATETIMEOFFSET()
        WHERE MaHD = @p1 AND Loai = N'Kế hoạch chi tiết' AND DocLuc IS NULL
      `, [activityId], transaction);
    });
    return this.get(context, activityId);
  }
  async publish(context: SessionContext, activityId: number) {
    this.requireRole(context, ['ADMIN','BANTOCHUC','GIANGVIEN','TRUONGBOMON','CANBOKHOA','TRUONGKHOA']);
    const faculty = await this.faculty();
    await this.inTransaction(async transaction => {
      const row = await this.activity(activityId, faculty, transaction);
      this.assertDocument(row);
      if (row.TrangThai === 'Chờ phân công thực hiện') {
        throw new BadRequestException('Kế hoạch đang ở trạng thái Chờ phân công thực hiện. Vui lòng hoàn tất phân công thực hiện trước khi trình khoa xét duyệt.');
      }
      if (!this.hasRole(context, ['ADMIN'])) {
        const organizers = await this.query<{ ok: number }>(`SELECT TOP(1) 1 AS ok FROM BANTOCHUC b JOIN TAIKHOAN t ON t.MaNgDung=b.MaNgDung
          WHERE b.MaHD=@p1 AND t.MaTK=@p2
          UNION ALL SELECT TOP(1) 1 AS ok FROM KEHOACHTOCHUC d
          CROSS APPLY OPENJSON(d.CacBan) WITH(loaiBan VARCHAR(30),thanhVien NVARCHAR(MAX) AS JSON) b
          CROSS APPLY OPENJSON(b.thanhVien) WITH(maTK BIGINT) m
          WHERE d.MaHD=@p1 AND b.loaiBan='TO_CHUC' AND m.maTK=@p2
          UNION ALL SELECT TOP(1) 1 AS ok FROM PHANCONGTHUCHIEN p JOIN TAIKHOAN t ON t.MaNgDung=p.MaNgDung WHERE p.MaHD=@p1 AND p.LoaiBan='TO_CHUC' AND t.MaTK=@p2`, [activityId,context.userId], transaction);
        if (!organizers.length) throw new ForbiddenException('Chỉ Ban tổ chức được phân công hoạt động này mới được công bố');
      }
      if (row.TrangThai !== 'Đã duyệt' || !row.NguoiKyKhoa || !row.NgayKyKhoa) {
        throw new BadRequestException('Kế hoạch chi tiết phải được khoa duyệt trước khi công bố');
      }
      if (row.TrangThaiDuTru !== 'Đã duyệt') throw new BadRequestException('Dự trù kinh phí của hoạt động chưa được khoa duyệt');
      if (row.CongBoLuc && row.TrangThaiHoatDong === 'Đã công bố') return;
      if (row.TrangThaiHoatDong !== 'Đã duyệt') throw new BadRequestException('Hoạt động chưa được khoa duyệt');
      if (!row.ThoiGianBatDau || !row.ThoiGianKetThuc) throw new BadRequestException('Kế hoạch chưa có lịch tổ chức');
      const params = [activityId,row.TenHoatDong,row.NoiDung,row.TheLe ?? row.NoiDung,row.TieuChiCham,row.HinhThucThi,
        row.ThoiGianBatDau,row.ThoiGianKetThuc,row.HanDangKy,row.DiaDiem,row.SLSVDuKien,row.DoiTuongThamDu];
      if (row.LoaiHoatDong === 'Cuộc thi') {
        await this.query(`IF NOT EXISTS(SELECT 1 FROM CUOCTHI WHERE MaHD=@p1)
          INSERT INTO CUOCTHI(MaHD,TenCuocThi,TheLe,TieuChiCham,HinhThucThi,ThoiGian,DiaDiem,DoiTuongTG,SLSVDuKien)
          VALUES(@p1,@p2,@p4,@p5,@p6,@p7,@p10,@p12,@p11);
          ELSE UPDATE CUOCTHI SET TenCuocThi=@p2,TheLe=@p4,TieuChiCham=@p5,HinhThucThi=@p6,
            ThoiGian=@p7,DiaDiem=@p10,DoiTuongTG=@p12,SLSVDuKien=@p11 WHERE MaHD=@p1;`, params, transaction);
      } else {
        await this.query(`IF NOT EXISTS(SELECT 1 FROM SEMINAR WHERE MaHD=@p1)
          INSERT INTO SEMINAR(MaHD,ChuDe,CanCu,NoiDung,ThoiGian,DiaDiem,SLSVDuKien)
          VALUES(@p1,@p2,N'Kế hoạch tổ chức đã được khoa và Phòng CTSV ký',@p3,@p7,@p10,@p11);
          ELSE UPDATE SEMINAR SET ChuDe=@p2,NoiDung=@p3,ThoiGian=@p7,DiaDiem=@p10,SLSVDuKien=@p11 WHERE MaHD=@p1;`, params, transaction);
      }
      const changed = await this.query<{ MaHD: number }>(`UPDATE HOATDONGHOCTHUAT SET TgDuKien=CAST(@p2 AS DATE),
        TgBatDau=CAST(@p2 AS TIME),TgKetThuc=CAST(@p3 AS TIME),HanDangKy=@p4,DiaDiem=@p5,
        SLToiDa=TRY_CONVERT(INT,NULLIF(SLSVDuKien,N'')),TrangThai=N'Đã công bố' OUTPUT INSERTED.MaHD WHERE MaHD=@p1 AND TrangThai=N'Đã duyệt'`,
      [activityId,row.ThoiGianBatDau,row.ThoiGianKetThuc,row.HanDangKy,row.DiaDiem], transaction);
      if (!changed.length) throw new ConflictException('Trạng thái hoạt động vừa thay đổi, hãy tải lại');
      await this.query(`UPDATE KEHOACHTOCHUC SET CongBoLuc=SYSDATETIMEOFFSET() WHERE MaHD=@p1 AND CongBoLuc IS NULL`, [activityId], transaction);
      await this.query(`INSERT INTO TINTUCHOCTHUAT(MaHD,TieuDe,NoiDung,NguoiLap,TrangThai,CongBoLuc)
        SELECT @p1,@p2,@p3,@p4,N'Đã công bố',SYSDATETIMEOFFSET()
        WHERE NOT EXISTS(SELECT 1 FROM TINTUCHOCTHUAT WHERE MaHD=@p1 AND TrangThai=N'Đã công bố')`,
      [activityId,`Thông báo tổ chức: ${row.TenHoatDong}`.slice(0,250),`Kế hoạch tổ chức đã được khoa và Phòng CTSV ký duyệt.\n${row.NoiDung ?? ''}`,Number(context.userId)], transaction);
      await this.query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
        SELECT DISTINCT t.MaTK,@p1,N'Mở đăng ký hoạt động',@p3,@p4
        FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung JOIN LOP l ON l.MaLop=s.MaLop
        WHERE l.MaKhoa=@p2 AND t.TrangThai=N'Hoạt động'
          AND NOT EXISTS(SELECT 1 FROM THONGBAO old WHERE old.MaTK=t.MaTK AND old.MaHD=@p1 AND old.Loai=N'Mở đăng ký hoạt động')`,
      [activityId,faculty.MaKhoa,`Mở đăng ký: ${row.TenHoatDong}`,`Kế hoạch tổ chức đã được khoa và Phòng CTSV ký. ${row.NoiDung ?? ''}`], transaction);
    });
    return this.get(context, activityId);
  }
}
