import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../../data/database.service';
import { FeaturesRepository } from '../../data/repositories/features/features.repository';
import type { SessionContext } from '../auth/auth.types';
import type { NewsDto } from '../../presentation/workflow/news.controller';

@Injectable()
export class NewsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(FeaturesRepository) private readonly features: FeaturesRepository,
  ) {}

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

  async latestPublishedAnnouncement(activityId: number) {
    const [article] = await this.db.query<{ TieuDe: string; NoiDung: string }>(
      `SELECT TOP (1) TieuDe,NoiDung
       FROM TINTUCHOCTHUAT
       WHERE MaHD=@p1 AND TrangThai=N'Đã công bố'
       ORDER BY COALESCE(CongBoLuc,NgayTao) DESC,MaTin DESC`,
      [activityId],
    );
    return article ?? null;
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
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    let updated: { MaHD: number | null };
    try {
      const result = await new sql.Request(transaction)
        .input('id', sql.BigInt, id)
        .input('status', sql.NVarChar(30), status)
        .query<typeof updated>(`UPDATE TINTUCHOCTHUAT
          SET TrangThai=@status,NgayCapNhat=SYSDATETIMEOFFSET(),
            CongBoLuc=CASE WHEN @status=N'Đã công bố' THEN SYSDATETIMEOFFSET() ELSE CongBoLuc END
          OUTPUT INSERTED.* WHERE MaTin=@id`);
      updated = result.recordset[0];
      if (!updated) throw new NotFoundException('Không tìm thấy tin');
      if (status === 'Đã công bố' && updated.MaHD !== null) {
        await this.features.includeAnnouncedSeminar(updated.MaHD, transaction);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    if (status === 'Đã công bố') {
      try {
        await this.db.query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
          SELECT DISTINCT t.MaTK,n.MaHD,CONCAT(N'Tin học thuật #',n.MaTin),n.TieuDe,n.NoiDung
          FROM TINTUCHOCTHUAT n CROSS JOIN TAIKHOAN t
          WHERE n.MaTin=@p1 AND t.TrangThai=N'Hoạt động' AND NOT EXISTS(
            SELECT 1 FROM THONGBAO old WHERE old.MaTK=t.MaTK AND old.Loai=CONCAT(N'Tin học thuật #',n.MaTin)
          )`, [id]);
      } catch (error) {
        console.error(`Tin học thuật #${id} đã xuất bản nhưng không gửi được thông báo:`, error);
      }
    }
    return updated;
  }
}
