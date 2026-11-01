import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../../data/database.service';
import type { SessionContext } from '../auth/auth.types';
import type { ReviewDetailedPlanDto, SaveDetailedPlanDto } from '../../presentation/detailed-plans/detailed-plans.dto';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const readerRoles = ['ADMIN','GIANGVIEN','TRUONGBOMON','CANBOKHOA','TRUONGKHOA','PHONGCTSV','PHONGKHCN','HIEUTRUONG','BANTOCHUC'];
const editableStatuses = ['Dự thảo','Cần bổ sung','Từ chối'];
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
  TongDuToan: number; TrangThaiDuTru: string | null;
};

export function detailedPlanReviewStage(status: string, roles: string[], action: ReviewAction) {
  const roleKeys = roles.map(normalize);
  const stage = status === 'Chờ khoa ký' ? 'faculty' : status === 'Chờ CTSV ký' ? 'student-affairs' : null;
  if (!stage) throw new BadRequestException('Kế hoạch chi tiết không ở bước chờ ký');
  const requiredRole = stage === 'faculty' ? 'TRUONGKHOA' : 'PHONGCTSV';
  if (!roleKeys.includes('ADMIN') && !roleKeys.includes(requiredRole)) {
    throw new ForbiddenException(stage === 'faculty' ? 'Kế hoạch đang chờ Trưởng khoa ký' : 'Kế hoạch đang chờ Phòng CTSV ký');
  }
  if (!['approve','request_changes','reject'].includes(action)) throw new BadRequestException('Thao tác duyệt không hợp lệ');
  return {
    stage,
    status: action === 'approve' ? (stage === 'faculty' ? 'Chờ CTSV ký' : 'Đã duyệt') : action === 'request_changes' ? 'Cần bổ sung' : 'Từ chối',
  };
}

