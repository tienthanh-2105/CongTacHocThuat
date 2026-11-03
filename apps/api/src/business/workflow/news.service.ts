import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../data/database.service';
import type { SessionContext } from '../auth/auth.types';
import type { NewsDto } from '../../presentation/workflow/news.controller';

// Use with activity alias h, account parameter @p1 and admin flag @p2.
const managesActivity = `(@p2=1 OR EXISTS(SELECT 1 FROM BANTOCHUC b JOIN TAIKHOAN t ON t.MaNgDung=b.MaNgDung WHERE b.MaHD=h.MaHD AND t.MaTK=@p1)
  OR EXISTS(SELECT 1 FROM KEHOACHTOCHUC planDoc CROSS APPLY OPENJSON(planDoc.CacBan) WITH(loaiBan VARCHAR(30),thanhVien NVARCHAR(MAX) AS JSON) b
    CROSS APPLY OPENJSON(b.thanhVien) WITH(maTK BIGINT) m WHERE planDoc.MaHD=h.MaHD AND b.loaiBan='TO_CHUC' AND m.maTK=@p1))`;

@Injectable()
export class NewsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private params(context: SessionContext) { return [Number(context.userId), context.user.roles.includes('ADMIN') ? 1 : 0]; }
  private activityQuery() {
    return `SELECT h.MaHD,h.TenHoatDong,h.LoaiHoatDong,h.TrangThai AS TrangThaiHoatDong,d.TrangThai,d.NguoiKyKhoa,d.NgayKyKhoa,d.NguoiKyCTSV,d.NgayKyCTSV,
      d.ThoiGianBatDau,d.ThoiGianKetThuc,d.HanDangKy,d.DiaDiem,d.NoiDung,d.CongBoLuc,
      CASE WHEN (${managesActivity} OR @p2=1) THEN 1 ELSE 0 END AS CanManage
      FROM HOATDONGHOCTHUAT h LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD`;
  }
  activities(context: SessionContext) {
    return this.db.query(`${this.activityQuery()} WHERE (@p2=1 OR ${managesActivity} OR h.TrangThai IN (N'Đã duyệt', N'Đã công bố')) ORDER BY h.MaHD DESC`, this.params(context));
  }
  list(context: SessionContext) {
    return this.db.query(`SELECT n.*,h.TenHoatDong,h.LoaiHoatDong,d.ThoiGianBatDau,d.HanDangKy,d.DiaDiem,
      CASE WHEN (n.MaHD IS NULL OR ${managesActivity} OR @p2=1) THEN 1 ELSE 0 END AS CanManage
      FROM TINTUCHOCTHUAT n LEFT JOIN HOATDONGHOCTHUAT h ON h.MaHD=n.MaHD LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
      WHERE (n.TrangThai=N'Đã công bố') OR (n.MaHD IS NULL AND @p2=1) OR (${managesActivity} OR @p2=1)
      ORDER BY COALESCE(n.CongBoLuc,n.NgayTao) DESC,n.MaTin DESC`, this.params(context));
  }
  private async requireActivity(context: SessionContext, activityId: number) {
    const row = (await this.db.query<Record<string, unknown>>(`${this.activityQuery()} WHERE h.MaHD=@p3`, [...this.params(context),activityId]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy hoạt động học thuật');
    const isStaff = context.user.roles.some(r => ['ADMIN','CANBOKHOA','TRUONGKHOA'].includes(r));
    if (!row.CanManage && !isStaff) throw new ForbiddenException('Chỉ Ban tổ chức hoặc Ban quản lý được phân công mới được quản lý tin');
    return row;
  }
  async save(context: SessionContext, dto: NewsDto, id?: number) {
    if (!dto.tieuDe?.trim() || !dto.noiDung?.trim()) throw new BadRequestException('Cần nhập tiêu đề và nội dung tin');
    const maHD = dto.maHD ? Number(dto.maHD) : null;
    if (maHD) {
      await this.requireActivity(context, maHD);
    } else {
      const isStaff = context.user.roles.some(r => ['ADMIN','CANBOKHOA','TRUONGKHOA','GIANGVIEN'].includes(r));
      if (!isStaff) throw new ForbiddenException('Bạn không có quyền tạo bản tin chung');
    }
    if (id) {
      const old = (await this.db.query<{MaHD:number|null}>('SELECT MaHD FROM TINTUCHOCTHUAT WHERE MaTin=@p1',[id]))[0];
      if (!old) throw new NotFoundException('Không tìm thấy tin');
      return (await this.db.query(`UPDATE TINTUCHOCTHUAT SET MaHD=@p2,TieuDe=@p3,NoiDung=@p4,TrangThai=N'Dự thảo',CongBoLuc=NULL,NgayCapNhat=SYSDATETIMEOFFSET()
        OUTPUT INSERTED.* WHERE MaTin=@p1`,[id,maHD,dto.tieuDe.trim(),dto.noiDung.trim()]))[0];
    }
    return (await this.db.query(`INSERT INTO TINTUCHOCTHUAT(MaHD,TieuDe,NoiDung,NguoiLap) OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4)`,
      [maHD,dto.tieuDe.trim(),dto.noiDung.trim(),Number(context.userId)]))[0];
  }
  async status(context: SessionContext, id: number, status: 'Đã công bố' | 'Đã ẩn') {
    const news = (await this.db.query<{MaHD:number|null}>('SELECT MaHD FROM TINTUCHOCTHUAT WHERE MaTin=@p1',[id]))[0];
    if (!news) throw new NotFoundException('Không tìm thấy tin');
    if (news.MaHD) {
      const activity = await this.requireActivity(context,news.MaHD);
      if (status === 'Đã công bố' && (activity.TrangThai !== 'Đã duyệt' || activity.TrangThaiHoatDong !== 'Đã công bố'
        || !activity.NguoiKyKhoa || !activity.NgayKyKhoa || !activity.NguoiKyCTSV || !activity.NgayKyCTSV || !activity.CongBoLuc)) {
        throw new BadRequestException('Chỉ đăng tin sau khi kế hoạch có chữ ký khoa, CTSV và Ban tổ chức đã công bố hoạt động');
      }
    } else {
      const isStaff = context.user.roles.some(r => ['ADMIN','CANBOKHOA','TRUONGKHOA','GIANGVIEN'].includes(r));
      if (!isStaff) throw new ForbiddenException('Bạn không có quyền thay đổi trạng thái bản tin này');
    }
    return (await this.db.query(`SET XACT_ABORT ON; BEGIN TRAN;
      UPDATE TINTUCHOCTHUAT SET TrangThai=@p2,NgayCapNhat=SYSDATETIMEOFFSET(),
        CongBoLuc=CASE WHEN @p2=N'Đã công bố' THEN SYSDATETIMEOFFSET() ELSE CongBoLuc END WHERE MaTin=@p1;
      IF @p2=N'Đã công bố'
        INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
        SELECT DISTINCT t.MaTK,n.MaHD,CONCAT(N'Tin học thuật #',n.MaTin),n.TieuDe,n.NoiDung
        FROM TINTUCHOCTHUAT n CROSS JOIN TAIKHOAN t
        WHERE n.MaTin=@p1 AND t.TrangThai=N'Hoạt động' AND NOT EXISTS(SELECT 1 FROM THONGBAO old
          WHERE old.MaTK=t.MaTK AND old.Loai=CONCAT(N'Tin học thuật #',n.MaTin));
      SELECT * FROM TINTUCHOCTHUAT WHERE MaTin=@p1; COMMIT;`,[id,status]))[0];
  }
}
