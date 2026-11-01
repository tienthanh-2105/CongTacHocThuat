import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../data/database.service';
import type { SessionContext } from '../auth/auth.types';

type ProposalInput = { maBM: number; namHoc: string; tenCuocThi: string; noiDung: string; duTruKinhPhi: number };
const normalizedRole = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

@Injectable()
export class DepartmentPlansService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private isLecturer(context: SessionContext) {
    const position = context.user.position?.trim() ?? '';
    return ['Trưởng bộ môn','Phụ trách bộ môn'].includes(position)
      && !context.user.roles.some(role => ['TRUONGKHOA','PHOTRUONGKHOA','ADMIN'].includes(normalizedRole(role)))
      && !/^(trưởng|phó)\s*(trưởng\s*)?khoa$/i.test(position);
  }
  private isAcademicCoordinator(context: SessionContext) {
    return context.user.roles.some(role => normalizedRole(role) === 'ADMIN')
      || normalizedRole(context.user.position ?? '').includes('TRUONGBANHOCTHUAT');
  }
  private isAdmin(context: SessionContext) { return context.user.roles.some(role => normalizedRole(role) === 'ADMIN'); }
  private async memberships(context: SessionContext) {
    if (!this.isLecturer(context)) throw new ForbiddenException('Trang đề xuất bộ môn chỉ dành cho giảng viên');
    return this.db.query<{ MaBM: number; TenBM: string; VaiTro: string }>(`SELECT bm.MaBM,bm.TenBM,
      CASE WHEN cb.ChucVu IN(N'Trưởng bộ môn',N'Phụ trách bộ môn') AND assigned.MaBM=gv.MaBM THEN N'Phụ trách bộ môn' ELSE COALESCE(link.VaiTro,N'Ban bộ môn') END AS VaiTro FROM TAIKHOAN t
      JOIN GIANGVIEN gv ON gv.MaNgDung=t.MaNgDung
      JOIN (SELECT gv0.MaGV,gv0.MaBM FROM GIANGVIEN gv0 JOIN TAIKHOAN t0 ON t0.MaNgDung=gv0.MaNgDung WHERE t0.MaTK=@p1 AND gv0.MaBM IS NOT NULL
        UNION SELECT gv0.MaGV,gb0.MaBM FROM GIANGVIEN gv0 JOIN TAIKHOAN t0 ON t0.MaNgDung=gv0.MaNgDung JOIN GIANGVIEN_BOMON gb0 ON gb0.MaGV=gv0.MaGV WHERE t0.MaTK=@p1) assigned ON assigned.MaGV=gv.MaGV
      LEFT JOIN GIANGVIEN_BOMON link ON link.MaGV=assigned.MaGV AND link.MaBM=assigned.MaBM
      LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=t.MaNgDung
      JOIN BOMON bm ON bm.MaBM=assigned.MaBM JOIN KHOA k ON k.MaKhoa=bm.MaKhoa
      WHERE t.MaTK=@p1 AND k.TenKhoa IN(N'Công nghệ thông tin',N'Khoa Công nghệ thông tin',N'CNTT',N'Khoa CNTT')
      ORDER BY bm.TenBM`, [context.userId]);
  }
  async departments(context: SessionContext) { return this.memberships(context); }
  async boardMembers(context: SessionContext) {
    const memberships = await this.memberships(context); const ids = memberships.map((item) => item.MaBM);
    if (!ids.length) return [];
    return this.db.query(`SELECT DISTINCT gv.MaGV,n.HoTen,n.Email,gv.HocVi,COALESCE(link.VaiTro,N'Ban bộ môn') AS VaiTro,bm.TenBM FROM GIANGVIEN gv
      JOIN NGUOIDUNG n ON n.MaNgDung=gv.MaNgDung JOIN BOMON bm ON bm.MaBM IN(${ids.map((_, i) => `@p${i + 1}`).join(',')})
      LEFT JOIN GIANGVIEN_BOMON link ON link.MaGV=gv.MaGV AND link.MaBM=bm.MaBM
      WHERE gv.MaBM=bm.MaBM OR link.MaBM IS NOT NULL ORDER BY bm.TenBM,n.HoTen`, ids);
  }
  async list(context: SessionContext) {
    const memberships = await this.memberships(context);
    if (!memberships.length) return [];
    return this.db.query(`SELECT p.*,bm.TenBM,n.HoTen AS TenNguoiLap,
      CASE WHEN p.NguoiLap=@p1 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS LaNguoiLap,
      CASE WHEN EXISTS(SELECT 1 FROM GIANGVIEN gv JOIN TAIKHOAN t ON t.MaNgDung=gv.MaNgDung
        LEFT JOIN GIANGVIEN_BOMON gb ON gb.MaGV=gv.MaGV AND gb.MaBM=p.MaBM
        LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=gv.MaNgDung
        WHERE (gb.MaBM=p.MaBM OR gv.MaBM=p.MaBM)
          AND (gb.VaiTro IN(N'Trưởng bộ môn',N'Phụ trách bộ môn') OR cb.ChucVu IN(N'Trưởng bộ môn',N'Phụ trách bộ môn'))
          AND t.MaTK=@p1) THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS LaTruongBM,
      kh.TrangThai AS TrangThaiKeHoachKhoa
      FROM KEHOACHCUOCTHIBOMON p JOIN BOMON bm ON bm.MaBM=p.MaBM
      LEFT JOIN KEHOACHHOCTHUAT kh ON kh.MaKeHoach=p.MaKeHoachKhoa
      JOIN TAIKHOAN owner ON owner.MaTK=p.NguoiLap LEFT JOIN NGUOIDUNG n ON n.MaNgDung=owner.MaNgDung
      WHERE EXISTS(SELECT 1 FROM TAIKHOAN t JOIN GIANGVIEN gv ON gv.MaNgDung=t.MaNgDung
        WHERE t.MaTK=@p1 AND (gv.MaBM=p.MaBM OR EXISTS(SELECT 1 FROM GIANGVIEN_BOMON gb WHERE gb.MaGV=gv.MaGV AND gb.MaBM=p.MaBM)))
      ORDER BY p.NamHoc DESC,p.MaDeXuat DESC`, [context.userId]);
  }
  private validate(input: ProposalInput) {
    if (!input.namHoc?.trim() || !input.tenCuocThi?.trim() || !input.noiDung?.trim()) throw new BadRequestException('Cần nhập năm học, tên cuộc thi và nội dung');
    if (!Number.isFinite(input.duTruKinhPhi) || input.duTruKinhPhi < 0) throw new BadRequestException('Dự trù kinh phí không hợp lệ');
  }
  async create(context: SessionContext, input: ProposalInput) {
    this.validate(input);
    if (!(await this.memberships(context)).some(row => row.MaBM === input.maBM)) throw new ForbiddenException('Bạn không thuộc bộ môn đã chọn');
    const rows = await this.db.query(`INSERT INTO KEHOACHCUOCTHIBOMON(MaBM,NamHoc,TenCuocThi,NoiDung,DuTruKinhPhi,NguoiLap)
      OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4,@p5,@p6)`, [input.maBM,input.namHoc.trim(),input.tenCuocThi.trim(),input.noiDung.trim(),input.duTruKinhPhi,context.userId]);
    return rows[0];
  }
  private async proposal(context: SessionContext, id: number) {
    const row = (await this.db.query<{ MaBM:number; MaHD:number|null; NguoiLap:number; TrangThai:string }>('SELECT MaBM,MaHD,NguoiLap,TrangThai FROM KEHOACHCUOCTHIBOMON WHERE MaDeXuat=@p1',[id]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy đề xuất');
    if (!(await this.memberships(context)).some(item => item.MaBM === row.MaBM)) throw new ForbiddenException('Bạn không thuộc bộ môn này');
    return row;
  }
  async update(context: SessionContext, id: number, input: ProposalInput) {
    this.validate(input);
    const row = await this.proposal(context,id);
    if (row.NguoiLap !== Number(context.userId) || !['Dự thảo','Cần bổ sung','Khoa yêu cầu bổ sung'].includes(row.TrangThai)) throw new ForbiddenException('Chỉ người lập được sửa bản chưa trình duyệt');
    if (row.MaBM !== input.maBM) throw new BadRequestException('Không đổi bộ môn của đề xuất');
    const result = await this.db.query(`UPDATE KEHOACHCUOCTHIBOMON SET NamHoc=@p1,TenCuocThi=@p2,NoiDung=@p3,DuTruKinhPhi=@p4,
      TrangThai=N'Dự thảo',GhiChuDuyet=NULL,NgayCapNhat=SYSDATETIMEOFFSET() OUTPUT INSERTED.*
      WHERE MaDeXuat=@p5 AND NguoiLap=@p6 AND TrangThai IN(N'Dự thảo',N'Cần bổ sung',N'Khoa yêu cầu bổ sung')`,[input.namHoc.trim(),input.tenCuocThi.trim(),input.noiDung.trim(),input.duTruKinhPhi,id,context.userId]);
    if (!result[0]) throw new BadRequestException('Trạng thái đề xuất đã thay đổi');
    return result[0];
  }
  async submit(context: SessionContext, id: number) {
    const row = await this.proposal(context,id);
    if (row.NguoiLap !== Number(context.userId)) throw new ForbiddenException('Chỉ người lập được trình Trưởng bộ môn');
    const head = await this.db.query(`SELECT 1 AS ok FROM GIANGVIEN gv
      LEFT JOIN GIANGVIEN_BOMON gb ON gb.MaGV=gv.MaGV AND gb.MaBM=@p1
      LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=gv.MaNgDung
      WHERE (gb.MaBM=@p1 OR gv.MaBM=@p1) AND (gb.VaiTro IN(N'Trưởng bộ môn',N'Phụ trách bộ môn') OR cb.ChucVu IN(N'Trưởng bộ môn',N'Phụ trách bộ môn'))`,[row.MaBM]);
    if (!head.length) throw new BadRequestException('Bộ môn chưa được gán Trưởng bộ môn');
    const result = await this.db.query(`UPDATE KEHOACHCUOCTHIBOMON SET TrangThai=N'Chờ Trưởng bộ môn',NgayCapNhat=SYSDATETIMEOFFSET() OUTPUT INSERTED.*
      WHERE MaDeXuat=@p1 AND NguoiLap=@p2 AND TrangThai IN(N'Dự thảo',N'Cần bổ sung',N'Khoa yêu cầu bổ sung')`,[id,context.userId]);
    if (!result[0]) throw new BadRequestException('Chỉ trình được bản dự thảo hoặc cần bổ sung');
    return result[0];
  }
  async reviewByHead(context: SessionContext, id: number, approve: boolean, note?: string) {
    const row = await this.proposal(context,id);
    const head = await this.db.query(`SELECT 1 AS ok FROM TAIKHOAN t JOIN GIANGVIEN gv ON gv.MaNgDung=t.MaNgDung
      LEFT JOIN GIANGVIEN_BOMON gb ON gb.MaGV=gv.MaGV AND gb.MaBM=@p2 LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=gv.MaNgDung
      WHERE t.MaTK=@p1 AND (gb.MaBM=@p2 OR gv.MaBM=@p2)
        AND (gb.VaiTro IN(N'Trưởng bộ môn',N'Phụ trách bộ môn') OR cb.ChucVu IN(N'Trưởng bộ môn',N'Phụ trách bộ môn'))`,[context.userId,row.MaBM]);
    if (!head.length) throw new ForbiddenException('Chỉ Phụ trách bộ môn của bộ môn này được xem xét đề xuất');
    const result = await this.db.query(`UPDATE KEHOACHCUOCTHIBOMON SET TrangThai=@p1,GhiChuDuyet=@p2,NgayCapNhat=SYSDATETIMEOFFSET() OUTPUT INSERTED.*
      WHERE MaDeXuat=@p3 AND TrangThai=N'Chờ Trưởng bộ môn'`,[approve?'Chờ khoa':'Cần bổ sung',note?.trim()||null,id]);
    if (!result[0]) throw new BadRequestException('Đề xuất không còn chờ Trưởng bộ môn');
    if (row.MaHD) {
      await this.db.query(`UPDATE HOATDONGHOCTHUAT SET TrangThai=@p1 WHERE MaHD=@p2`,[approve?'Chờ duyệt':'Từ chối',row.MaHD]);
      if (!approve) {
        await this.db.query(`UPDATE DUTRUKINHPHI SET TrangThai=N'Cần bổ sung',GhiChuDuyet=@p1 WHERE MaHD=@p2 AND TrangThai<>N'Đã duyệt'`,[note?.trim()||null,row.MaHD]);
        await this.db.query(`UPDATE KINHPHIHOATDONG SET TrangThai=N'Cần bổ sung' WHERE MaHD=@p1 AND TrangThai<>N'Đã duyệt'`,[row.MaHD]);
        if (note?.trim()) await this.db.query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung) VALUES(@p1,@p2,N'Hoạt động học thuật',N'Đề xuất cần bổ sung',@p3)`,[row.NguoiLap,row.MaHD,note.trim()]);
      }
    }
    return result[0];
  }
  async facultyQueue(context: SessionContext) {
    if (!this.isAcademicCoordinator(context)) throw new ForbiddenException('Chỉ Trưởng ban học thuật tổng hợp mới được xử lý đề xuất đã qua Ban bộ môn');
    return this.db.query(`SELECT p.*,h.TenHoatDong,h.LoaiHoatDong,h.TgDuKien,h.DiaDiem,h.TrangThai AS TrangThaiHoatDong,
      bm.TenBM,n.HoTen AS TenNguoiLap,gv.HocVi,CAST(NULL AS NVARCHAR(150)) AS ChucDanh,cb.ChucVu,kh.TrangThai AS TrangThaiKeHoachKhoa FROM KEHOACHCUOCTHIBOMON p
      JOIN BOMON bm ON bm.MaBM=p.MaBM JOIN KHOA k ON k.MaKhoa=bm.MaKhoa
      LEFT JOIN HOATDONGHOCTHUAT h ON h.MaHD=p.MaHD JOIN TAIKHOAN t ON t.MaTK=p.NguoiLap
      LEFT JOIN NGUOIDUNG n ON n.MaNgDung=t.MaNgDung LEFT JOIN GIANGVIEN gv ON gv.MaNgDung=n.MaNgDung LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=n.MaNgDung
      LEFT JOIN KEHOACHHOCTHUAT kh ON kh.MaKeHoach=p.MaKeHoachKhoa
      WHERE k.TenKhoa IN(N'Công nghệ thông tin',N'Khoa Công nghệ thông tin',N'CNTT',N'Khoa CNTT')
        AND (@p1=1 OR EXISTS(SELECT 1 FROM TAIKHOAN actor
          LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=actor.MaNgDung LEFT JOIN GIANGVIEN actorGv ON actorGv.MaNgDung=actor.MaNgDung
          WHERE actor.MaTK=@p2 AND (cb.MaKhoa=bm.MaKhoa OR EXISTS(SELECT 1 FROM BOMON actorBm WHERE actorBm.MaBM=actorGv.MaBM AND actorBm.MaKhoa=bm.MaKhoa)
            OR EXISTS(SELECT 1 FROM GIANGVIEN_BOMON actorLink JOIN BOMON actorBm ON actorBm.MaBM=actorLink.MaBM WHERE actorLink.MaGV=actorGv.MaGV AND actorBm.MaKhoa=bm.MaKhoa))))
        AND p.TrangThai IN(N'Chờ khoa',N'Đã duyệt',N'Khoa yêu cầu bổ sung') ORDER BY p.NamHoc DESC,p.MaDeXuat DESC`,
      [this.isAdmin(context) ? 1 : 0, context.userId]);
  }
  async reviewByFaculty(context: SessionContext, id: number, approve: boolean, note?: string) {
    if (!this.isAcademicCoordinator(context)) throw new ForbiddenException('Chỉ Trưởng ban học thuật tổng hợp mới được xử lý bước tổng hợp');
    const result = await this.db.query(`UPDATE p SET TrangThai=@p1,GhiChuDuyet=@p2,NgayCapNhat=SYSDATETIMEOFFSET() OUTPUT INSERTED.*
      FROM KEHOACHCUOCTHIBOMON p JOIN BOMON bm ON bm.MaBM=p.MaBM JOIN KHOA k ON k.MaKhoa=bm.MaKhoa
      WHERE p.MaDeXuat=@p3 AND p.TrangThai=N'Chờ khoa' AND p.MaKeHoachKhoa IS NULL
        AND k.TenKhoa IN(N'Công nghệ thông tin',N'Khoa Công nghệ thông tin',N'CNTT',N'Khoa CNTT')
        AND (@p4=1 OR EXISTS(SELECT 1 FROM TAIKHOAN actor
          LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=actor.MaNgDung LEFT JOIN GIANGVIEN actorGv ON actorGv.MaNgDung=actor.MaNgDung
          WHERE actor.MaTK=@p5 AND (cb.MaKhoa=bm.MaKhoa OR EXISTS(SELECT 1 FROM BOMON actorBm WHERE actorBm.MaBM=actorGv.MaBM AND actorBm.MaKhoa=bm.MaKhoa)
            OR EXISTS(SELECT 1 FROM GIANGVIEN_BOMON actorLink JOIN BOMON actorBm ON actorBm.MaBM=actorLink.MaBM WHERE actorLink.MaGV=actorGv.MaGV AND actorBm.MaKhoa=bm.MaKhoa))))`,[approve?'Đã duyệt':'Khoa yêu cầu bổ sung',note?.trim()||null,id,this.isAdmin(context)?1:0,context.userId]);
    if (!result[0]) throw new BadRequestException('Đề xuất không còn chờ khoa');
    if (!approve) {
      const activity = (await this.db.query<{ MaHD:number|null; NguoiLap:number }>(`SELECT MaHD,NguoiLap FROM KEHOACHCUOCTHIBOMON WHERE MaDeXuat=@p1`,[id]))[0];
      if (activity?.MaHD) {
        await this.db.query(`UPDATE HOATDONGHOCTHUAT SET TrangThai=N'Từ chối' WHERE MaHD=@p1`,[activity.MaHD]);
        await this.db.query(`UPDATE DUTRUKINHPHI SET TrangThai=N'Cần bổ sung',GhiChuDuyet=@p1 WHERE MaHD=@p2 AND TrangThai<>N'Đã duyệt'`,[note?.trim()||null,activity.MaHD]);
        await this.db.query(`UPDATE KINHPHIHOATDONG SET TrangThai=N'Cần bổ sung' WHERE MaHD=@p1 AND TrangThai<>N'Đã duyệt'`,[activity.MaHD]);
        if (note?.trim()) await this.db.query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung) VALUES(@p1,@p2,N'Hoạt động học thuật',N'Đề xuất cần bổ sung',@p3)`,[activity.NguoiLap,activity.MaHD,note.trim()]);
      }
    }
    return result[0];
  }
  async attachToFacultyPlan(context: SessionContext, proposalId: number, planId: number) {
    if (!this.isAcademicCoordinator(context)) throw new ForbiddenException('Chỉ Trưởng ban học thuật tổng hợp mới được gộp đề xuất vào kế hoạch');
    const rows = await this.db.query(`UPDATE p SET MaKeHoachKhoa=@p2,NgayCapNhat=SYSDATETIMEOFFSET()
      OUTPUT INSERTED.* FROM KEHOACHCUOCTHIBOMON p
      JOIN BOMON bm ON bm.MaBM=p.MaBM
      JOIN KHOA k ON k.MaKhoa=bm.MaKhoa
      JOIN KEHOACHHOCTHUAT kh ON kh.MaKeHoach=@p2 AND kh.MaKhoa=bm.MaKhoa AND kh.NamHoc=p.NamHoc
      WHERE p.MaDeXuat=@p1 AND p.TrangThai=N'Đã duyệt' AND p.MaKeHoachKhoa IS NULL AND kh.TrangThai IN(N'Dự thảo',N'Cần bổ sung')
        AND k.TenKhoa IN(N'Công nghệ thông tin',N'Khoa Công nghệ thông tin',N'CNTT',N'Khoa CNTT')
        AND (@p3=1 OR EXISTS(SELECT 1 FROM TAIKHOAN actor
          LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=actor.MaNgDung LEFT JOIN GIANGVIEN actorGv ON actorGv.MaNgDung=actor.MaNgDung
          WHERE actor.MaTK=@p4 AND (cb.MaKhoa=bm.MaKhoa OR EXISTS(SELECT 1 FROM BOMON actorBm WHERE actorBm.MaBM=actorGv.MaBM AND actorBm.MaKhoa=bm.MaKhoa)
            OR EXISTS(SELECT 1 FROM GIANGVIEN_BOMON actorLink JOIN BOMON actorBm ON actorBm.MaBM=actorLink.MaBM WHERE actorLink.MaGV=actorGv.MaGV AND actorBm.MaKhoa=bm.MaKhoa))))`, [proposalId,planId,this.isAdmin(context)?1:0,context.userId]);
    if (rows[0]?.MaHD) await this.db.query(`UPDATE HOATDONGHOCTHUAT SET MaKeHoachKhoa=@p1,MaKeHoach=NULL WHERE MaHD=@p2`,[planId,rows[0].MaHD]);
    if (!rows[0]) throw new BadRequestException('Chỉ gộp đề xuất đã duyệt vào kế hoạch khoa còn là dự thảo, cùng năm học');
    return rows[0];
  }
}