export function validateDetailedPlanDates(dto: SaveDetailedPlanDto) {
  const start = new Date(dto.thoiGianBatDau);
  const end = new Date(dto.thoiGianKetThuc);
  const deadline = dto.hanDangKy ? new Date(dto.hanDangKy) : null;
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
  }
  if (deadline && (!Number.isFinite(deadline.getTime()) || deadline > start)) {
    throw new BadRequestException('Hạn đăng ký phải trước hoặc bằng thời gian bắt đầu');
  }
  if (!dto.tenKeHoach.trim() || !dto.noiDung.trim()) throw new BadRequestException('Cần nhập tên và nội dung kế hoạch chi tiết');
  return { start, end, deadline };
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
      d.ThoiGianBatDau,d.ThoiGianKetThuc,d.HanDangKy,d.DiaDiem,d.DiemRenLuyen,d.TrangThai,d.NguoiLap,
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
  private async requireDepartment(context: SessionContext, departmentId: number | null, transaction: sql.Transaction) {
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
  async list(context: SessionContext) {
    this.requireRole(context, readerRoles);
    const faculty = await this.faculty();
    return this.query<DetailedPlan>(`${this.activityQuery(false)} ORDER BY h.NamHoc DESC,h.MaHD DESC`, [faculty.MaKhoa]);
  }
  async get(context: SessionContext, activityId: number) {
    this.requireRole(context, readerRoles);
    return this.activity(activityId, await this.faculty());
  }
  async save(context: SessionContext, activityId: number, dto: SaveDetailedPlanDto) {
    this.requireRole(context, ['ADMIN','GIANGVIEN','TRUONGBOMON','CANBOKHOA','BANTOCHUC']);
    const dates = validateDetailedPlanDates(dto);
    const faculty = await this.faculty();
    await this.inTransaction(async transaction => {
      const row = await this.activity(activityId, faculty, transaction);
      this.assertEditable(row);
      if (!row.MaBM) throw new BadRequestException('Hoạt động cần được phân công cho một bộ môn');
      await this.requireDepartment(context, row.MaBM, transaction);
      const params = [activityId,row.MaKeHoach,row.MaBM,dto.tenKeHoach.trim(),dto.noiDung.trim(),dto.theLe?.trim() || null,
        dto.tieuChiCham?.trim() || null,dto.hinhThucThi ?? 'Cá nhân',dates.start,dates.end,dates.deadline,dto.diaDiem?.trim() || null,dto.diemRenLuyen ?? 5,Number(context.userId)];
      await this.query(`IF EXISTS(SELECT 1 FROM KEHOACHTOCHUC WHERE MaHD=@p1)
        UPDATE KEHOACHTOCHUC SET MaKeHoach=@p2,MaBM=@p3,TenKeHoach=@p4,NoiDung=@p5,TheLe=@p6,TieuChiCham=@p7,
          HinhThucThi=@p8,ThoiGianBatDau=@p9,ThoiGianKetThuc=@p10,HanDangKy=@p11,DiaDiem=@p12,DiemRenLuyen=@p13,
          TrangThai=N'Dự thảo',NguoiKyKhoa=NULL,NgayKyKhoa=NULL,NguoiKyCTSV=NULL,NgayKyCTSV=NULL
          WHERE MaHD=@p1 AND TrangThai IN(N'Dự thảo',N'Cần bổ sung',N'Từ chối') AND CongBoLuc IS NULL;
        ELSE INSERT INTO KEHOACHTOCHUC(MaHD,MaKeHoach,MaBM,TenKeHoach,NoiDung,TheLe,TieuChiCham,HinhThucThi,
          ThoiGianBatDau,ThoiGianKetThuc,HanDangKy,DiaDiem,DiemRenLuyen,NguoiLap)
          VALUES(@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11,@p12,@p13,@p14);`, params, transaction);
    });
    return this.get(context, activityId);
  }
  async submit(context: SessionContext, activityId: number) {
    this.requireRole(context, ['ADMIN','GIANGVIEN','TRUONGBOMON','CANBOKHOA','BANTOCHUC']);
    const faculty = await this.faculty();
    await this.inTransaction(async transaction => {
      const row = await this.activity(activityId, faculty, transaction);
      this.assertDocument(row);
      this.assertEditable(row);
      await this.requireDepartment(context, row.MaBM, transaction);
      const event = JSON.stringify({action:'submit',userId:context.userId,at:new Date().toISOString()});
      const changed = await this.query<{ MaHD: number }>(`UPDATE KEHOACHTOCHUC SET TrangThai=N'Chờ khoa ký',
        NguoiKyKhoa=NULL,NgayKyKhoa=NULL,NguoiKyCTSV=NULL,NgayKyCTSV=NULL,
        LichSuDuyet=JSON_MODIFY(LichSuDuyet,'append $',JSON_QUERY(@p2)) OUTPUT INSERTED.MaHD
        WHERE MaHD=@p1 AND TrangThai IN(N'Dự thảo',N'Cần bổ sung',N'Từ chối') AND CongBoLuc IS NULL`, [activityId,event], transaction);
      if (!changed.length) throw new ConflictException('Kế hoạch vừa thay đổi, hãy tải lại');
    });
    return this.get(context, activityId);
  }
  async review(context: SessionContext, activityId: number, dto: ReviewDetailedPlanDto) {
    this.requireRole(context, ['ADMIN','TRUONGKHOA','PHONGCTSV']);
    const faculty = await this.faculty();
    await this.inTransaction(async transaction => {
      const row = await this.activity(activityId, faculty, transaction);
      this.assertDocument(row);
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
    });
    return this.get(context, activityId);
  }
  async publish(context: SessionContext, activityId: number) {
    this.requireRole(context, ['ADMIN','BANTOCHUC','GIANGVIEN','TRUONGBOMON','CANBOKHOA']);
    const faculty = await this.faculty();
    await this.inTransaction(async transaction => {
      const row = await this.activity(activityId, faculty, transaction);
      this.assertDocument(row);
      if (!this.hasRole(context, ['ADMIN'])) {
        const organizers = await this.query<{ ok: number }>(`SELECT TOP(1) 1 AS ok FROM BANTOCHUC b JOIN TAIKHOAN t ON t.MaNgDung=b.MaNgDung
          WHERE b.MaHD=@p1 AND t.MaTK=@p2`, [activityId,context.userId], transaction);
        if (!organizers.length) throw new ForbiddenException('Chỉ Ban tổ chức được phân công hoạt động này mới được công bố');
      }
      if (row.TrangThai !== 'Đã duyệt' || !row.NguoiKyKhoa || !row.NgayKyKhoa || !row.NguoiKyCTSV || !row.NgayKyCTSV) {
        throw new BadRequestException('Kế hoạch chi tiết phải được khoa và Phòng CTSV ký trước khi công bố');
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
