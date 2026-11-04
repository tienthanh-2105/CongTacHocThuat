import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../data/database.service';
import type { SessionContext } from '../auth/auth.types';
import type { NewsDto } from '../../presentation/workflow/news.controller';

@Injectable()
export class NewsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  activities(_context: SessionContext) {
    return this.db.query(`SELECT h.MaHD,h.TenHoatDong,h.LoaiHoatDong,h.TrangThai AS TrangThaiHoatDong,d.TrangThai,
      d.ThoiGianBatDau,d.ThoiGianKetThuc,d.HanDangKy,d.DiaDiem,d.NoiDung,d.CongBoLuc,
      1 AS CanManage
      FROM HOATDONGHOCTHUAT h LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
      ORDER BY h.MaHD DESC`);
  }

  list(_context: SessionContext) {
    return this.db.query(`SELECT n.*,h.TenHoatDong,h.LoaiHoatDong,d.ThoiGianBatDau,d.HanDangKy,d.DiaDiem,
      1 AS CanManage
      FROM TINTUCHOCTHUAT n LEFT JOIN HOATDONGHOCTHUAT h ON h.MaHD=n.MaHD LEFT JOIN KEHOACHTOCHUC d ON d.MaHD=h.MaHD
      ORDER BY COALESCE(n.CongBoLuc,n.NgayTao) DESC,n.MaTin DESC`);
  }

  async save(context: SessionContext, dto: NewsDto, id?: number) {
    if (!dto.tieuDe?.trim() || !dto.noiDung?.trim()) throw new BadRequestException('Cần nhập tiêu đề và nội dung tin');
    const maHD = dto.maHD ? Number(dto.maHD) : null;
    if (id) {
      const old = (await this.db.query<{MaHD:number|null}>('SELECT MaHD FROM TINTUCHOCTHUAT WHERE MaTin=@p1',[id]))[0];
      if (!old) throw new NotFoundException('Không tìm thấy tin');
      return (await this.db.query(`UPDATE TINTUCHOCTHUAT SET MaHD=@p2,TieuDe=@p3,NoiDung=@p4,TrangThai=N'Dự thảo',CongBoLuc=NULL,NgayCapNhat=SYSDATETIMEOFFSET()
        OUTPUT INSERTED.* WHERE MaTin=@p1`,[id,maHD,dto.tieuDe.trim(),dto.noiDung.trim()]))[0];
    }
    return (await this.db.query(`INSERT INTO TINTUCHOCTHUAT(MaHD,TieuDe,NoiDung,NguoiLap) OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4)`,
      [maHD,dto.tieuDe.trim(),dto.noiDung.trim(),Number(context.userId)]))[0];
  }

  async status(_context: SessionContext, id: number, status: 'Đã công bố' | 'Đã ẩn') {
    const news = (await this.db.query<{MaHD:number|null}>('SELECT MaHD FROM TINTUCHOCTHUAT WHERE MaTin=@p1',[id]))[0];
    if (!news) throw new NotFoundException('Không tìm thấy tin');
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
