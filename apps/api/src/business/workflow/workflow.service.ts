import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import sql from 'mssql';
import { DatabaseService } from '../../data/database.service';
import type { SessionContext } from '../auth/auth.types';
import { ActivityChangeDto, AdjustTrainingPointDto, CompetitionResultDto, CreatePlanActivityDto, CreatePlanDto, CreateRoundDto, ReviewPlanDto, ScoreWorkDto, SubmitWorkDto, AwardTrainingPointDto, CreateStudentAccountDto, CreateStudentProfileDto, CreateLinkedStudentProfileDto, SeminarMaterialDto, UpdateStudentRecordDto, CreateClassDto, UpdateClassDto, UpdateStaffRecordDto, CreateStaffRecordDto, CreateStaffAccountDto, CreateAcademicActivityDto, UpdateAcademicActivityDto, CreateCommitteeMemberDto, CreateActivityBudgetDto, CreateBudgetEstimateDto, ReviewActivityBudgetDto } from '../../presentation/workflow/workflow.dto';

const key = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const planReaderRoles = ['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','TRUONG_BO_MON','TRUONGBOMON','TRUONGKHOA','PHONG_KHCN','PHONGKHCN','HIEU_TRUONG','HIEUTRUONG'];
type PlanFaculty = { MaKhoa: number; TenKhoa: string };
type AnnualProposal = { MaHD: number; NguoiLap: number; MaBM: number | null; NamHoc: string | null; TenHoatDong: string; NoiDung: string | null; TrangThai: string };
function parseActivityDate(value: string | Date | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const localized = /^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/.exec(raw);
  let parsed: Date;
  if (iso) parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  else if (localized) parsed = new Date(Number(localized[3]), Number(localized[2]) - 1, Number(localized[1]));
  else parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
@Injectable()
export class WorkflowService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private require(context: SessionContext, roles: string[]) {
    const allowed = new Set(roles.map(key));
    if (!context.user.roles.some(role => allowed.has(key(role)))) throw new ForbiddenException('Bạn không có quyền thực hiện chức năng này');
  }
  private requireAcademicCoordinator(context: SessionContext) {
    const isCoordinator = context.user.roles.some(role => key(role) === 'ADMIN')
      || key(context.user.position ?? '').includes('TRUONGBANHOCTHUAT');
    if (!isCoordinator) throw new ForbiddenException('Chỉ Trưởng ban học thuật tổng hợp mới được tạo, gộp hoặc trình kế hoạch');
  }
  private isAcademicCoordinator(context: SessionContext) {
    return context.user.roles.some(role => key(role) === 'TRUONGBANHOCTHUAT')
      || key(context.user.position ?? '').includes('TRUONGBANHOCTHUAT');
  }

  private async refreshActivityBudgetSummary(activityId: number, transaction?: sql.Transaction) {
    const statement = `;WITH RoundMarkerState AS (
      SELECT line.MaKPHD,line.MaHD,line.SoTien,
        MAX(CASE WHEN LTRIM(line.NoiDung) LIKE N'Vòng 1%' THEN line.MaKPHD END)
          OVER (PARTITION BY line.MaHD ORDER BY line.MaKPHD ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS LastV1,
        MAX(CASE WHEN LTRIM(line.NoiDung) LIKE N'Vòng 2%' THEN line.MaKPHD END)
          OVER (PARTITION BY line.MaHD ORDER BY line.MaKPHD ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS LastV2
      FROM KINHPHIHOATDONG line WHERE line.MaHD=@p1
    ),
    RoundTotals AS (
      SELECT MaHD,
        SUM(CASE WHEN LastV1 IS NOT NULL AND (LastV2 IS NULL OR LastV1 > LastV2) THEN SoTien ELSE 0 END) AS TongTienV1,
        SUM(CASE WHEN LastV2 IS NOT NULL AND (LastV1 IS NULL OR LastV2 > LastV1) THEN SoTien ELSE 0 END) AS TongTienV2
      FROM RoundMarkerState GROUP BY MaHD
    )
    UPDATE line
    SET SLSinhVien=TRY_CONVERT(INT,NULLIF(activity.SLSVDuKien,N'')),
        TongTienV1=COALESCE(total.TongTienV1,0),
        TongTienV2=COALESCE(total.TongTienV2,0)
    FROM KINHPHIHOATDONG line
    JOIN HOATDONGHOCTHUAT activity ON activity.MaHD=line.MaHD
    LEFT JOIN RoundTotals total ON total.MaHD=line.MaHD
    WHERE line.MaHD=@p1`;
    if (transaction) {
      await new sql.Request(transaction).input('p1', sql.BigInt, activityId).query(statement);
      return;
    }
    await this.db.query(statement, [activityId]);
  }

  async listAccounts(context: SessionContext) {
    this.require(context, ['ADMIN']);
    return this.db.query(`
      SELECT a.MaTK, a.MaNgDung, a.TenDangNhap, a.TrangThai, r.MaVaiTro, r.TenVaiTro,
        cb.ChucVu,
        COALESCE(
          cb.ChucVu, 
          CASE 
            WHEN s.MaSV IS NOT NULL THEN N'Sinh viên'
            WHEN gv.MaGV IS NOT NULL THEN N'Giảng viên'
            WHEN UPPER(REPLACE(REPLACE(r.TenVaiTro,N' ',N''),N'_',N'')) IN (N'ADMIN',N'QUANTRIVIEN',N'QUẢNTRỊVIÊN') THEN N'Quản trị viên'
            ELSE r.TenVaiTro
          END
        ) AS ChucVuVaiTro,
        COALESCE(n.HoTen, a.TenDangNhap) AS HoTen, n.Email, n.SDT,
        CASE
          WHEN s.MaSV IS NOT NULL THEN s.MSSV
          WHEN gv.MaGV IS NOT NULL THEN CONCAT('GV', RIGHT(CONCAT('0000', gv.MaGV), 4))
          WHEN cb.MaCanBo IS NOT NULL THEN CONCAT('GV', RIGHT(CONCAT('0000', cb.MaCanBo), 4))
          ELSE a.TenDangNhap
        END AS MaDinhDanh,
        COALESCE(l.TenLop, bm.TenBM, k.TenKhoa, N'Khoa CNTT') AS DonViLop,
        CASE 
          WHEN s.MaSV IS NOT NULL THEN 'SINHVIEN'
          WHEN gv.MaGV IS NOT NULL OR cb.MaCanBo IS NOT NULL
            OR UPPER(REPLACE(REPLACE(r.TenVaiTro,N' ',N''),N'_',N'')) IN (N'ADMIN',N'QUANTRIVIEN',N'QUẢNTRỊVIÊN') THEN 'CANBO'
          ELSE 'KHAC'
        END AS LoaiDoiTuong
      FROM TAIKHOAN a
      JOIN VAITRO r ON r.MaVaiTro = a.MaVaiTro
      LEFT JOIN NGUOIDUNG n ON n.MaNgDung = a.MaNgDung
      LEFT JOIN GIANGVIEN gv ON gv.MaNgDung = n.MaNgDung
      LEFT JOIN BOMON bm ON bm.MaBM = gv.MaBM
      LEFT JOIN CANBOKHOA cb ON cb.MaNgDung = n.MaNgDung
      LEFT JOIN KHOA k ON k.MaKhoa = cb.MaKhoa
      LEFT JOIN SINHVIEN s ON s.MaNgDung = n.MaNgDung
      LEFT JOIN LOP l ON l.MaLop = s.MaLop
      ORDER BY a.MaTK
    `);
  }

  async listStaffRecords(context: SessionContext) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    return this.db.query(`
      SELECT 
        n.MaNgDung, n.HoTen, n.Email, n.SDT, n.NgaySinh, n.GioiTinh, n.TrangThai,
        gv.MaGV, gv.HocVi, bm.MaBM, bm.TenBM,
        (SELECT STRING_AGG(bm2.TenBM, N', ') WITHIN GROUP (ORDER BY bm2.MaBM)
         FROM GIANGVIEN_BOMON gb2 JOIN BOMON bm2 ON bm2.MaBM = gb2.MaBM
         WHERE gb2.MaGV = gv.MaGV) AS DanhSachTenBM,
        (SELECT STRING_AGG(CAST(gb2.MaBM AS NVARCHAR(10)), N',') WITHIN GROUP (ORDER BY gb2.MaBM)
         FROM GIANGVIEN_BOMON gb2
         WHERE gb2.MaGV = gv.MaGV) AS DanhSachMaBM,
        cb.MaCanBo, cb.ChucVu, k.MaKhoa, k.TenKhoa,
        CAST(NULL AS INT) AS MaQuanTri, CAST(NULL AS NVARCHAR(250)) AS MoTaQuanTri,
        a.MaTK, a.TenDangNhap, r.TenVaiTro,
        CONCAT('GV', RIGHT(CONCAT('0000', COALESCE(gv.MaGV, cb.MaCanBo, n.MaNgDung)), 4)) AS MaDinhDanh,
        COALESCE(
          (SELECT STRING_AGG(bm2.TenBM, N', ') WITHIN GROUP (ORDER BY bm2.MaBM)
           FROM GIANGVIEN_BOMON gb2 JOIN BOMON bm2 ON bm2.MaBM = gb2.MaBM
           WHERE gb2.MaGV = gv.MaGV),
          bm.TenBM, k.TenKhoa, N'Khoa CNTT'
        ) AS DonViCongTac
      FROM NGUOIDUNG n
      LEFT JOIN GIANGVIEN gv ON gv.MaNgDung = n.MaNgDung
      LEFT JOIN BOMON bm ON bm.MaBM = gv.MaBM
      LEFT JOIN CANBOKHOA cb ON cb.MaNgDung = n.MaNgDung
      LEFT JOIN KHOA k ON k.MaKhoa = cb.MaKhoa
      LEFT JOIN TAIKHOAN a ON a.MaNgDung = n.MaNgDung
      LEFT JOIN VAITRO r ON r.MaVaiTro = a.MaVaiTro
      WHERE NOT EXISTS (SELECT 1 FROM SINHVIEN s WHERE s.MaNgDung = n.MaNgDung)
      ORDER BY n.MaNgDung
    `);
  }

  async updateStaffRecord(context: SessionContext, id: number, dto: UpdateStaffRecordDto) {
    this.require(context, ['ADMIN']);
    const user = (await this.db.query<{ MaNgDung: number }>('SELECT MaNgDung FROM NGUOIDUNG WHERE MaNgDung=@p1', [id]))[0];
    if (!user) throw new NotFoundException('Không tìm thấy cán bộ / giảng viên');
    const currentStaff = (await this.db.query<{ MaBM: number | null; ChucVu: string | null }>(`SELECT gv.MaBM,cb.ChucVu FROM NGUOIDUNG n
      LEFT JOIN GIANGVIEN gv ON gv.MaNgDung=n.MaNgDung LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=n.MaNgDung WHERE n.MaNgDung=@p1`, [id]))[0];
    const intendedDepartment = dto.maBMList?.[0] ?? dto.maBM ?? currentStaff?.MaBM;
    if ((dto.chucVu ?? currentStaff?.ChucVu)?.trim() === 'Trưởng bộ môn' && intendedDepartment) {
      const otherHead = await this.db.query(`SELECT TOP 1 gv.MaGV FROM GIANGVIEN gv JOIN CANBOKHOA cb ON cb.MaNgDung=gv.MaNgDung
        WHERE gv.MaBM=@p1 AND cb.ChucVu=N'Trưởng bộ môn' AND gv.MaNgDung<>@p2`, [intendedDepartment, id]);
      if (otherHead.length) throw new ConflictException('Bộ môn này đã có Trưởng bộ môn');
    }

    if (dto.hoTen !== undefined || dto.email !== undefined || dto.sdt !== undefined || dto.trangThai !== undefined) {
      await this.db.query(
        'UPDATE NGUOIDUNG SET HoTen = COALESCE(@p1, HoTen), Email = COALESCE(@p2, Email), SDT = COALESCE(@p3, SDT), TrangThai = COALESCE(@p4, TrangThai) WHERE MaNgDung = @p5',
        [dto.hoTen ?? null, dto.email ?? null, dto.sdt ?? null, dto.trangThai ?? null, id],
      );
    }

    const gv = (await this.db.query<{ MaGV: number }>('SELECT MaGV FROM GIANGVIEN WHERE MaNgDung=@p1', [id]))[0];
    if (gv) {
      if (dto.hocVi !== undefined || dto.maBM !== undefined || dto.maBMList !== undefined) {
        const primaryBM = (dto.maBMList && dto.maBMList.length > 0)
          ? dto.maBMList[0]
          : (dto.maBM !== undefined ? dto.maBM : null);
        await this.db.query(
          'UPDATE GIANGVIEN SET HocVi = CASE WHEN @p1 IS NOT NULL THEN @p1 ELSE HocVi END, MaBM = CASE WHEN @p2 IS NOT NULL THEN @p2 ELSE MaBM END WHERE MaNgDung = @p3',
          [dto.hocVi ?? null, primaryBM, id],
        );
      }

      if (dto.maBMList !== undefined) {
        const selected = [...new Set(dto.maBMList.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
        const existing = await this.db.query<{ MaBM: number }>('SELECT MaBM FROM GIANGVIEN_BOMON WHERE MaGV=@p1', [gv.MaGV]);
        for (const membership of existing) {
          if (!selected.includes(membership.MaBM)) {
            await this.db.query('DELETE FROM GIANGVIEN_BOMON WHERE MaGV=@p1 AND MaBM=@p2', [gv.MaGV, membership.MaBM]);
          }
        }
        for (const bmId of selected) {
          if (bmId) {
            await this.db.query(
              `IF NOT EXISTS (SELECT 1 FROM GIANGVIEN_BOMON WHERE MaGV=@p1 AND MaBM=@p2)
               INSERT INTO GIANGVIEN_BOMON (MaGV, MaBM, VaiTro) VALUES (@p1, @p2, N'Phụ trách')`,
              [gv.MaGV, bmId],
            );
          }
        }
      }
    } else if (dto.hocVi || dto.maBM || (dto.maBMList && dto.maBMList.length > 0)) {
      const primaryBM = (dto.maBMList && dto.maBMList.length > 0)
        ? dto.maBMList[0]
        : (dto.maBM ?? null);
      const newGv = await this.db.query<{ MaGV: number }>(
        'INSERT INTO GIANGVIEN (MaNgDung, HocVi, MaBM) OUTPUT INSERTED.MaGV VALUES (@p1, @p2, @p3)',
        [id, dto.hocVi ?? null, primaryBM],
      );
      const newMaGV = newGv[0]?.MaGV;
      if (newMaGV && dto.maBMList && dto.maBMList.length > 0) {
        for (const bmId of dto.maBMList) {
          if (bmId) {
            await this.db.query(
              'INSERT INTO GIANGVIEN_BOMON (MaGV, MaBM, VaiTro) VALUES (@p1, @p2, N\'Phụ trách\')',
              [newMaGV, bmId],
            );
          }
        }
      }
    }

    const cb = (await this.db.query<{ MaCanBo: number }>('SELECT MaCanBo FROM CANBOKHOA WHERE MaNgDung=@p1', [id]))[0];
    if (cb) {
      if (dto.chucVu !== undefined || dto.maKhoa !== undefined) {
        await this.db.query(
          'UPDATE CANBOKHOA SET ChucVu = CASE WHEN @p1 IS NOT NULL THEN @p1 ELSE ChucVu END, MaKhoa = CASE WHEN @p2 IS NOT NULL THEN @p2 ELSE MaKhoa END WHERE MaNgDung = @p3',
          [dto.chucVu ?? null, dto.maKhoa ?? null, id],
        );
      }
    } else if (dto.chucVu) {
      await this.db.query(
        'INSERT INTO CANBOKHOA (MaNgDung, MaKhoa, ChucVu) VALUES (@p1, COALESCE(@p2, 1), @p3)',
        [id, dto.maKhoa ?? 1, dto.chucVu],
      );
    }

    return { success: true, message: 'Đã cập nhật hồ sơ cán bộ / giảng viên' };
  }

  async deleteStaffRecord(context: SessionContext, id: number) {
    this.require(context, ['ADMIN']);
    const user = (await this.db.query<{ MaNgDung: number }>('SELECT MaNgDung FROM NGUOIDUNG WHERE MaNgDung=@p1', [id]))[0];
    if (!user) throw new NotFoundException('Không tìm thấy cán bộ / giảng viên');

    const gv = (await this.db.query<{ MaGV: number }>('SELECT MaGV FROM GIANGVIEN WHERE MaNgDung=@p1', [id]))[0];
    if (gv) {
      await this.db.query('DELETE FROM GIANGVIEN_BOMON WHERE MaGV = @p1', [gv.MaGV]);
      await this.db.query('UPDATE DETAI SET MaGVHD = NULL WHERE MaGVHD = @p1', [gv.MaGV]);
    }

    const cb = (await this.db.query<{ MaCanBo: number }>('SELECT MaCanBo FROM CANBOKHOA WHERE MaNgDung=@p1', [id]))[0];
    if (cb) {
      await this.db.query('UPDATE KEHOACHHOCTHUAT SET NgPhuTrach = NULL WHERE NgPhuTrach = @p1', [cb.MaCanBo]);
    }

    await this.db.query('DELETE FROM BANCHIDAO WHERE MaNgDung = @p1', [id]);
    await this.db.query('DELETE FROM BANGIAMKHAO WHERE MaNgDung = @p1', [id]);
    await this.db.query('DELETE FROM BANHOTRO WHERE MaNgDung = @p1', [id]);
    await this.db.query('DELETE FROM BANTOCHUC WHERE MaNgDung = @p1', [id]);
    await this.db.query('DELETE FROM PHANCONGTHUCHIEN WHERE MaNgDung = @p1', [id]);

    await this.db.query('DELETE FROM GIANGVIEN WHERE MaNgDung = @p1', [id]);
    await this.db.query('DELETE FROM CANBOKHOA WHERE MaNgDung = @p1', [id]);
    await this.db.query('DELETE FROM TAIKHOAN WHERE MaNgDung = @p1', [id]);
    await this.db.query('DELETE FROM NGUOIDUNG WHERE MaNgDung = @p1', [id]);

    return { success: true, message: 'Đã xóa hồ sơ cán bộ / giảng viên' };
  }

  async createStaffRecord(context: SessionContext, dto: CreateStaffRecordDto) {
    this.require(context, ['ADMIN']);
    const hoTen = dto.hoTen.trim();
    const hocVi = dto.hocVi.trim();
    const chucVu = dto.chucVu.trim();
    const bmList = (dto.maBMList && dto.maBMList.length > 0)
      ? dto.maBMList.map(Number).filter((n) => !isNaN(n) && n > 0)
      : (dto.maBM ? [Number(dto.maBM)] : []);
    const email = dto.email?.trim() || null;
    const sdt = dto.sdt?.trim() || null;

    if (!hoTen || !hocVi || !chucVu || bmList.length === 0) {
      throw new BadRequestException('Vui lòng điền đầy đủ Họ và tên, Học hàm/Học vị, Chức vụ và chọn ít nhất một Bộ môn trực thuộc');
    }

    const primaryMaBM = bmList[0];
    if (chucVu === 'Trưởng bộ môn') {
      const otherHead = await this.db.query(`SELECT TOP 1 gv.MaGV FROM GIANGVIEN gv JOIN CANBOKHOA cb ON cb.MaNgDung=gv.MaNgDung
        WHERE gv.MaBM=@p1 AND cb.ChucVu=N'Trưởng bộ môn'`, [primaryMaBM]);
      if (otherHead.length) throw new ConflictException('Bộ môn này đã có Trưởng bộ môn');
    }

    // 1. Insert NGUOIDUNG
    const userResult = await this.db.query<{ MaNgDung: number }>(
      `INSERT INTO NGUOIDUNG (HoTen, Email, SDT, TrangThai)
       OUTPUT INSERTED.MaNgDung
       VALUES (@p1, @p2, @p3, N'Hoạt động')`,
      [hoTen, email, sdt],
    );
    const maNgDung = userResult[0].MaNgDung;

    // 2. Insert GIANGVIEN
    const gvResult = await this.db.query<{ MaGV: number }>(
      `INSERT INTO GIANGVIEN (MaNgDung, HocVi, MaBM)
       OUTPUT INSERTED.MaGV
       VALUES (@p1, @p2, @p3)`,
      [maNgDung, hocVi, primaryMaBM],
    );
    const maGV = gvResult[0].MaGV;

    // 3. Insert GIANGVIEN_BOMON
    for (const bmId of bmList) {
      await this.db.query(
        `INSERT INTO GIANGVIEN_BOMON (MaGV, MaBM, VaiTro)
         VALUES (@p1, @p2, N'Phụ trách')`,
        [maGV, bmId],
      );
    }

    // 4. Find MaKhoa of primary BOMON
    const dept = (await this.db.query<{ MaKhoa: number }>('SELECT MaKhoa FROM BOMON WHERE MaBM = @p1', [primaryMaBM]))[0];
    const maKhoa = dept?.MaKhoa ?? 1;

    // 5. Insert CANBOKHOA if chucVu is not strictly Giảng viên
    if (chucVu.toLowerCase() !== 'giảng viên') {
      await this.db.query(
        `INSERT INTO CANBOKHOA (MaNgDung, MaKhoa, ChucVu)
         VALUES (@p1, @p2, @p3)`,
        [maNgDung, maKhoa, chucVu],
      );
    }

    // 6. Create account if requested
    if (dto.createAccount && dto.username && dto.password) {
      const username = dto.username.trim();
      const existing = (await this.db.query<{ MaTK: number }>('SELECT MaTK FROM TAIKHOAN WHERE TenDangNhap = @p1', [username]))[0];
      if (existing) throw new ConflictException(`Tên đăng nhập "${username}" đã tồn tại`);

      const passwordHash = await hash(dto.password, 12);
      const roleId = dto.roleId ?? 3; // Default 3: Giảng viên
      await this.db.query(
        `INSERT INTO TAIKHOAN (MaNgDung, MaVaiTro, TenDangNhap, MatKhau, TrangThai)
         VALUES (@p1, @p2, @p3, @p4, N'Hoạt động')`,
        [maNgDung, roleId, username, passwordHash],
      );
    }

    return { success: true, message: 'Đã thêm hồ sơ cán bộ / giảng viên thành công', maNgDung };
  }

  async createStaffAccount(context: SessionContext, id: number, dto: CreateStaffAccountDto) {
    this.require(context, ['ADMIN']);
    const user = (await this.db.query<{ MaNgDung: number; HoTen: string }>('SELECT MaNgDung, HoTen FROM NGUOIDUNG WHERE MaNgDung = @p1', [id]))[0];
    if (!user) throw new NotFoundException('Không tìm thấy cán bộ / giảng viên');

    const hasAccount = (await this.db.query<{ MaTK: number }>('SELECT MaTK FROM TAIKHOAN WHERE MaNgDung = @p1', [id]))[0];
    if (hasAccount) throw new BadRequestException('Cán bộ / giảng viên này đã có tài khoản');

    const username = dto.username.trim();
    const existing = (await this.db.query<{ MaTK: number }>('SELECT MaTK FROM TAIKHOAN WHERE TenDangNhap = @p1', [username]))[0];
    if (existing) throw new ConflictException(`Tên đăng nhập "${username}" đã tồn tại`);

    const passwordHash = await hash(dto.password, 12);
    await this.db.query(
      `INSERT INTO TAIKHOAN (MaNgDung, MaVaiTro, TenDangNhap, MatKhau, TrangThai)
       VALUES (@p1, @p2, @p3, @p4, N'Hoạt động')`,
      [id, dto.roleId, username, passwordHash],
    );

    return { success: true, message: `Đã cấp tài khoản "${username}" cho ${user.HoTen}` };
  }

  async listDepartments(context: SessionContext) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN', 'PHONGKHCN', 'HIEUTRUONG']);
    return this.db.query(`SELECT bm.MaBM, bm.TenBM, k.MaKhoa, k.TenKhoa FROM BOMON bm JOIN KHOA k ON k.MaKhoa = bm.MaKhoa ORDER BY bm.TenBM`);
  }

  async listAccountRoles(context: SessionContext) {
    this.require(context, ['ADMIN']);
    return this.db.query(`SELECT MaVaiTro,TenVaiTro FROM VAITRO ORDER BY TenVaiTro`);
  }

  async listUnlinkedStudentProfiles(context: SessionContext) {
    this.require(context, ['ADMIN']);
    return this.db.query(`SELECT n.MaNgDung,s.MaSV,s.MSSV,n.HoTen,l.TenLop
      FROM SINHVIEN s JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung
      JOIN LOP l ON l.MaLop=s.MaLop
      WHERE n.TrangThai=N'Hoạt động'
        AND NOT EXISTS (SELECT 1 FROM TAIKHOAN a WHERE a.MaNgDung=n.MaNgDung)
      ORDER BY s.MSSV,n.HoTen`);
  }

  async listUnlinkedStudentAccounts(context: SessionContext) {
    this.require(context, ['ADMIN']);
    const accounts = await this.db.query<{ MaTK:number; TenDangNhap:string; TrangThai:string; TenVaiTro:string }>(`SELECT a.MaTK,a.TenDangNhap,a.TrangThai,r.TenVaiTro
      FROM TAIKHOAN a JOIN VAITRO r ON r.MaVaiTro=a.MaVaiTro
      WHERE a.MaNgDung IS NULL AND a.TrangThai=N'Hoạt động'
      ORDER BY a.TenDangNhap`);
    return accounts.filter((account) => !['ADMIN','QUANTRIVIEN'].includes(key(account.TenVaiTro)));
  }


  async listClasses(context: SessionContext) {
    this.require(context, ['ADMIN', 'CANBOKHOA']);
    return this.db.query(`SELECT l.MaLop, l.TenLop, l.KhoaHoc, l.MaKhoa, k.TenKhoa,
        COUNT(s.MaSV) AS SiSo,
        COUNT(CASE WHEN n.TrangThai = N'Hoạt động' THEN 1 END) AS SoSVHoatDong
      FROM LOP l
      JOIN KHOA k ON k.MaKhoa = l.MaKhoa
      LEFT JOIN SINHVIEN s ON s.MaLop = l.MaLop
      LEFT JOIN NGUOIDUNG n ON n.MaNgDung = s.MaNgDung
      GROUP BY l.MaLop, l.TenLop, l.KhoaHoc, l.MaKhoa, k.TenKhoa
      ORDER BY k.TenKhoa, l.TenLop`);
  }

  async listFaculties(context: SessionContext) {
    this.require(context, ['ADMIN', 'CANBOKHOA']);
    return this.db.query(`SELECT MaKhoa, TenKhoa FROM KHOA ORDER BY TenKhoa`);
  }

  async listClassStudents(context: SessionContext, maLop: number) {
    this.require(context, ['ADMIN', 'CANBOKHOA']);
    return this.db.query(
      `SELECT s.MaSV, s.MSSV, n.HoTen, n.Email, n.SDT, n.NgaySinh, n.GioiTinh, n.TrangThai
       FROM SINHVIEN s
       JOIN NGUOIDUNG n ON n.MaNgDung = s.MaNgDung
       WHERE s.MaLop = @p1
       ORDER BY s.MSSV`,
      [maLop],
    );
  }

  async createClass(context: SessionContext, dto: CreateClassDto) {
    this.require(context, ['ADMIN']);
    const existing = await this.db.query<{ MaLop: number }>(
      `SELECT MaLop FROM LOP WHERE TenLop = @p1 AND MaKhoa = @p2`,
      [dto.tenLop.trim(), dto.maKhoa],
    );
    if (existing.length) {
      throw new ConflictException(`Lớp "${dto.tenLop}" đã tồn tại trong khoa này.`);
    }
    const inserted = await this.db.query<{ MaLop: number }>(
      `INSERT INTO LOP (TenLop, MaKhoa, KhoaHoc)
       OUTPUT INSERTED.MaLop
       VALUES (@p1, @p2, @p3)`,
      [dto.tenLop.trim(), dto.maKhoa, dto.khoaHoc?.trim() || null],
    );
    return { success: true, maLop: inserted[0]?.MaLop };
  }

  async updateClass(context: SessionContext, maLop: number, dto: UpdateClassDto) {
    this.require(context, ['ADMIN']);
    const current = await this.db.query<{ MaLop: number; TenLop: string; MaKhoa: number; KhoaHoc: string }>(
      `SELECT MaLop, TenLop, MaKhoa, KhoaHoc FROM LOP WHERE MaLop = @p1`,
      [maLop],
    );
    if (!current.length) {
      throw new NotFoundException(`Không tìm thấy lớp có mã ${maLop}.`);
    }
    const tenLop = dto.tenLop !== undefined ? dto.tenLop.trim() : current[0].TenLop;
    const maKhoa = dto.maKhoa !== undefined ? dto.maKhoa : current[0].MaKhoa;
    const khoaHoc = dto.khoaHoc !== undefined ? dto.khoaHoc.trim() : current[0].KhoaHoc;

    if (tenLop !== current[0].TenLop || maKhoa !== current[0].MaKhoa) {
      const duplicate = await this.db.query<{ MaLop: number }>(
        `SELECT MaLop FROM LOP WHERE TenLop = @p1 AND MaKhoa = @p2 AND MaLop <> @p3`,
        [tenLop, maKhoa, maLop],
      );
      if (duplicate.length) {
        throw new ConflictException(`Tên lớp "${tenLop}" đã tồn tại trong khoa này.`);
      }
    }

    await this.db.query(
      `UPDATE LOP SET TenLop = @p1, MaKhoa = @p2, KhoaHoc = @p3 WHERE MaLop = @p4`,
      [tenLop, maKhoa, khoaHoc, maLop],
    );
    return { success: true, maLop };
  }

  async deleteClass(context: SessionContext, maLop: number) {
    this.require(context, ['ADMIN']);
    const students = await this.db.query<{ Count: number }>(
      `SELECT COUNT(*) AS [Count] FROM SINHVIEN WHERE MaLop = @p1`,
      [maLop],
    );
    if (students[0]?.Count > 0) {
      throw new BadRequestException(`Không thể xóa lớp vì đang có ${students[0].Count} sinh viên trong lớp này.`);
    }
    const assigned = await this.db.query<{ Count: number }>(
      `SELECT COUNT(*) AS [Count] FROM PHANCONGCOVU WHERE MaLop = @p1`,
      [maLop],
    );
    if (assigned[0]?.Count > 0) {
      throw new BadRequestException(`Không thể xóa lớp vì đang có phân công hỗ trợ/cổ vũ.`);
    }

    await this.db.query(`DELETE FROM LOP WHERE MaLop = @p1`, [maLop]);
    return { success: true, maLop };
  }

  async listStudentClasses(context: SessionContext) {
    this.require(context, ['ADMIN']);
    return this.db.query(`SELECT l.MaLop,l.TenLop,l.KhoaHoc,k.TenKhoa
      FROM LOP l JOIN KHOA k ON k.MaKhoa=l.MaKhoa
      ORDER BY k.TenKhoa,l.TenLop`);
  }

  async listStudentRecords(context: SessionContext) {
    this.require(context, ['ADMIN']);
    return this.db.query(`SELECT s.MaSV,s.MSSV,n.MaNgDung,n.HoTen,n.Email,n.SDT,n.NgaySinh,n.GioiTinh,n.TrangThai,
        l.MaLop,l.TenLop,l.KhoaHoc,k.TenKhoa,k.MaKhoa,a.TenDangNhap
      FROM SINHVIEN s JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung
      JOIN LOP l ON l.MaLop=s.MaLop
      LEFT JOIN KHOA k ON k.MaKhoa=l.MaKhoa
      LEFT JOIN TAIKHOAN a ON a.MaNgDung=n.MaNgDung
      ORDER BY s.MaSV DESC`);
  }

  async updateStudentRecord(context: SessionContext, maSV: number, dto: UpdateStudentRecordDto) {
    this.require(context, ['ADMIN']);
    const student = (await this.db.query<{ MaSV: number; MaNgDung: number }>(
      `SELECT MaSV, MaNgDung FROM SINHVIEN WHERE MaSV=@p1`,
      [maSV],
    ))[0];
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên');

    if (dto.maLop !== undefined) {
      await this.db.query(`UPDATE SINHVIEN SET MaLop=@p1 WHERE MaSV=@p2`, [dto.maLop, maSV]);
    }
    if (dto.mssv !== undefined && dto.mssv.trim()) {
      await this.db.query(`UPDATE SINHVIEN SET MSSV=@p1 WHERE MaSV=@p2`, [dto.mssv.trim(), maSV]);
    }
    await this.db.query(
      `UPDATE NGUOIDUNG SET 
        HoTen=COALESCE(@p1, HoTen),
        Email=@p2,
        SDT=@p3,
        NgaySinh=@p4,
        GioiTinh=@p5
      WHERE MaNgDung=@p6`,
      [
        dto.hoTen ?? null,
        dto.email ?? null,
        dto.sdt ?? null,
        dto.ngaySinh ?? null,
        dto.gioiTinh ?? null,
        student.MaNgDung,
      ],
    );
    return { success: true, message: 'Đã cập nhật hồ sơ sinh viên' };
  }

  async deleteStudentRecord(context: SessionContext, maSV: number) {
    this.require(context, ['ADMIN']);
    const student = (await this.db.query<{ MaSV: number; MaNgDung: number }>(
      `SELECT MaSV, MaNgDung FROM SINHVIEN WHERE MaSV=@p1`,
      [maSV],
    ))[0];
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên');

    await this.db.query(`DELETE FROM DIEMRENLUYEN WHERE MaSV=@p1`, [maSV]);
    await this.db.query(`DELETE FROM THANHVIENDOI WHERE MaSV=@p1`, [maSV]);
    await this.db.query(`DELETE FROM DIEMDANH WHERE MaDK IN (SELECT MaDK FROM DKTHAMGIA WHERE MaSV=@p1)`, [maSV]);
    await this.db.query(`DELETE FROM DKTHAMGIA WHERE MaSV=@p1`, [maSV]);
    await this.db.query(`DELETE FROM SINHVIEN WHERE MaSV=@p1`, [maSV]);
    await this.db.query(`DELETE FROM TAIKHOAN WHERE MaNgDung=@p1`, [student.MaNgDung]);
    await this.db.query(`DELETE FROM NGUOIDUNG WHERE MaNgDung=@p1`, [student.MaNgDung]);
    return { success: true, message: 'Đã xóa hồ sơ sinh viên' };
  }

  async createStudentRecordAccount(context: SessionContext, maSV: number, dto: CreateStaffAccountDto) {
    this.require(context, ['ADMIN']);
    const student = (await this.db.query<{ MaSV: number; MaNgDung: number; MSSV: string }>(
      'SELECT MaSV, MaNgDung, MSSV FROM SINHVIEN WHERE MaSV = @p1',
      [maSV],
    ))[0];
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên');

    const hasAccount = (await this.db.query<{ MaTK: number }>(
      'SELECT MaTK FROM TAIKHOAN WHERE MaNgDung = @p1',
      [student.MaNgDung],
    ))[0];
    if (hasAccount) throw new BadRequestException('Sinh viên này đã có tài khoản');

    const username = dto.username.trim();
    const existing = (await this.db.query<{ MaTK: number }>(
      'SELECT MaTK FROM TAIKHOAN WHERE TenDangNhap = @p1',
      [username],
    ))[0];
    if (existing) throw new ConflictException(`Tên đăng nhập "${username}" đã tồn tại`);

    const passwordHash = await hash(dto.password, 12);
    const roleId = dto.roleId ?? 4; // Default 4: Sinh viên
    await this.db.query(
      `INSERT INTO TAIKHOAN (MaNgDung, MaVaiTro, TenDangNhap, MatKhau, TrangThai)
       VALUES (@p1, @p2, @p3, @p4, N'Hoạt động')`,
      [student.MaNgDung, roleId, username, passwordHash],
    );

    return { success: true, message: `Đã cấp tài khoản "${username}" thành công` };
  }

  async createStudentProfile(context: SessionContext, dto: CreateStudentProfileDto) {
    this.require(context, ['ADMIN']);
    const hoTen = dto.hoTen.trim();
    const mssv = dto.mssv.trim();
    const email = dto.email?.trim().toLowerCase() || null;
    const sdt = dto.sdt?.trim() || null;
    if (!hoTen || !mssv) throw new BadRequestException('Họ tên và MSSV là bắt buộc');

    const studentClass = (await this.db.query(`SELECT MaLop FROM LOP WHERE MaLop=@p1`, [dto.maLop]))[0];
    if (!studentClass) throw new NotFoundException('Không tìm thấy lớp đã chọn');
    if ((await this.db.query(`SELECT 1 AS found FROM SINHVIEN WHERE MSSV=@p1`, [mssv])).length) {
      throw new ConflictException('MSSV đã tồn tại trong hồ sơ sinh viên');
    }
    if (email && (await this.db.query(`SELECT 1 AS found FROM NGUOIDUNG WHERE Email=@p1`, [email])).length) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const person = await new sql.Request(transaction)
        .input('name', sql.NVarChar(150), hoTen)
        .input('email', sql.VarChar(150), email)
        .input('phone', sql.VarChar(15), sdt)
        .input('birth', sql.Date, dto.ngaySinh ? new Date(`${dto.ngaySinh.slice(0, 10)}T00:00:00.000Z`) : null)
        .input('gender', sql.NVarChar(20), dto.gioiTinh ?? null)
        .query<{ MaNgDung: number }>(`INSERT INTO NGUOIDUNG(HoTen,Email,SDT,NgaySinh,GioiTinh,TrangThai)
          OUTPUT INSERTED.MaNgDung VALUES(@name,@email,@phone,@birth,@gender,N'Hoạt động')`);
      const maNgDung = person.recordset[0].MaNgDung;
      const student = await new sql.Request(transaction)
        .input('person', sql.BigInt, maNgDung)
        .input('class', sql.BigInt, dto.maLop)
        .input('studentNumber', sql.VarChar(20), mssv)
        .query<{ MaSV: number }>(`INSERT INTO SINHVIEN(MaNgDung,MaLop,MSSV)
          OUTPUT INSERTED.MaSV VALUES(@person,@class,@studentNumber)`);
      await transaction.commit();
      return { MaSV: student.recordset[0].MaSV, MaNgDung: maNgDung, HoTen: hoTen, MSSV: mssv, MaLop: dto.maLop };
    } catch (cause) {
      await transaction.rollback().catch(() => undefined);
      const errorNumber = (cause as { number?: number }).number;
      if (errorNumber === 2601 || errorNumber === 2627) {
        throw new ConflictException('MSSV hoặc email đã được sử dụng');
      }
      throw cause;
    }
  }

  async createAccount(context: SessionContext, username: string, password: string, roleId: number, maNgDung?: number) {
    this.require(context, ['ADMIN']);
    if ((await this.db.query(`SELECT 1 AS found FROM TAIKHOAN WHERE TenDangNhap=@p1`, [username])).length) {
      throw new ConflictException('Tên đăng nhập đã tồn tại');
    }
    const role = (await this.db.query<{TenVaiTro:string}>(`SELECT TenVaiTro FROM VAITRO WHERE MaVaiTro=@p1`, [roleId]))[0];
    if (!role) {
      throw new NotFoundException('Không tìm thấy vai trò');
    }
    const isStudentRole = key(role.TenVaiTro) === 'SINHVIEN';
    if (isStudentRole) throw new BadRequestException('Hãy tạo tài khoản Sinh viên bằng chức năng cấp mã tự động');
    if (maNgDung) {
      throw new BadRequestException('Hãy tạo tài khoản Sinh viên bằng chức năng cấp mã tự động để liên kết đúng hồ sơ');
    }
    const passwordHash = await hash(password, 12);
    const rows = await this.db.query(`INSERT INTO TAIKHOAN(MaNgDung,MaVaiTro,TenDangNhap,MatKhau,TrangThai)
      OUTPUT INSERTED.MaTK,INSERTED.MaNgDung,INSERTED.TenDangNhap,INSERTED.TrangThai VALUES(@p1,@p2,@p3,@p4,N'Hoạt động')`,
    [maNgDung ?? null,roleId,username,passwordHash]);
    return rows[0];
  }

  private async generateStudentNumber(transaction: sql.Transaction, cohort: string | null) {
    const prefix = this.studentNumberPrefix(cohort);
    const year = prefix.slice(-2);
    const lockResult = await new sql.Request(transaction)
      .input('resource', sql.NVarChar(255), `MSSV:${prefix}`)
      .query<{ LockResult: number }>(`DECLARE @lockResult INT;
        EXEC @lockResult = sys.sp_getapplock
          @Resource=@resource,
          @LockMode='Exclusive',
          @LockOwner='Transaction',
          @LockTimeout=15000;
        SELECT @lockResult AS LockResult;`);
    if (lockResult.recordset[0]?.LockResult < 0) {
      throw new ConflictException('Không thể cấp MSSV lúc này. Vui lòng thử lại.');
    }
    const result = await new sql.Request(transaction)
      .input('prefix', sql.VarChar(6), prefix)
      .query<{ LastNumber: number | string | null }>(`SELECT MAX(StudentNumber) AS LastNumber FROM (
          SELECT TRY_CONVERT(BIGINT,MSSV) AS StudentNumber FROM SINHVIEN
            WHERE MSSV LIKE @prefix + '[0-9][0-9][0-9][0-9]'
          UNION ALL
          SELECT TRY_CONVERT(BIGINT,TenDangNhap) FROM TAIKHOAN
            WHERE TenDangNhap LIKE @prefix + '[0-9][0-9][0-9][0-9]'
        ) AS ExistingNumbers`);
    const lastNumber = Number(result.recordset[0]?.LastNumber ?? 0);
    const nextSequence = lastNumber ? (lastNumber % 10000) + 1 : 1;
    if (nextSequence > 9999) throw new BadRequestException(`Mã sinh viên của khóa ${year} đã vượt giới hạn cấp tự động`);
    return `${prefix}${String(nextSequence).padStart(4, '0')}`;
  }

  private studentCohortYear(cohort: string | null) {
    return cohort?.match(/(?:19|20)\d{2}/)?.[0].slice(-2) ?? String(new Date().getFullYear()).slice(-2);
  }

  private studentNumberPrefix(cohort: string | null) {
    return `2001${this.studentCohortYear(cohort)}`;
  }

  private async resolveStudentNumber(transaction: sql.Transaction, cohort: string | null, username: string) {
    const candidate = username.trim();
    const prefix = this.studentNumberPrefix(cohort);
    if (new RegExp(`^${prefix}\\d{4}$`).test(candidate)) {
      const exists = (await new sql.Request(transaction).input('number', sql.VarChar(20), candidate)
        .query(`SELECT 1 AS found FROM SINHVIEN WHERE MSSV=@number`)).recordset[0];
      if (!exists) return candidate;
    }
    return this.generateStudentNumber(transaction, cohort);
  }

  private async ensureStudentRole(transaction: sql.Transaction) {
    const roles = (await new sql.Request(transaction).query<{ MaVaiTro:number; TenVaiTro:string }>(
      `SELECT MaVaiTro,TenVaiTro FROM VAITRO WITH (UPDLOCK,HOLDLOCK)`,
    )).recordset;
    const existing = roles.find((role) => key(role.TenVaiTro) === 'SINHVIEN');
    if (existing) return existing;
    const created = await new sql.Request(transaction)
      .input('name', sql.NVarChar(100), 'Sinh viên')
      .query<{ MaVaiTro:number; TenVaiTro:string }>(`INSERT INTO VAITRO(TenVaiTro)
        OUTPUT INSERTED.MaVaiTro,INSERTED.TenVaiTro VALUES(@name)`);
    return created.recordset[0];
  }

  async createStudentAccount(context: SessionContext, dto: CreateStudentAccountDto) {
    this.require(context, ['ADMIN']);
    const hoTen = dto.hoTen.trim();
    const email = dto.email?.trim().toLowerCase() || null;
    const sdt = dto.sdt?.trim() || null;
    if (!hoTen) {
      throw new BadRequestException('Hãy nhập họ tên sinh viên');
    }
    if (email && (await this.db.query(`SELECT 1 AS found FROM NGUOIDUNG WHERE Email=@p1`, [email])).length) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await hash(dto.password, 12);
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const studentClass = (await new sql.Request(transaction).input('class', sql.BigInt, dto.maLop)
        .query<{ MaLop: number; TenLop:string; KhoaHoc: string | null }>(`SELECT MaLop,TenLop,KhoaHoc FROM LOP WITH (HOLDLOCK) WHERE MaLop=@class`)).recordset[0];
      if (!studentClass) throw new NotFoundException('Không tìm thấy lớp đã chọn');
      const mssv = await this.generateStudentNumber(transaction, studentClass.KhoaHoc);
      const studentRole = await this.ensureStudentRole(transaction);
      const person = await new sql.Request(transaction)
        .input('name', sql.NVarChar(150), hoTen)
        .input('email', sql.VarChar(150), email)
        .input('phone', sql.VarChar(15), sdt)
        .input('birth', sql.Date, dto.ngaySinh ? new Date(`${dto.ngaySinh.slice(0, 10)}T00:00:00.000Z`) : null)
        .input('gender', sql.NVarChar(20), dto.gioiTinh ?? null)
        .query<{ MaNgDung: number }>(`INSERT INTO NGUOIDUNG(HoTen,Email,SDT,NgaySinh,GioiTinh,TrangThai)
          OUTPUT INSERTED.MaNgDung VALUES(@name,@email,@phone,@birth,@gender,N'Hoạt động')`);
      const maNgDung = person.recordset[0].MaNgDung;
      const student = await new sql.Request(transaction)
        .input('person', sql.BigInt, maNgDung)
        .input('class', sql.BigInt, studentClass.MaLop)
        .input('number', sql.VarChar(20), mssv)
        .query<{ MaSV: number }>(`INSERT INTO SINHVIEN(MaNgDung,MaLop,MSSV)
          OUTPUT INSERTED.MaSV VALUES(@person,@class,@number)`);
      const maSV = student.recordset[0].MaSV;

      const account = await new sql.Request(transaction)
        .input('person', sql.BigInt, maNgDung)
        .input('role', sql.BigInt, studentRole.MaVaiTro)
        .input('username', sql.VarChar(100), mssv)
        .input('password', sql.VarChar(255), passwordHash)
        .query<{ MaTK: number; TrangThai: string }>(`INSERT INTO TAIKHOAN(MaNgDung,MaVaiTro,TenDangNhap,MatKhau,TrangThai)
          OUTPUT INSERTED.MaTK,INSERTED.TrangThai VALUES(@person,@role,@username,@password,N'Hoạt động')`);
      await transaction.commit();
      return { MaTK: account.recordset[0].MaTK, MaSV: maSV, MaNgDung: maNgDung, MSSV: mssv, HoTen: hoTen, TenDangNhap: mssv, TrangThai: account.recordset[0].TrangThai };
    } catch (cause) {
      await transaction.rollback().catch(() => undefined);
      const errorNumber = (cause as { number?: number }).number;
      if (errorNumber === 2601 || errorNumber === 2627) {
        throw new ConflictException('MSSV, tên đăng nhập hoặc email đã được sử dụng');
      }
      throw cause;
    }
  }

  async createLinkedStudentProfile(context: SessionContext, dto: CreateLinkedStudentProfileDto) {
    this.require(context, ['ADMIN']);
    const hoTen = dto.hoTen.trim();
    const email = dto.email?.trim().toLowerCase() || null;
    const sdt = dto.sdt?.trim() || null;
    if (!hoTen) throw new BadRequestException('Hãy nhập họ tên sinh viên');
    if (email && (await this.db.query(`SELECT 1 AS found FROM NGUOIDUNG WHERE Email=@p1`, [email])).length) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const studentClass = (await new sql.Request(transaction).input('class', sql.BigInt, dto.maLop)
        .query<{ MaLop:number; TenLop:string; KhoaHoc:string|null }>(`SELECT MaLop,TenLop,KhoaHoc FROM LOP WITH (HOLDLOCK) WHERE MaLop=@class`)).recordset[0];
      if (!studentClass) throw new NotFoundException('Không tìm thấy lớp đã chọn');
      const account = (await new sql.Request(transaction).input('account', sql.BigInt, dto.maTK)
        .query<{ MaTK:number; MaNgDung:number|null; TrangThai:string; TenVaiTro:string; TenDangNhap:string }>(`SELECT a.MaTK,a.MaNgDung,a.TrangThai,a.TenDangNhap,r.TenVaiTro
          FROM TAIKHOAN a WITH (UPDLOCK,HOLDLOCK) JOIN VAITRO r ON r.MaVaiTro=a.MaVaiTro WHERE a.MaTK=@account`)).recordset[0];
      if (!account) throw new NotFoundException('Không tìm thấy tài khoản đã chọn');
      if (account.MaNgDung != null) throw new ConflictException('Tài khoản này đã được liên kết với một hồ sơ');
      if (account.TrangThai !== 'Hoạt động') throw new BadRequestException('Chỉ liên kết được tài khoản đang hoạt động');
      if (['ADMIN','QUANTRIVIEN'].includes(key(account.TenVaiTro))) throw new BadRequestException('Không thể dùng tài khoản quản trị làm tài khoản sinh viên');

      const mssv = await this.resolveStudentNumber(transaction, studentClass.KhoaHoc, account.TenDangNhap);
      const studentRole = await this.ensureStudentRole(transaction);
      const person = await new sql.Request(transaction)
        .input('name', sql.NVarChar(150), hoTen)
        .input('email', sql.VarChar(150), email)
        .input('phone', sql.VarChar(15), sdt)
        .input('birth', sql.Date, dto.ngaySinh ? new Date(`${dto.ngaySinh.slice(0, 10)}T00:00:00.000Z`) : null)
        .input('gender', sql.NVarChar(20), dto.gioiTinh ?? null)
        .query<{ MaNgDung:number }>(`INSERT INTO NGUOIDUNG(HoTen,Email,SDT,NgaySinh,GioiTinh,TrangThai)
          OUTPUT INSERTED.MaNgDung VALUES(@name,@email,@phone,@birth,@gender,N'Hoạt động')`);
      const maNgDung = person.recordset[0].MaNgDung;
      const student = await new sql.Request(transaction)
        .input('person', sql.BigInt, maNgDung)
        .input('class', sql.BigInt, studentClass.MaLop)
        .input('number', sql.VarChar(20), mssv)
        .query<{ MaSV:number }>(`INSERT INTO SINHVIEN(MaNgDung,MaLop,MSSV)
          OUTPUT INSERTED.MaSV VALUES(@person,@class,@number)`);
      await new sql.Request(transaction).input('account', sql.BigInt, dto.maTK).input('person', sql.BigInt, maNgDung)
        .input('role', sql.BigInt, studentRole.MaVaiTro).input('username', sql.VarChar(100), mssv)
        .query(`UPDATE TAIKHOAN SET MaNgDung=@person,MaVaiTro=@role,TenDangNhap=@username,PBMatKhau=PBMatKhau+1
          WHERE MaTK=@account AND MaNgDung IS NULL AND TrangThai=N'Hoạt động'`);
      await new sql.Request(transaction).input('account', sql.BigInt, dto.maTK)
        .query(`DELETE FROM PHIENDANGNHAP WHERE MaTK=@account`);
      await transaction.commit();
      return { MaTK:dto.maTK, MaSV:student.recordset[0].MaSV, MaNgDung:maNgDung, MSSV:mssv, HoTen:hoTen, TenDangNhap:mssv, message:'Đã tạo hồ sơ và liên kết tài khoản có sẵn. Tên đăng nhập đã đồng bộ với MSSV.' };
    } catch (cause) {
      await transaction.rollback().catch(() => undefined);
      const errorNumber = (cause as { number?:number }).number;
      if (errorNumber === 2601 || errorNumber === 2627) throw new ConflictException('MSSV, tên đăng nhập hoặc email đã được sử dụng');
      throw cause;
    }
  }

  async linkAccountStudentProfile(context: SessionContext, accountId: number, maNgDung: number) {
    this.require(context, ['ADMIN']);
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const account = (await new sql.Request(transaction).input('account', sql.BigInt, accountId)
        .query<{ MaTK:number; MaNgDung:number|null; TrangThai:string; TenVaiTro:string; TenDangNhap:string }>(`SELECT a.MaTK,a.MaNgDung,a.TrangThai,a.TenDangNhap,r.TenVaiTro
          FROM TAIKHOAN a WITH (UPDLOCK,HOLDLOCK) JOIN VAITRO r ON r.MaVaiTro=a.MaVaiTro WHERE a.MaTK=@account`)).recordset[0];
      if (!account) throw new NotFoundException('Không tìm thấy tài khoản');
      if (account.MaNgDung != null) throw new ConflictException('Tài khoản này đã được liên kết với một hồ sơ');
      if (account.TrangThai !== 'Hoạt động') throw new BadRequestException('Chỉ liên kết được tài khoản đang hoạt động');
      if (['ADMIN','QUANTRIVIEN'].includes(key(account.TenVaiTro))) throw new BadRequestException('Không thể dùng tài khoản quản trị làm tài khoản sinh viên');

      const profile = (await new sql.Request(transaction).input('person', sql.BigInt, maNgDung)
        .query<{ MaNgDung:number; MaSV:number; MaLop:number; TenLop:string; MSSV:string|null; KhoaHoc:string|null }>(`SELECT s.MaNgDung,s.MaSV,s.MaLop,l.TenLop,s.MSSV,l.KhoaHoc
          FROM SINHVIEN s WITH (UPDLOCK,HOLDLOCK)
          JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung
          JOIN LOP l ON l.MaLop=s.MaLop
          WHERE s.MaNgDung=@person AND n.TrangThai=N'Hoạt động'`)).recordset[0];
      if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ sinh viên đang hoạt động');
      const linked = (await new sql.Request(transaction).input('person', sql.BigInt, maNgDung).input('account', sql.BigInt, accountId)
        .query(`SELECT 1 AS found FROM TAIKHOAN WITH (UPDLOCK,HOLDLOCK) WHERE MaNgDung=@person AND MaTK<>@account`)).recordset[0];
      if (linked) throw new ConflictException('Hồ sơ sinh viên này đã được liên kết với tài khoản khác');

      const mssv = profile.MSSV?.trim() || await this.resolveStudentNumber(transaction, profile.KhoaHoc, account.TenDangNhap);
      if (!profile.MSSV?.trim()) {
        await new sql.Request(transaction).input('student', sql.BigInt, profile.MaSV).input('number', sql.VarChar(20), mssv)
          .query(`UPDATE SINHVIEN SET MSSV=@number WHERE MaSV=@student`);
      }
      const studentRole = await this.ensureStudentRole(transaction);
      await new sql.Request(transaction).input('account', sql.BigInt, accountId).input('person', sql.BigInt, maNgDung)
        .input('role', sql.BigInt, studentRole.MaVaiTro).input('username', sql.VarChar(100), mssv)
        .query(`UPDATE TAIKHOAN SET MaNgDung=@person,MaVaiTro=@role,TenDangNhap=@username,PBMatKhau=PBMatKhau+1
          WHERE MaTK=@account AND MaNgDung IS NULL`);
      await new sql.Request(transaction).input('account', sql.BigInt, accountId)
        .query(`DELETE FROM PHIENDANGNHAP WHERE MaTK=@account`);
      await transaction.commit();
      return { MaTK:accountId,MaNgDung:maNgDung,MSSV:mssv,TenDangNhap:mssv,message:'Đã liên kết hồ sơ. Vai trò và tên đăng nhập đã đồng bộ với Sinh viên/MSSV; tài khoản cần đăng nhập lại.' };
    } catch (cause) {
      await transaction.rollback().catch(() => undefined);
      const errorNumber = (cause as { number?:number }).number;
      if (errorNumber === 2601 || errorNumber === 2627) throw new ConflictException('MSSV hoặc tên đăng nhập đã được sử dụng');
      throw cause;
    }
  }

  async resetAccountPassword(context: SessionContext, accountId: number, password: string) {
    this.require(context, ['ADMIN']);
    if (String(accountId) === String(context.userId)) {
      throw new BadRequestException('Để đổi mật khẩu tài khoản đang đăng nhập, hãy dùng chức năng Đổi mật khẩu.');
    }
    const account = (await this.db.query(`SELECT MaTK FROM TAIKHOAN WHERE MaTK=@p1`, [accountId]))[0];
    if (!account) throw new NotFoundException('Không tìm thấy tài khoản');
    const passwordHash = await hash(password, 12);
    const rows = await this.db.query(`UPDATE TAIKHOAN SET MatKhau=@p2,PBMatKhau=PBMatKhau+1
      OUTPUT INSERTED.MaTK,INSERTED.TenDangNhap,INSERTED.TrangThai WHERE MaTK=@p1`, [accountId,passwordHash]);
    await this.db.query(`DELETE FROM PHIENDANGNHAP WHERE MaTK=@p1`, [accountId]);
    return { ...rows[0], message:'Đã đặt lại mật khẩu; tài khoản cần đăng nhập lại.' };
  }

  async deactivateAccount(context: SessionContext, accountId: number) {
    this.require(context, ['ADMIN']);
    if (String(accountId) === String(context.userId)) {
      throw new BadRequestException('Không thể xóa tài khoản quản trị đang đăng nhập');
    }
    const target = (await this.db.query<{MaTK:number;TrangThai:string;TenVaiTro:string}>(
      `SELECT a.MaTK,a.TrangThai,r.TenVaiTro FROM TAIKHOAN a JOIN VAITRO r ON r.MaVaiTro=a.MaVaiTro WHERE a.MaTK=@p1`,
      [accountId],
    ))[0];
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
    if (target.TrangThai === 'Hoạt động' && ['ADMIN','QUANTRIVIEN'].includes(key(target.TenVaiTro))) {
      const activeAccounts = await this.db.query<{TenVaiTro:string}>(`SELECT r.TenVaiTro FROM TAIKHOAN a
        JOIN VAITRO r ON r.MaVaiTro=a.MaVaiTro WHERE a.TrangThai=N'Hoạt động'`);
      const activeAdminCount = activeAccounts.filter((row) => ['ADMIN','QUANTRIVIEN'].includes(key(row.TenVaiTro))).length;
      if (activeAdminCount <= 1) throw new BadRequestException('Không thể xóa tài khoản quản trị viên cuối cùng');
    }
    const rows = await this.db.query(`UPDATE TAIKHOAN SET TrangThai=N'Ngừng hoạt động',PBMatKhau=PBMatKhau+1
      OUTPUT INSERTED.MaTK,INSERTED.TenDangNhap,INSERTED.TrangThai WHERE MaTK=@p1`, [accountId]);
    await this.db.query(`DELETE FROM PHIENDANGNHAP WHERE MaTK=@p1`, [accountId]);
    return rows[0];
  }

  async setAccountStatus(context: SessionContext, accountId: number, active: boolean) {
    if (!active) return this.deactivateAccount(context, accountId);
    this.require(context, ['ADMIN']);
    if (String(accountId) === String(context.userId)) {
      throw new BadRequestException('Không thể thay đổi trạng thái tài khoản đang đăng nhập');
    }
    const target = (await this.db.query<{ MaTK:number; TenDangNhap:string; TrangThai:string }>(
      `SELECT MaTK,TenDangNhap,TrangThai FROM TAIKHOAN WHERE MaTK=@p1`, [accountId],
    ))[0];
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
    if (target.TrangThai === 'Hoạt động') return target;
    const rows = await this.db.query(`UPDATE TAIKHOAN SET TrangThai=N'Hoạt động',PBMatKhau=PBMatKhau+1
      OUTPUT INSERTED.MaTK,INSERTED.TenDangNhap,INSERTED.TrangThai WHERE MaTK=@p1`, [accountId]);
    await this.db.query(`DELETE FROM PHIENDANGNHAP WHERE MaTK=@p1`, [accountId]);
    return rows[0];
  }

  async deleteAccountPermanently(context: SessionContext, accountId: number) {
    this.require(context, ['ADMIN']);
    if (String(accountId) === String(context.userId)) {
      throw new BadRequestException('Không thể xóa vĩnh viễn tài khoản quản trị đang đăng nhập');
    }
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const target = (await new sql.Request(transaction).input('account', sql.BigInt, accountId)
        .query<{ MaTK:number; TenDangNhap:string; TrangThai:string; TenVaiTro:string }>(`SELECT a.MaTK,a.TenDangNhap,a.TrangThai,r.TenVaiTro
          FROM TAIKHOAN a WITH (UPDLOCK,HOLDLOCK) JOIN VAITRO r ON r.MaVaiTro=a.MaVaiTro WHERE a.MaTK=@account`)).recordset[0];
      if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
      if (['ADMIN','QUANTRIVIEN'].includes(key(target.TenVaiTro))) {
        const admins = (await new sql.Request(transaction)
          .query<{ MaTK:number; TenVaiTro:string; TrangThai:string }>(`SELECT a.MaTK,r.TenVaiTro,a.TrangThai FROM TAIKHOAN a WITH (UPDLOCK,HOLDLOCK)
            JOIN VAITRO r ON r.MaVaiTro=a.MaVaiTro`)).recordset;
        const otherActiveAdmins = admins.filter((account) => String(account.MaTK) !== String(accountId)
          && account.TrangThai === 'Hoạt động' && ['ADMIN','QUANTRIVIEN'].includes(key(account.TenVaiTro))).length;
        if (target.TrangThai === 'Hoạt động' && otherActiveAdmins === 0) {
          throw new BadRequestException('Không thể xóa tài khoản quản trị viên đang hoạt động cuối cùng');
        }
      }

      const references = (await new sql.Request(transaction).input('account', sql.BigInt, accountId).query<{ Source:string }>(`SELECT TOP (1) Source FROM (
          SELECT N'KEHOACHHOCTHUAT' AS Source FROM KEHOACHHOCTHUAT WHERE NguoiDuyet=@account
          UNION ALL SELECT N'DIEMRENLUYEN' FROM DIEMRENLUYEN WHERE NguoiGhi=@account
          UNION ALL SELECT N'HOSOQUYETTOAN' FROM HOSOQUYETTOAN WHERE NguoiLap=@account OR NguoiDuyet=@account
          UNION ALL SELECT N'CHIPHITHUCTE' FROM CHIPHITHUCTE WHERE NguoiGhi=@account
          UNION ALL SELECT N'CHAMDIEMVONG' FROM CHAMDIEMVONG WHERE MaTK=@account
        ) AS AccountHistory`)).recordset[0];
      if (references) {
        throw new BadRequestException('Tài khoản đã được ghi nhận trong lịch sử hoạt động nên không thể xóa vĩnh viễn. Bạn có thể dùng “Ngừng tài khoản” để chặn đăng nhập và giữ lịch sử.');
      }

      await new sql.Request(transaction).input('account', sql.BigInt, accountId)
        .query(`DELETE FROM THONGBAO WHERE MaTK=@account; DELETE FROM TAIKHOAN WHERE MaTK=@account;`);
      await transaction.commit();
      return { MaTK:accountId,TenDangNhap:target.TenDangNhap,TrangThai:'Đã xóa vĩnh viễn' };
    } catch (cause) {
      await transaction.rollback().catch(() => undefined);
      const errorNumber = (cause as { number?:number }).number;
      if (errorNumber === 547) throw new BadRequestException('Tài khoản còn được dữ liệu lịch sử tham chiếu nên không thể xóa vĩnh viễn');
      throw cause;
    }
  }

  async changeAccountRole(context: SessionContext, accountId: number, roleId: number) {
    this.require(context, ['ADMIN']);
    const nextRole = (await this.db.query<{ TenVaiTro:string }>(`SELECT TenVaiTro FROM VAITRO WHERE MaVaiTro=@p1`, [roleId]))[0];
    if (!nextRole) {
      throw new NotFoundException('Không tìm thấy vai trò');
    }
    if (key(nextRole.TenVaiTro) === 'SINHVIEN') {
      throw new BadRequestException('Vai trò Sinh viên chỉ được gán qua mục Hồ sơ sinh viên để bảo đảm liên kết MSSV');
    }
    const current = (await this.db.query<{ TenVaiTro:string }>(`SELECT r.TenVaiTro FROM TAIKHOAN a
      JOIN VAITRO r ON r.MaVaiTro=a.MaVaiTro WHERE a.MaTK=@p1`, [accountId]))[0];
    if (!current) throw new NotFoundException('Không tìm thấy tài khoản');
    if (key(current.TenVaiTro) === 'SINHVIEN') {
      throw new BadRequestException('Tài khoản Sinh viên được quản lý tại mục Hồ sơ sinh viên');
    }
    const rows = await this.db.query(`UPDATE TAIKHOAN SET MaVaiTro=@p2,PBMatKhau=PBMatKhau+1
      OUTPUT INSERTED.MaTK,INSERTED.TenDangNhap,INSERTED.MaVaiTro WHERE MaTK=@p1`, [accountId,roleId]);
    if (!rows[0]) throw new NotFoundException('Không tìm thấy tài khoản');
    await this.db.query(`DELETE FROM PHIENDANGNHAP WHERE MaTK=@p1`, [accountId]);
    return rows[0];
  }

  private async resolvePlanFaculty(): Promise<PlanFaculty> {
    const faculties = await this.db.query<PlanFaculty>('SELECT MaKhoa,TenKhoa FROM KHOA ORDER BY MaKhoa');
    const names = new Set(['Công nghệ thông tin', 'Khoa Công nghệ thông tin', 'CNTT', 'Khoa CNTT'].map(key));
    const matches = faculties.filter((faculty) => names.has(key(faculty.TenKhoa)));
    if (!matches.length) throw new ServiceUnavailableException('Chưa cấu hình Khoa Công nghệ thông tin cho chức năng kế hoạch năm học');
    if (matches.length > 1) throw new ServiceUnavailableException('Có nhiều khoa Công nghệ thông tin; cần cấu hình một khoa duy nhất cho chức năng kế hoạch năm học');
    return matches[0];
  }
  private assertPlanFaculty(facultyId: number, faculty: PlanFaculty) {
    if (Number(facultyId) !== Number(faculty.MaKhoa)) {
      throw new ForbiddenException('Chức năng kế hoạch năm học chỉ áp dụng cho Khoa Công nghệ thông tin');
    }
  }
  private async resolveDefaultProposalDepartment(accountId: number | string): Promise<number | null> {
    const faculty = await this.resolvePlanFaculty();
    const department = (await this.db.query<{ MaBM: number }>(`SELECT TOP (1) bm.MaBM
      FROM TAIKHOAN t JOIN GIANGVIEN gv ON gv.MaNgDung=t.MaNgDung
      JOIN BOMON bm ON bm.MaKhoa=@p2
      WHERE t.MaTK=@p1 AND (gv.MaBM=bm.MaBM OR EXISTS(
        SELECT 1 FROM GIANGVIEN_BOMON gb WHERE gb.MaGV=gv.MaGV AND gb.MaBM=bm.MaBM))
      ORDER BY CASE WHEN gv.MaBM=bm.MaBM THEN 0 ELSE 1 END,bm.MaBM`, [accountId, faculty.MaKhoa]))[0];
    return department?.MaBM ?? null;
  }
  private async requireProposalDepartment(context: SessionContext, departmentId: number | null | undefined) {
    if (departmentId == null) return;
    const faculty = await this.resolvePlanFaculty();
    const department = (await this.db.query<{ MaKhoa: number }>('SELECT MaKhoa FROM BOMON WHERE MaBM=@p1', [departmentId]))[0];
    if (!department) throw new NotFoundException('Không tìm thấy bộ môn phụ trách');
    this.assertPlanFaculty(department.MaKhoa, faculty);
    if (!context.user.roles.some(role => key(role) === 'ADMIN')) {
      const affiliation = await this.db.query(`SELECT gv.MaGV FROM TAIKHOAN t JOIN GIANGVIEN gv ON gv.MaNgDung=t.MaNgDung
        WHERE t.MaTK=@p1 AND (gv.MaBM=@p2 OR EXISTS(SELECT 1 FROM GIANGVIEN_BOMON gb WHERE gb.MaGV=gv.MaGV AND gb.MaBM=@p2))`, [context.userId, departmentId]);
      if (!affiliation.length) throw new ForbiddenException('Bạn chỉ được lập đề xuất cho bộ môn được phân công');
    }
    return faculty;
  }
  private async requireFacultySigner(context: SessionContext) {
    this.require(context, ['ADMIN', 'TRUONGKHOA']);
    const faculty = await this.resolvePlanFaculty();
    if (!context.user.roles.some(role => key(role) === 'ADMIN')) {
      const profile = (await this.db.query<{ MaKhoa: number }>(`SELECT cb.MaKhoa FROM TAIKHOAN t
        JOIN CANBOKHOA cb ON cb.MaNgDung=t.MaNgDung WHERE t.MaTK=@p1`, [context.userId]))[0];
      if (!profile || Number(profile.MaKhoa) !== Number(faculty.MaKhoa)) throw new ForbiddenException('Chỉ Trưởng khoa Công nghệ thông tin được ký duyệt hồ sơ này');
    }
    return faculty;
  }
  private async requireOwnedProposal(context: SessionContext, activityId: number) {
    const activity = (await this.db.query<AnnualProposal>('SELECT MaHD,NguoiLap,MaBM,NamHoc,TenHoatDong,NoiDung,TrangThai FROM HOATDONGHOCTHUAT WHERE MaHD=@p1', [activityId]))[0];
    if (!activity) throw new NotFoundException('Không tìm thấy đề xuất hoạt động');
    if (String(activity.NguoiLap) !== String(context.userId)) throw new ForbiddenException('Chỉ người lập được chỉnh sửa hoặc gửi đề xuất và bản chi phí');
    await this.requireProposalDepartment(context, activity.MaBM);
    return activity;
  }
  private async requireITPlan(planId: number) {
    const faculty = await this.resolvePlanFaculty();
    const plan = (await this.db.query<{ MaKhoa: number; TrangThai: string; LoaiKeHoach?: string }>(
      'SELECT MaKhoa,TrangThai,LoaiKeHoach FROM KEHOACHHOCTHUAT WHERE MaKeHoach=@p1', [planId],
    ))[0];
    if (!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
    this.assertPlanFaculty(plan.MaKhoa, faculty);
    if (plan.LoaiKeHoach && key(plan.LoaiKeHoach) !== 'KHOA') throw new BadRequestException('Kế hoạch chi tiết từng hoạt động được xử lý tại chức năng Kế hoạch tổ chức');
    return plan;
  }
  async listPlanUnits(context: SessionContext) {
    this.require(context, planReaderRoles);
    const faculty = await this.resolvePlanFaculty();
    const departments = await this.db.query<{ MaBM: number; TenBM: string; MaKhoa: number }>(
      'SELECT MaBM,TenBM,MaKhoa FROM BOMON WHERE MaKhoa=@p1 ORDER BY TenBM,MaBM', [faculty.MaKhoa],
    );
    return { faculty, departments };
  }
  async listPlans(context: SessionContext) {
    this.require(context, planReaderRoles);
    const faculty = await this.resolvePlanFaculty();
    return this.db.query(`SELECT p.*, k.TenKhoa FROM KEHOACHHOCTHUAT p JOIN KHOA k ON k.MaKhoa=p.MaKhoa WHERE p.MaKhoa=@p1 AND UPPER(COALESCE(p.LoaiKeHoach,'KHOA'))='KHOA' ORDER BY p.NamHoc DESC,p.MaKeHoach DESC`, [faculty.MaKhoa]);
  }
  async getPlan(context:SessionContext,planId:number) {
    this.require(context,planReaderRoles);
    const faculty = await this.resolvePlanFaculty();
    const plan=(await this.db.query(`SELECT p.*,k.TenKhoa,COALESCE(nguoiDuyet.HoTen,tkDuyet.TenDangNhap) AS TenNguoiDuyet
      FROM KEHOACHHOCTHUAT p JOIN KHOA k ON k.MaKhoa=p.MaKhoa
      LEFT JOIN TAIKHOAN tkDuyet ON tkDuyet.MaTK=p.NguoiDuyet
      LEFT JOIN NGUOIDUNG nguoiDuyet ON nguoiDuyet.MaNgDung=tkDuyet.MaNgDung
      WHERE p.MaKeHoach=@p1 AND p.MaKhoa=@p2 AND UPPER(COALESCE(p.LoaiKeHoach,'KHOA'))='KHOA'`,[planId,faculty.MaKhoa]))[0];
    if(!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
    const activities=await this.db.query(`SELECT * FROM CHITIETKEHOACH WHERE MaKeHoach=@p1 ORDER BY MaChiTiet`,[planId]);
    const approvedActivities=await this.db.query(`SELECT h.*,departmentProposal.TrangThai AS TrangThaiDeXuatBoMon
      FROM HOATDONGHOCTHUAT h
      OUTER APPLY (SELECT TOP (1) p.TrangThai,p.MaKeHoachKhoa FROM KEHOACHCUOCTHIBOMON p WHERE p.MaHD=h.MaHD ORDER BY p.MaDeXuat DESC) departmentProposal
      WHERE (COALESCE(h.MaKeHoachKhoa,h.MaKeHoach)=@p1 OR departmentProposal.MaKeHoachKhoa=@p1)
        AND ((departmentProposal.TrangThai IN(N'Chờ khoa',N'Đã duyệt') AND h.TrangThai IN(N'Chờ duyệt',N'Đã duyệt',N'Đã công bố'))
          OR (departmentProposal.TrangThai IS NULL AND h.TrangThai IN(N'Đã duyệt',N'Đã công bố')))
      ORDER BY h.TgDuKien,h.MaHD`,[planId]);
    const activityIds=approvedActivities.map((activity:{MaHD:number})=>activity.MaHD);
    let activitiesWithCommittees: Record<string,unknown>[]=approvedActivities as Record<string,unknown>[];
    if(activityIds.length){
      const params=[planId,...activityIds];
      const inList=activityIds.map((_,index)=>`@p${index+2}`).join(',');
      const [steering,organizing,support]=await Promise.all([
        this.db.query(`SELECT MaHD,HoTen,HocVi,ChucDanh,ChucVu FROM BANCHIDAO WHERE MaHD IN(${inList}) ORDER BY MaHD,MaChiDao`,params),
        this.db.query(`SELECT MaHD,HoTen,HocVi,ChucDanh,ChucVu,NhiemVu FROM BANTOCHUC WHERE MaHD IN(${inList}) ORDER BY MaHD,MaBanTC`,params),
        this.db.query(`SELECT MaHD,HoTen,HocVi,ChucDanh,ChucVu FROM BANHOTRO WHERE MaHD IN(${inList}) ORDER BY MaHD,MaBanHoTro`,params),
      ]);
      activitiesWithCommittees=approvedActivities.map((activity:Record<string,unknown>)=>({
        ...activity,
        banChiDao:steering.filter((member:Record<string,unknown>)=>String(member.MaHD)===String(activity.MaHD)),
        banToChuc:organizing.filter((member:Record<string,unknown>)=>String(member.MaHD)===String(activity.MaHD)),
        banHoTro:support.filter((member:Record<string,unknown>)=>String(member.MaHD)===String(activity.MaHD)),
      }));
    }
    const deXuatBoMon = await this.db.query(`SELECT p.MaDeXuat,p.TenCuocThi,p.NoiDung,p.DuTruKinhPhi,p.NamHoc,bm.TenBM
      FROM KEHOACHCUOCTHIBOMON p JOIN BOMON bm ON bm.MaBM=p.MaBM
      WHERE p.MaKeHoachKhoa=@p1 AND p.TrangThai=N'Đã duyệt' ORDER BY bm.TenBM,p.MaDeXuat`, [planId]);
    return {...plan,hoatDong:activities,hoatDongHocThuat:activitiesWithCommittees,deXuatBoMon};
  }
  async createPlan(context: SessionContext, dto: CreatePlanDto) {
    this.requireAcademicCoordinator(context);
    const faculty = await this.resolvePlanFaculty();
    this.assertPlanFaculty(dto.maKhoa, faculty);
    if (dto.maBM || dto.loaiKeHoach === 'BO_MON') throw new BadRequestException('Kế hoạch năm học là kế hoạch chung của khoa');
    let responsible:number|null=null;
    if(!context.user.roles.some(role=>key(role)==='ADMIN')) {
      const profile=(await this.db.query<{MaKhoa:number|null;MaCanBo:number|null;MaBM:number|null}>(`SELECT cb.MaKhoa,cb.MaCanBo,gv.MaBM FROM TAIKHOAN t JOIN NGUOIDUNG n ON n.MaNgDung=t.MaNgDung
        LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=n.MaNgDung LEFT JOIN GIANGVIEN gv ON gv.MaNgDung=n.MaNgDung WHERE t.MaTK=@p1`,[context.userId]))[0];
      let profileFaculty=profile?.MaKhoa??null;
      if(!profileFaculty && profile?.MaBM) profileFaculty=(await this.db.query<{MaKhoa:number}>(`SELECT MaKhoa FROM BOMON WHERE MaBM=@p1`,[profile.MaBM]))[0]?.MaKhoa??null;
      if(!profileFaculty || profileFaculty!==dto.maKhoa) throw new ForbiddenException('Bạn chỉ được lập kế hoạch thuộc khoa/bộ môn của mình');
      responsible=profile?.MaCanBo??null;
    }
    const rows = await this.db.query(`INSERT INTO KEHOACHHOCTHUAT(SoKeHoach,TenKeHoach,NgayBanHanh,NamHoc,KinhPhiTC,CanCu,MucDich,YeuCau,NoiDung,TrangThai,MaKhoa,NgPhuTrach,LoaiKeHoach)
      OUTPUT INSERTED.MaKeHoach VALUES(@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,N'Dự thảo',@p10,@p11,@p12)`, [dto.soKeHoach ?? `KH-${Date.now()}`,dto.tenKeHoach,dto.ngayBanHanh ?? null,dto.namHoc,dto.kinhPhiTC ?? null,dto.canCu ?? null,dto.mucDich ?? null,dto.yeuCau ?? null,dto.noiDung ?? null,dto.maKhoa,responsible,'KHOA']);
    return { maKeHoach: rows[0].MaKeHoach, trangThai: 'Dự thảo' };
  }
  async updatePlan(context: SessionContext, planId: number, dto: CreatePlanDto) {
    this.requireAcademicCoordinator(context);
    const plan = await this.requireITPlan(planId);
    if (!['Dự thảo','Cần bổ sung'].includes(plan.TrangThai)) throw new BadRequestException('Chỉ chỉnh sửa kế hoạch dự thảo hoặc cần bổ sung');
    const faculty = await this.resolvePlanFaculty();
    this.assertPlanFaculty(dto.maKhoa, faculty);
    const rows = await this.db.query(`UPDATE KEHOACHHOCTHUAT SET SoKeHoach=@p1,TenKeHoach=@p2,NgayBanHanh=@p3,NamHoc=@p4,KinhPhiTC=@p5,CanCu=@p6,MucDich=@p7,YeuCau=@p8,NoiDung=@p9 WHERE MaKeHoach=@p10 AND MaKhoa=@p11 AND TrangThai IN(N'Dự thảo',N'Cần bổ sung'); SELECT @@ROWCOUNT AS Updated`, [dto.soKeHoach,dto.tenKeHoach,dto.ngayBanHanh??null,dto.namHoc,dto.kinhPhiTC??null,dto.canCu??null,dto.mucDich??null,dto.yeuCau??null,dto.noiDung??null,planId,faculty.MaKhoa]);
    if (!rows.length) throw new BadRequestException('Không thể cập nhật kế hoạch ở trạng thái hiện tại');
    return {maKeHoach:planId,updated:true};
  }
  async deletePlan(context: SessionContext, planId: number) {
    this.requireAcademicCoordinator(context);
    await this.requireITPlan(planId);
    const tx = new sql.Transaction(this.db.pool);
    await tx.begin();
    try {
      const plan = (await new sql.Request(tx).input('planId', sql.BigInt, planId)
        .query<{TrangThai:string}>(`SELECT TrangThai FROM KEHOACHHOCTHUAT WITH(UPDLOCK,HOLDLOCK) WHERE MaKeHoach=@planId`)).recordset[0];
      if (!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
      if (!['Dự thảo','Cần bổ sung'].includes(plan.TrangThai)) {
        throw new BadRequestException('Chỉ được xóa kế hoạch đang ở trạng thái dự thảo hoặc cần bổ sung');
      }
      const optionalTables = (await new sql.Request(tx).query<{
        HasDetailedPlan:number; HasPlanDetails:number; HasDepartmentProposals:number;
      }>(`SELECT
        CASE WHEN OBJECT_ID(N'dbo.KEHOACHTOCHUC',N'U') IS NULL THEN 0 ELSE 1 END AS HasDetailedPlan,
        CASE WHEN OBJECT_ID(N'dbo.CHITIETKEHOACH',N'U') IS NULL THEN 0 ELSE 1 END AS HasPlanDetails,
        CASE WHEN OBJECT_ID(N'dbo.KEHOACHCUOCTHIBOMON',N'U') IS NULL THEN 0 ELSE 1 END AS HasDepartmentProposals`)).recordset[0];
      const detailedPlans = optionalTables?.HasDetailedPlan
        ? (await new sql.Request(tx).input('planId', sql.BigInt, planId)
          .query<{Count:number}>(`SELECT COUNT(*) AS Count FROM dbo.KEHOACHTOCHUC WITH(UPDLOCK,HOLDLOCK) WHERE MaKeHoach=@planId`)).recordset[0]?.Count ?? 0
        : 0;
      if (detailedPlans > 0) throw new BadRequestException('Kế hoạch đã có kế hoạch tổ chức chi tiết; không thể xóa');
      const publishedActivities = (await new sql.Request(tx).input('planId', sql.BigInt, planId)
        .query<{Count:number}>(`SELECT COUNT(*) AS Count FROM HOATDONGHOCTHUAT WITH(UPDLOCK,HOLDLOCK)
          WHERE COALESCE(MaKeHoachKhoa,MaKeHoach)=@planId AND TrangThai=N'Đã công bố'`)).recordset[0]?.Count ?? 0;
      if (publishedActivities > 0) throw new BadRequestException('Kế hoạch có hoạt động đã công bố; không thể xóa');
      const detach = new sql.Request(tx).input('planId', sql.BigInt, planId);
      if (optionalTables?.HasDepartmentProposals) {
        await detach.query(`UPDATE dbo.KEHOACHCUOCTHIBOMON SET MaKeHoachKhoa=NULL WHERE MaKeHoachKhoa=@planId`);
      }
      await detach.query(`
        UPDATE HOATDONGHOCTHUAT SET MaKeHoachKhoa=NULL WHERE MaKeHoachKhoa=@planId;
        UPDATE HOATDONGHOCTHUAT SET MaKeHoach=NULL WHERE MaKeHoach=@planId AND MaKeHoachKhoa IS NULL;
      `);
      if (optionalTables?.HasPlanDetails) {
        await detach.query(`DELETE FROM dbo.CHITIETKEHOACH WHERE MaKeHoach=@planId`);
      }
      await detach.query(`
        DELETE FROM KEHOACHHOCTHUAT WHERE MaKeHoach=@planId;
      `);
      await tx.commit();
      return {maKeHoach:planId, deleted:true};
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
  async addPlanActivity(context: SessionContext, planId: number, dto: CreatePlanActivityDto) {
    this.requireAcademicCoordinator(context);
    const plan=await this.requireITPlan(planId);
    if(!['Dự thảo','Cần bổ sung'].includes(plan.TrangThai)) throw new BadRequestException('Chỉ chỉnh sửa hạng mục khi kế hoạch còn ở trạng thái dự thảo/cần bổ sung');
    const rows = await this.db.query(`INSERT INTO CHITIETKEHOACH(MaKeHoach,TenHoatDong,NoiDung,ThoiGianDuKien,ThoiGianKetThuc,HanDangKy,DiaDiem,DoiTuong,ChiTieu,NguoiPhuTrach,DuToan)
      OUTPUT INSERTED.MaChiTiet VALUES(@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11)`, [planId,dto.tenHoatDong,dto.noiDung ?? null,dto.thoiGianDuKien ?? null,dto.thoiGianKetThuc ?? null,dto.hanDangKy ?? null,dto.diaDiem ?? null,dto.doiTuong ?? null,dto.chiTieu ?? null,dto.nguoiPhuTrach ?? null,dto.duToan]);
    if (!rows[0]) throw new NotFoundException('Không tìm thấy kế hoạch');
    return rows[0];
  }
  async selectPlanActivities(context:SessionContext,planId:number,dto:{maHDs:number[]}) {
    this.requireAcademicCoordinator(context);
    await this.requireITPlan(planId);
    const activityIds=[...new Set(dto.maHDs.map(Number))];
    if(activityIds.some((id)=>!Number.isSafeInteger(id)||id<1)) throw new BadRequestException('Danh sách mã hoạt động không hợp lệ');
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const plan=(await new sql.Request(tx).input('planId',sql.BigInt,planId)
        .query<{MaKhoa:number;NamHoc:string;TrangThai:string}>(`SELECT MaKhoa,NamHoc,TrangThai FROM KEHOACHHOCTHUAT WITH(UPDLOCK,HOLDLOCK) WHERE MaKeHoach=@planId`)).recordset[0];
      if(!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
      if(!['Dự thảo','Cần bổ sung'].includes(plan.TrangThai)) throw new BadRequestException('Chỉ được chọn hoạt động khi kế hoạch còn là bản nháp hoặc đang cần bổ sung');

      let selected: Array<{MaHD:number;TrangThai:string;TrangThaiDeXuatBoMon:string|null;MaDeXuat:number|null;MaKeHoachDeXuat:number|null;NamHoc:string|null;MaBM:number|null;MaKhoa:number|null;MaKeHoach:number|null;MaKeHoachKhoa:number|null}> = [];
      if(activityIds.length){
        const request=new sql.Request(tx).input('planId',sql.BigInt,planId);
        activityIds.forEach((id,index)=>request.input(`activity${index}`,sql.BigInt,id));
        const idParams=activityIds.map((_,index)=>`@activity${index}`).join(',');
        selected=(await request.query(`SELECT h.MaHD,h.TrangThai,h.NamHoc,h.MaKeHoach,h.MaKeHoachKhoa,
            departmentProposal.TrangThai AS TrangThaiDeXuatBoMon,departmentProposal.MaDeXuat,departmentProposal.MaKeHoachKhoa AS MaKeHoachDeXuat,
            COALESCE(h.MaBM,gv.MaBM) AS MaBM,
            COALESCE(activityBm.MaKhoa,creatorBm.MaKhoa,cb.MaKhoa) AS MaKhoa
          FROM HOATDONGHOCTHUAT h WITH(UPDLOCK,HOLDLOCK)
          OUTER APPLY (SELECT TOP (1) p.MaDeXuat,p.TrangThai,p.MaKeHoachKhoa FROM KEHOACHCUOCTHIBOMON p WITH(UPDLOCK,HOLDLOCK) WHERE p.MaHD=h.MaHD ORDER BY p.MaDeXuat DESC) departmentProposal
          LEFT JOIN TAIKHOAN owner ON owner.MaTK=h.NguoiLap
          LEFT JOIN GIANGVIEN gv ON gv.MaNgDung=owner.MaNgDung
          LEFT JOIN BOMON activityBm ON activityBm.MaBM=h.MaBM
          LEFT JOIN BOMON creatorBm ON creatorBm.MaBM=gv.MaBM
          LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=owner.MaNgDung
          WHERE h.MaHD IN(${idParams})`)).recordset;
        if(selected.length!==activityIds.length) throw new NotFoundException('Có hoạt động không tồn tại hoặc đã bị xóa');
        const normalizedYear=(value:unknown)=>String(value??'').replace(/\s/g,'').replace(/[–—]/g,'-');
        for(const activity of selected){
          const forwardedByDepartment=['Chờ khoa','Đã duyệt'].includes(activity.TrangThaiDeXuatBoMon ?? '')
            && ['Chờ duyệt','Đã duyệt','Đã công bố'].includes(activity.TrangThai);
          const legacyApproved=!activity.TrangThaiDeXuatBoMon && ['Đã duyệt','Đã công bố'].includes(activity.TrangThai);
          if(!forwardedByDepartment && !legacyApproved) throw new BadRequestException(`Hoạt động #${activity.MaHD} chưa được Phụ trách bộ môn chuyển lên`);
          if(!activity.NamHoc || normalizedYear(activity.NamHoc)!==normalizedYear(plan.NamHoc)) throw new BadRequestException(`Hoạt động #${activity.MaHD} không thuộc năm học ${plan.NamHoc}`);
          if(!activity.MaKhoa || Number(activity.MaKhoa)!==Number(plan.MaKhoa)) throw new BadRequestException(`Không thể gộp hoạt động #${activity.MaHD}: hoạt động phải thuộc khoa của kế hoạch`);
          const linkedPlan=activity.MaKeHoachDeXuat??activity.MaKeHoachKhoa??activity.MaKeHoach;
          if(linkedPlan && Number(linkedPlan)!==planId) throw new ConflictException(`Hoạt động #${activity.MaHD} đã được gộp vào kế hoạch khác`);
        }
      }

      const notSelected=activityIds.length?` AND MaHD NOT IN(${activityIds.map((_,index)=>`@activity${index}`).join(',')})`:'';
      const notSelectedProposal=activityIds.length?` AND p.MaHD NOT IN(${activityIds.map((_,index)=>`@activity${index}`).join(',')})`:'';
      const detach=new sql.Request(tx).input('planId',sql.BigInt,planId);
      activityIds.forEach((id,index)=>detach.input(`activity${index}`,sql.BigInt,id));
      await detach.query(`UPDATE HOATDONGHOCTHUAT SET MaKeHoachKhoa=NULL
        WHERE MaKeHoachKhoa=@planId${notSelected}`);
      const detachLegacy=new sql.Request(tx).input('planId',sql.BigInt,planId);
      activityIds.forEach((id,index)=>detachLegacy.input(`activity${index}`,sql.BigInt,id));
      await detachLegacy.query(`UPDATE HOATDONGHOCTHUAT SET MaKeHoach=NULL
        WHERE MaKeHoach=@planId AND MaKeHoachKhoa IS NULL${notSelected}`);
      const detachProposals=new sql.Request(tx).input('planId',sql.BigInt,planId);
      activityIds.forEach((id,index)=>detachProposals.input(`activity${index}`,sql.BigInt,id));
      await detachProposals.query(`UPDATE p SET MaKeHoachKhoa=NULL,NgayCapNhat=SYSDATETIMEOFFSET()
        FROM KEHOACHCUOCTHIBOMON p
        WHERE p.MaKeHoachKhoa=@planId
          AND p.MaDeXuat=(SELECT MAX(latest.MaDeXuat) FROM KEHOACHCUOCTHIBOMON latest WHERE latest.MaHD=p.MaHD)${notSelectedProposal}`);

      if(activityIds.length){
        for(const activity of selected){
          const activityId=activity.MaHD;
          if(activity.MaDeXuat){
            const proposal=await new sql.Request(tx).input('planId',sql.BigInt,planId).input('proposalId',sql.BigInt,activity.MaDeXuat)
              .query(`UPDATE KEHOACHCUOCTHIBOMON SET MaKeHoachKhoa=@planId,NgayCapNhat=SYSDATETIMEOFFSET()
                WHERE MaDeXuat=@proposalId AND TrangThai IN(N'Chờ khoa',N'Đã duyệt')
                  AND (MaKeHoachKhoa IS NULL OR MaKeHoachKhoa=@planId);
                SELECT @@ROWCOUNT AS Updated;`);
            if(!proposal.recordset[0]?.Updated) throw new ConflictException(`Đề xuất của hoạt động #${activityId} vừa thay đổi hoặc đã được gộp vào kế hoạch khác`);
          }
          const attached=await new sql.Request(tx).input('planId',sql.BigInt,planId).input('activityId',sql.BigInt,activityId)
            .query(`UPDATE HOATDONGHOCTHUAT SET MaKeHoachKhoa=@planId,MaKeHoach=NULL
              WHERE MaHD=@activityId
                AND (MaKeHoachKhoa IS NULL OR MaKeHoachKhoa=@planId)
                AND (MaKeHoach IS NULL OR MaKeHoach=@planId);
              SELECT @@ROWCOUNT AS Updated;`);
          if(!attached.recordset[0]?.Updated) throw new ConflictException(`Hoạt động #${activityId} đã được gộp vào kế hoạch khác hoặc vừa thay đổi`);
        }
      }
      await tx.commit();
      return {maKeHoach:planId,soHoatDong:activityIds.length,message:'Đã cập nhật danh sách hoạt động học thuật của kế hoạch'};
    } catch(error) { try{await tx.rollback();}catch{/* keep the original workflow error */} throw error; }
  }
  async publishPlanNews(context:SessionContext,planId:number) {
    this.requireAcademicCoordinator(context);
    await this.requireITPlan(planId);
    throw new BadRequestException('Kế hoạch năm học chưa phải căn cứ công bố. Hãy lập kế hoạch chi tiết, xin chữ ký khoa và CTSV, rồi dùng /detailed-plans/:activityId/publish');
  }
  async publishPlanActivity(context:SessionContext,detailId:number) {
    this.require(context,['ADMIN','CANBOKHOA','TRUONGKHOA','GIANGVIEN']);
    const detail=(await this.db.query<{MaKeHoach:number}>('SELECT MaKeHoach FROM CHITIETKEHOACH WHERE MaChiTiet=@p1',[detailId]))[0];
    if(!detail) throw new NotFoundException('Không tìm thấy hạng mục kế hoạch');
    await this.requireITPlan(detail.MaKeHoach);
    throw new BadRequestException('Không công bố trực tiếp từ hạng mục năm học. Hãy dùng kế hoạch chi tiết đã được khoa và CTSV ký tại /detailed-plans/:activityId/publish');
  }
  async submitPlan(context: SessionContext, planId: number) {
    this.requireAcademicCoordinator(context);
    await this.requireITPlan(planId);
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const plan=(await new sql.Request(tx).input('id',sql.BigInt,planId)
        .query<{TrangThai:string}>(`SELECT TrangThai FROM KEHOACHHOCTHUAT WITH(UPDLOCK,HOLDLOCK) WHERE MaKeHoach=@id`)).recordset[0];
      if(!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
      if(!['Dự thảo','Cần bổ sung'].includes(plan.TrangThai)) throw new BadRequestException('Kế hoạch không ở trạng thái có thể trình duyệt');
      const activityCount=(await new sql.Request(tx).input('id',sql.BigInt,planId)
        .query<{Total:number}>(`SELECT COUNT(*) AS Total FROM HOATDONGHOCTHUAT h WITH(UPDLOCK,HOLDLOCK)
          OUTER APPLY (SELECT TOP (1) p.TrangThai,p.MaKeHoachKhoa FROM KEHOACHCUOCTHIBOMON p WHERE p.MaHD=h.MaHD ORDER BY p.MaDeXuat DESC) departmentProposal
          WHERE (COALESCE(h.MaKeHoachKhoa,h.MaKeHoach)=@id OR departmentProposal.MaKeHoachKhoa=@id)
            AND ((h.TrangThai IN(N'Đã duyệt',N'Đã công bố') AND (departmentProposal.TrangThai IS NULL OR departmentProposal.TrangThai IN(N'Chờ khoa',N'Đã duyệt')))
              OR (h.TrangThai=N'Chờ duyệt' AND departmentProposal.TrangThai=N'Chờ khoa' AND departmentProposal.MaKeHoachKhoa=@id))`)).recordset[0]?.Total??0;
      const departmentCount=(await new sql.Request(tx).input('id',sql.BigInt,planId)
        .query<{Total:number}>(`SELECT COUNT(*) AS Total FROM KEHOACHCUOCTHIBOMON WITH(UPDLOCK,HOLDLOCK)
          WHERE MaKeHoachKhoa=@id AND TrangThai=N'Đã duyệt'`)).recordset[0]?.Total??0;
      if(!activityCount && !departmentCount) throw new BadRequestException('Trước khi trình ký, hãy gộp ít nhất một hoạt động học thuật hoặc đề xuất cuộc thi bộ môn đã duyệt vào kế hoạch');
      const event=JSON.stringify({action:'submit',userId:context.userId,role:context.user.roles[0],at:new Date().toISOString()});
      const result=await new sql.Request(tx).input('id',sql.BigInt,planId).input('event',sql.NVarChar(sql.MAX),event)
        .query(`UPDATE KEHOACHHOCTHUAT SET TrangThai=N'Chờ Trưởng khoa ký duyệt',LichSuDuyet=JSON_MODIFY(COALESCE(LichSuDuyet,N'[]'),'append $',JSON_QUERY(@event))
          OUTPUT INSERTED.MaKeHoach,INSERTED.TrangThai WHERE MaKeHoach=@id AND TrangThai IN(N'Dự thảo',N'Cần bổ sung')`);
      if(!result.recordset[0]) throw new ConflictException('Trạng thái kế hoạch vừa thay đổi; hãy tải lại và kiểm tra.');
      await tx.commit();
      return result.recordset[0];
    } catch(error) { try{await tx.rollback();}catch{/* keep the original workflow error */} throw error; }
  }
  async reviewPlan(context: SessionContext, planId: number, dto: ReviewPlanDto) {
    await this.requireFacultySigner(context);
    await this.requireITPlan(planId);
    const tx = new sql.Transaction(this.db.pool);
    await tx.begin();
    try {
      const plan = (await new sql.Request(tx).input('id',sql.BigInt,planId)
        .query<{TrangThai:string}>(`SELECT TrangThai FROM KEHOACHHOCTHUAT WITH(UPDLOCK,HOLDLOCK) WHERE MaKeHoach=@id`)).recordset[0];
      if(!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
      if(plan.TrangThai!=='Chờ Trưởng khoa ký duyệt') throw new BadRequestException('Kế hoạch không ở bước chờ Trưởng khoa ký duyệt');
      const nextStatus=dto.action==='approve'?'Đã duyệt':dto.action==='request_changes'?'Cần bổ sung':'Không duyệt';
      const event=JSON.stringify({action:dto.action,stage:'faculty-dean',stageName:'Trưởng khoa ký duyệt kế hoạch chung',expectedRole:'TRUONGKHOA',role:context.user.roles.some(role=>key(role)==='ADMIN')?'ADMIN':'TRUONGKHOA',userId:context.userId,signed:dto.action==='approve',note:dto.ghiChu??null,at:new Date().toISOString()});
      const result=await new sql.Request(tx).input('id',sql.BigInt,planId).input('nextStatus',sql.NVarChar(40),nextStatus)
        .input('reviewer',sql.BigInt,context.userId).input('event',sql.NVarChar(sql.MAX),event)
        .query(`UPDATE KEHOACHHOCTHUAT SET TrangThai=@nextStatus,NguoiDuyet=@reviewer,
          NgayDuyet=CASE WHEN @nextStatus=N'Đã duyệt' THEN SYSDATETIMEOFFSET() ELSE NULL END,
          LichSuDuyet=JSON_MODIFY(COALESCE(LichSuDuyet,N'[]'),'append $',JSON_QUERY(@event))
          OUTPUT INSERTED.MaKeHoach,INSERTED.TrangThai,INSERTED.NguoiDuyet,INSERTED.NgayDuyet,INSERTED.LichSuDuyet
          WHERE MaKeHoach=@id AND TrangThai=N'Chờ Trưởng khoa ký duyệt'`);
      if(!result.recordset[0]) throw new ConflictException('Kế hoạch vừa thay đổi; hãy tải lại');
      if (dto.action === 'approve') {
        const approvalEvent = JSON.stringify({ action: 'approve', stage: 'faculty-dean', stageName: 'Trưởng khoa duyệt kế hoạch học thuật tổng hợp', userId: context.userId, at: new Date().toISOString() });
        await new sql.Request(tx).input('id',sql.BigInt,planId).input('reviewer',sql.BigInt,context.userId).input('event',sql.NVarChar(sql.MAX),approvalEvent).query(`
          UPDATE KEHOACHCUOCTHIBOMON SET TrangThai=N'Đã duyệt',GhiChuDuyet=NULL,NgayCapNhat=SYSDATETIMEOFFSET()
          WHERE MaKeHoachKhoa=@id AND TrangThai=N'Chờ khoa';
          UPDATE h SET TrangThai=N'Đã duyệt',NguoiDuyetDeXuat=@reviewer,NgayDuyetDeXuat=SYSDATETIMEOFFSET(),
            LichSuDuyetDeXuat=JSON_MODIFY(COALESCE(LichSuDuyetDeXuat,N'[]'),'append $',JSON_QUERY(@event))
          FROM HOATDONGHOCTHUAT h JOIN KEHOACHCUOCTHIBOMON p ON p.MaHD=h.MaHD
          WHERE p.MaKeHoachKhoa=@id AND p.TrangThai=N'Đã duyệt' AND h.TrangThai=N'Chờ duyệt';
          UPDATE d SET TrangThai=N'Đã duyệt',NguoiDuyet=@reviewer,NgayDuyet=SYSDATETIME(),GhiChuDuyet=NULL
          FROM DUTRUKINHPHI d JOIN KEHOACHCUOCTHIBOMON p ON p.MaHD=d.MaHD
          WHERE p.MaKeHoachKhoa=@id AND p.TrangThai=N'Đã duyệt' AND d.TrangThai IN(N'Chờ duyệt',N'Cần bổ sung');
          UPDATE k SET TrangThai=N'Đã duyệt'
          FROM KINHPHIHOATDONG k JOIN DUTRUKINHPHI d ON d.MaDuTruKP=k.MaDuTruKP
          JOIN KEHOACHCUOCTHIBOMON p ON p.MaHD=d.MaHD
          WHERE p.MaKeHoachKhoa=@id AND p.TrangThai=N'Đã duyệt' AND d.TrangThai=N'Đã duyệt';
        `);
      }
      await tx.commit();
      return result.recordset[0];
    } catch(error) {await tx.rollback().catch(()=>undefined);throw error;}
  }
  listRounds(competitionId: number) { return this.db.query(`SELECT * FROM VONGTHI WHERE MaCThi=@p1 ORDER BY ThuTu`,[competitionId]); }
  async createRound(context: SessionContext,dto:CreateRoundDto) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN']);
    const rows=await this.db.query(`INSERT INTO VONGTHI(MaCThi,TenVong,ThuTu,MoTa,BatDauLuc,KetThucLuc,HanNopBai) OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4,@p5,@p6,@p7)`,[dto.maCThi,dto.tenVong,dto.thuTu,dto.moTa??null,dto.batDauLuc??null,dto.ketThucLuc??null,dto.hanNopBai??null]);
    return rows[0];
  }
  async submitWork(context:SessionContext,roundId:number,dto:SubmitWorkDto) {
    const student=(await this.db.query<{MaSV:number}>(`SELECT s.MaSV FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung WHERE t.MaTK=@p1`,[context.userId]))[0];
    if(!student) throw new ForbiddenException('Chỉ sinh viên được nộp bài');
    const round=(await this.db.query<{HanNopBai:Date|null;MaCThi:number;MaHD:number}>(`SELECT v.HanNopBai,v.MaCThi,c.MaHD FROM VONGTHI v JOIN CUOCTHI c ON c.MaCThi=v.MaCThi WHERE v.MaVong=@p1`,[roundId]))[0];
    if(!round) throw new NotFoundException('Không tìm thấy vòng thi');
    if(round.HanNopBai && new Date(round.HanNopBai).getTime()<Date.now()) throw new BadRequestException('Đã hết hạn nộp bài');
    const registration=(await this.db.query(`SELECT MaDK FROM DKTHAMGIA WHERE MaDK=@p1 AND MaHD=@p3 AND MaSV=@p2 AND TrangThai NOT IN (N'Đã hủy',N'Từ chối')`,[dto.maDK,student.MaSV,round.MaHD]))[0];
    if(!registration) throw new ForbiddenException('Đơn đăng ký không thuộc về bạn');
    if(dto.maDoi) { const membership=await this.db.query(`SELECT 1 AS ok FROM THANHVIENDOI tv JOIN DOITHI d ON d.MaDoi=tv.MaDoi WHERE tv.MaDoi=@p1 AND tv.MaSV=@p2 AND d.MaCThi=@p3`,[dto.maDoi,student.MaSV,round.MaCThi]); if(!membership.length) throw new ForbiddenException('Bạn không thuộc đội của cuộc thi này'); }
    const rows=await this.db.query(`INSERT INTO BAITHI(MaVong,MaDK,MaDoi,TieuDe,MoTa,TepDinhKem) OUTPUT INSERTED.MaBai,INSERTED.NopLuc VALUES(@p1,@p2,@p3,@p4,@p5,@p6)`,[roundId,dto.maDoi?null:dto.maDK,dto.maDoi??null,dto.tieuDe,dto.moTa??null,JSON.stringify(dto.tepDinhKem??[])]);
    return rows[0];
  }
  async scoreWork(context:SessionContext,workId:number,dto:ScoreWorkDto) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','BANGIAMKHAO']);
    const rows=await this.db.query(`IF EXISTS(SELECT 1 FROM CHAMDIEMVONG WHERE MaBai=@p1 AND MaTK=@p2)
      UPDATE CHAMDIEMVONG SET Diem=@p3,NhanXet=@p4,ChamLuc=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE MaBai=@p1 AND MaTK=@p2
      ELSE INSERT INTO CHAMDIEMVONG(MaBai,MaTK,Diem,NhanXet) OUTPUT INSERTED.* VALUES(@p1,@p2,@p3,@p4)`,[workId,context.userId,dto.diem,dto.nhanXet??null]);
    if(!rows[0]) throw new NotFoundException('Không tìm thấy bài nộp'); return rows[0];
  }
  async listSubmissions(context:SessionContext,roundId:number) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','BANGIAMKHAO']);
    return this.db.query(`SELECT b.MaBai,b.MaVong,b.MaDK,b.MaDoi,b.TieuDe,b.MoTa,b.TepDinhKem,b.NopLuc,b.TrangThai,
      d.TenDoi,s.MSSV,n.HoTen,
      (SELECT AVG(c.Diem) FROM CHAMDIEMVONG c WHERE c.MaBai=b.MaBai) AS DiemTrungBinh,
      (SELECT COUNT(*) FROM CHAMDIEMVONG c WHERE c.MaBai=b.MaBai) AS SoLuotCham
      FROM BAITHI b LEFT JOIN DOITHI d ON d.MaDoi=b.MaDoi LEFT JOIN DKTHAMGIA dk ON dk.MaDK=b.MaDK
      LEFT JOIN SINHVIEN s ON s.MaSV=dk.MaSV LEFT JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung
      WHERE b.MaVong=@p1 ORDER BY b.NopLuc`,[roundId]);
  }
  async getCompetitionResults(competitionId:number) {
    return this.db.query(`SELECT kq.MaKQ,kq.MaCThi,kq.MaDK,kq.MaDoi,kq.MaGT,kq.LoaiKQ,kq.XepHang,kq.Diem,kq.GhiChu,kq.TrangThai,gt.TenGT,gt.CapGiai,d.TenDoi,s.MSSV,n.HoTen
      FROM KETQUAHOCTHUAT kq LEFT JOIN GIAITHUONG gt ON gt.MaGT=kq.MaGT LEFT JOIN DOITHI d ON d.MaDoi=kq.MaDoi
      LEFT JOIN DKTHAMGIA dk ON dk.MaDK=kq.MaDK LEFT JOIN SINHVIEN s ON s.MaSV=dk.MaSV LEFT JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung
      WHERE kq.MaCThi=@p1 AND kq.TrangThai IN(N'Đã công bố',N'Đã xác nhận') ORDER BY kq.XepHang`,[competitionId]);
  }
  async createCompetitionResult(context:SessionContext,competitionId:number,dto:CompetitionResultDto) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','BANGIAMKHAO']);
    if(Boolean(dto.maDK)===Boolean(dto.maDoi)) throw new BadRequestException('Cần chỉ định đúng một thí sinh cá nhân hoặc một đội');
    if(dto.maDK && !(await this.db.query(`SELECT 1 AS ok FROM DKTHAMGIA WHERE MaDK=@p1 AND MaHD=(SELECT MaHD FROM CUOCTHI WHERE MaCThi=@p2)`,[dto.maDK,competitionId])).length) throw new BadRequestException('Đơn đăng ký không thuộc cuộc thi');
    if(dto.maDoi && !(await this.db.query(`SELECT 1 AS ok FROM DOITHI WHERE MaDoi=@p1 AND MaCThi=@p2`,[dto.maDoi,competitionId])).length) throw new BadRequestException('Đội không thuộc cuộc thi');
    const rows=await this.db.query(`INSERT INTO KETQUAHOCTHUAT(MaCThi,MaDK,MaDoi,MaGT,LoaiKQ,XepHang,Diem,GhiChu,TrangThai)
      OUTPUT INSERTED.MaKQ,INSERTED.TrangThai VALUES(@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,N'Dự thảo')`,[competitionId,dto.maDK??null,dto.maDoi??null,dto.maGT??null,dto.loaiKQ??null,dto.xepHang??null,dto.diem??null,dto.ghiChu??null]);
    return rows[0];
  }
  async publishCompetitionResult(context:SessionContext,resultId:number) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN']);
    const rows=await this.db.query(`UPDATE KETQUAHOCTHUAT SET TrangThai=N'Đã công bố' OUTPUT INSERTED.MaKQ,INSERTED.MaCThi,INSERTED.MaDK,INSERTED.MaDoi,INSERTED.XepHang WHERE MaKQ=@p1 AND TrangThai IN(N'Dự thảo',N'Đã xác nhận')`,[resultId]);
    const result=rows[0]; if(!result) throw new NotFoundException('Không tìm thấy kết quả ở trạng thái có thể công bố');
    await this.db.query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
      SELECT DISTINCT t.MaTK,c.MaHD,N'Kết quả cuộc thi',N'Kết quả cuộc thi đã được công bố',CONCAT(N'Bạn có kết quả xếp hạng ',COALESCE(CONVERT(nvarchar(10),@p2),N''))
      FROM KETQUAHOCTHUAT r JOIN CUOCTHI c ON c.MaCThi=r.MaCThi
      JOIN DKTHAMGIA dk ON dk.MaHD=c.MaHD AND (dk.MaDK=r.MaDK OR (r.MaDoi IS NOT NULL AND EXISTS(SELECT 1 FROM THANHVIENDOI tv WHERE tv.MaDoi=r.MaDoi AND tv.MaSV=dk.MaSV)))
      JOIN SINHVIEN s ON s.MaSV=dk.MaSV JOIN TAIKHOAN t ON t.MaNgDung=s.MaNgDung
      WHERE r.MaKQ=@p1`,[result.MaKQ,result.XepHang]);
    return result;
  }
  private async approvedTrainingPoints(activityId:number) {
    const plan=(await this.db.query<{DiemRenLuyen:number}>(`SELECT d.DiemRenLuyen FROM KEHOACHTOCHUC d JOIN HOATDONGHOCTHUAT h ON h.MaHD=d.MaHD
      WHERE d.MaHD=@p1 AND d.TrangThai=N'Đã duyệt' AND d.NguoiKyKhoa IS NOT NULL AND d.NguoiKyCTSV IS NOT NULL AND h.TrangThai=N'Đã công bố'`,[activityId]))[0];
    if(!plan) throw new BadRequestException('Chưa có kế hoạch chi tiết được khoa và CTSV ký làm căn cứ tính điểm');
    return Number(plan.DiemRenLuyen);
  }
  async awardPoint(context:SessionContext,dto:AwardTrainingPointDto) {
    this.require(context,['ADMIN','PHONG_CTSV','PHONGCTSV','CONG_TAC_SINH_VIEN','CAN_BO_CTSV']);
    const approved=await this.approvedTrainingPoints(dto.maHD);
    if(dto.diem!==approved) throw new BadRequestException('Điểm phải khớp kế hoạch đã được CTSV ký');
    const rows=await this.db.query(`INSERT INTO DIEMRENLUYEN(MaSV,MaHD,HocKy,NamHoc,SoDiem,LyDo,TrangThai,NguoiGhi) OUTPUT INSERTED.MaDiem,INSERTED.TrangThai VALUES(@p1,@p2,@p3,@p4,@p5,@p6,N'Chờ xác nhận',@p7)`,[dto.maSV,dto.maHD,dto.hocKy,dto.namHoc,dto.diem,dto.lyDo,context.userId]);
    return rows[0];
  }
  async reviewPoint(context:SessionContext,pointId:number,action:'approve'|'reject') {
    this.require(context,['ADMIN','PHONG_CTSV','PHONGCTSV','CONG_TAC_SINH_VIEN','CAN_BO_CTSV']);
    const status=action==='approve'?'Đã xác nhận':'Từ chối';
    const rows=await this.db.query(`UPDATE DIEMRENLUYEN SET TrangThai=@p2,NguoiDuyet=@p3,DuyetLuc=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE MaDiem=@p1 AND TrangThai=N'Chờ xác nhận'`,[pointId,status,context.userId]);
    if(!rows[0]) throw new NotFoundException('Không tìm thấy điểm đang chờ xác nhận'); return rows[0];
  }
  async adjustPoint(context:SessionContext,pointId:number,dto:AdjustTrainingPointDto) {
    this.require(context,['ADMIN','PHONG_CTSV','PHONGCTSV','CONG_TAC_SINH_VIEN','CAN_BO_CTSV']);
    if(dto.diemMoi===0) throw new BadRequestException('Điểm điều chỉnh không được bằng 0');
    const original=(await this.db.query<{MaSV:number;MaHD:number;HocKy:string;NamHoc:string}>(`SELECT MaSV,MaHD,HocKy,NamHoc FROM DIEMRENLUYEN WHERE MaDiem=@p1`,[pointId]))[0];
    if(!original) throw new NotFoundException('Không tìm thấy bản ghi điểm rèn luyện');
    const rows=await this.db.query(`INSERT INTO DIEMRENLUYEN(MaSV,MaHD,HocKy,NamHoc,SoDiem,LyDo,TrangThai,MaDiemGoc,NguoiGhi)
      OUTPUT INSERTED.MaDiem,INSERTED.SoDiem,INSERTED.TrangThai,INSERTED.MaDiemGoc VALUES(@p1,@p2,@p3,@p4,@p5,@p6,N'Chờ xác nhận',@p7,@p8)`,
      [original.MaSV,original.MaHD,original.HocKy,original.NamHoc,dto.diemMoi,dto.lyDo,pointId,context.userId]);
    return rows[0];
  }
  async createAttendanceCode(context:SessionContext,activityId:number,expiresAt:string) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN']);
    if(!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt)<=Date.now()) throw new BadRequestException('Thời điểm hết hạn QR phải nằm trong tương lai');
    if(!(await this.db.query(`SELECT 1 AS found FROM HOATDONGHOCTHUAT WHERE MaHD=@p1`,[activityId])).length) throw new NotFoundException('Không tìm thấy hoạt động');
    const token=randomBytes(24).toString('hex');
    const rows=await this.db.query(`INSERT INTO MAQR(MaHD,MaQRCode,TGMo,TGHetHan,TrangThai) OUTPUT INSERTED.MaQR,INSERTED.TGHetHan VALUES(@p1,@p2,SYSDATETIMEOFFSET(),@p3,N'Hoạt động')`,[activityId,token,expiresAt]);
    if(!rows[0]) throw new NotFoundException('Không tìm thấy hoạt động'); return { ...rows[0], maQRCode:token };
  }
  async checkIn(context:SessionContext,token:string) {
    const q=(await this.db.query<{MaQR:number;MaHD:number;TgBatDau:string | Date | null;TenHoatDong:string}>(`SELECT qr.MaQR,qr.MaHD,h.TgDuKien AS TgBatDau,h.TenHoatDong FROM MAQR qr JOIN HOATDONGHOCTHUAT h ON h.MaHD=qr.MaHD WHERE qr.MaQRCode=@p1 AND qr.TrangThai=N'Hoạt động' AND qr.TGMo<=SYSDATETIMEOFFSET() AND qr.TGHetHan>SYSDATETIMEOFFSET()`,[token]))[0];
    if(!q) throw new BadRequestException('Mã điểm danh không hợp lệ hoặc đã hết hạn');
    const start = parseActivityDate(q.TgBatDau);
    if(!start) throw new BadRequestException('Thời gian dự kiến của hoạt động cần có ngày hợp lệ để điểm danh');
    const reg=(await this.db.query<{MaDK:number;MaSV:number}>(`SELECT dk.MaDK,dk.MaSV FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung JOIN DKTHAMGIA dk ON dk.MaSV=s.MaSV WHERE t.MaTK=@p1 AND dk.MaHD=@p2 AND dk.TrangThai IN (N'Đã đăng ký',N'Đã xác nhận')`,[context.userId,q.MaHD]))[0];
    if(!reg) throw new ForbiddenException('Bạn chưa đăng ký hoạt động này');
    if((await this.db.query(`SELECT 1 AS found FROM DIEMDANH WHERE MaDK=@p1`,[reg.MaDK])).length) throw new ConflictException('Bạn đã được điểm danh cho hoạt động này');
    const approvedPoints=await this.approvedTrainingPoints(q.MaHD);
    const month=start.getMonth()+1; const year=start.getFullYear();
    const academicYear=month>=8?`${year}-${year+1}`:`${year-1}-${year}`;
    const semester=month>=8?'HK1':month<=1||month>=2&&month<=5?'HK2':'HK3';
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const rows=await new sql.Request(tx).input('qr',sql.BigInt,q.MaQR).input('registration',sql.BigInt,reg.MaDK)
        .query(`INSERT INTO DIEMDANH(MaQR,MaDK,TrangThai) OUTPUT INSERTED.MaDD,INSERTED.BatDauLuc,INSERTED.TrangThai VALUES(@qr,@registration,N'Đã điểm danh')`);
      await new sql.Request(tx).input('student',sql.BigInt,reg.MaSV).input('activity',sql.BigInt,q.MaHD)
        .input('approvedPoints',sql.Decimal(5,2),approvedPoints).input('semester',sql.NVarChar(30),semester).input('year',sql.VarChar(20),academicYear).input('account',sql.BigInt,context.userId).input('name',sql.NVarChar(250),q.TenHoatDong)
        .query(`IF NOT EXISTS(SELECT 1 FROM DIEMRENLUYEN WITH(UPDLOCK,HOLDLOCK) WHERE MaSV=@student AND MaHD=@activity AND TrangThai IN(N'Chờ xác nhận',N'Đã xác nhận'))
          INSERT INTO DIEMRENLUYEN(MaSV,MaHD,HocKy,NamHoc,SoDiem,LyDo,TrangThai,NguoiGhi)
          VALUES(@student,@activity,@semester,@year,@approvedPoints,CONCAT(N'Điểm danh tham gia hoạt động: ',@name),N'Chờ xác nhận',@account)`);
      await new sql.Request(tx).input('activity',sql.BigInt,q.MaHD).input('account',sql.BigInt,context.userId).input('title',sql.NVarChar(250),`Điểm danh thành công: ${q.TenHoatDong}`)
        .input('message',sql.NVarChar(sql.MAX),'Bạn được ghi nhận điểm danh. Điểm rèn luyện theo kế hoạch được CTSV ký đã được gửi chờ Phòng Công tác sinh viên xác nhận.')
        .query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung) VALUES(@account,@activity,N'Điểm danh',@title,@message)`);
      await tx.commit(); return {...rows.recordset[0],diemRenLuyen:{soDiem:approvedPoints,trangThai:'Chờ xác nhận'}};
    } catch(error) {try{await tx.rollback();}catch{/* already rolled back */} throw error;}
  }
  async manualAttendance(context:SessionContext,registrationId:number) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','BAN_TO_CHUC','BANTOCHUC']);
    const registration=(await this.db.query<{MaDK:number;MaSV:number;MaHD:number;TgBatDau:string | Date | null;TenHoatDong:string}>(
      `SELECT d.MaDK,d.MaSV,d.MaHD,h.TgDuKien AS TgBatDau,h.TenHoatDong FROM DKTHAMGIA d JOIN HOATDONGHOCTHUAT h ON h.MaHD=d.MaHD
       WHERE d.MaDK=@p1 AND d.TrangThai IN(N'Đã đăng ký',N'Đã xác nhận')`,[registrationId]))[0];
    if(!registration) throw new NotFoundException('Không tìm thấy đăng ký đang hoạt động');
    if((await this.db.query(`SELECT 1 AS found FROM DIEMDANH WHERE MaDK=@p1`,[registrationId])).length) throw new ConflictException('Sinh viên đã được điểm danh');
    const start = parseActivityDate(registration.TgBatDau);
    if(!start) throw new BadRequestException('Thời gian dự kiến của hoạt động cần có ngày hợp lệ để điểm danh');
    const approvedPoints=await this.approvedTrainingPoints(registration.MaHD);
    const month=start.getMonth()+1; const year=start.getFullYear();
    const academicYear=month>=8?`${year}-${year+1}`:`${year-1}-${year}`;
    const semester=month>=8?'HK1':month<=5?'HK2':'HK3';
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const attendance=await new sql.Request(tx).input('registration',sql.BigInt,registrationId).input('account',sql.BigInt,context.userId)
        .query(`INSERT INTO DIEMDANH(MaQR,MaDK,TrangThai,NguonDiemDanh,NguoiXacNhan)
          OUTPUT INSERTED.MaDD,INSERTED.BatDauLuc,INSERTED.TrangThai,INSERTED.NguonDiemDanh
          VALUES(NULL,@registration,N'Đã điểm danh',N'Danh sách ký tay',@account)`);
      await new sql.Request(tx).input('student',sql.BigInt,registration.MaSV).input('activity',sql.BigInt,registration.MaHD)
        .input('approvedPoints',sql.Decimal(5,2),approvedPoints).input('semester',sql.NVarChar(30),semester).input('year',sql.VarChar(20),academicYear).input('account',sql.BigInt,context.userId).input('name',sql.NVarChar(250),registration.TenHoatDong)
        .query(`IF NOT EXISTS(SELECT 1 FROM DIEMRENLUYEN WITH(UPDLOCK,HOLDLOCK) WHERE MaSV=@student AND MaHD=@activity AND TrangThai IN(N'Chờ xác nhận',N'Đã xác nhận'))
          INSERT INTO DIEMRENLUYEN(MaSV,MaHD,HocKy,NamHoc,SoDiem,LyDo,TrangThai,NguoiGhi)
          VALUES(@student,@activity,@semester,@year,@approvedPoints,CONCAT(N'Điểm danh tham gia hoạt động: ',@name),N'Chờ xác nhận',@account)`);
      await new sql.Request(tx).input('student',sql.BigInt,registration.MaSV).input('activity',sql.BigInt,registration.MaHD)
        .input('title',sql.NVarChar(250),`Điểm danh thành công: ${registration.TenHoatDong}`)
        .query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
          SELECT t.MaTK,@activity,N'Điểm danh',@title,N'Bạn đã được điểm danh thủ công. Điểm rèn luyện theo kế hoạch được CTSV ký đang chờ xác nhận.'
          FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung WHERE s.MaSV=@student`);
      await tx.commit();
      return {...attendance.recordset[0],maDK:registrationId,diemRenLuyen:{soDiem:approvedPoints,trangThai:'Chờ xác nhận'}};
    } catch(error) {try{await tx.rollback();}catch{/* already rolled back */} throw error;}
  }
  async notifications(context:SessionContext) { return this.db.query(`SELECT TOP(100) MaThongBao,MaHD,Loai,TieuDe,NoiDung,GuiLuc,DocLuc FROM THONGBAO WHERE MaTK=@p1 ORDER BY GuiLuc DESC`,[context.userId]); }
  async changeActivityAndNotify(context:SessionContext,activityId:number,dto:ActivityChangeDto) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN']);
    if(Date.parse(dto.endsAt)<=Date.parse(dto.startsAt)) throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const changed=await new sql.Request(tx).input('id',sql.BigInt,activityId).input('start',sql.DateTime2,dto.startsAt).input('end',sql.DateTime2,dto.endsAt).input('place',sql.NVarChar(255),dto.venue??null)
        .query(`UPDATE HOATDONGHOCTHUAT SET TgBatDau=@start,TgKetThuc=@end,DiaDiem=COALESCE(@place,DiaDiem) OUTPUT INSERTED.TenHoatDong,INSERTED.TgBatDau,INSERTED.TgKetThuc,INSERTED.DiaDiem WHERE MaHD=@id AND TrangThai NOT IN(N'Đã hủy',N'Đã kết thúc')`);
      if(!changed.recordset[0]) throw new NotFoundException('Không tìm thấy hoạt động đang diễn ra/chưa kết thúc');
      const info=changed.recordset[0];
      await new sql.Request(tx).input('id',sql.BigInt,activityId).input('title',sql.NVarChar(250),`Thay đổi lịch: ${info.TenHoatDong}`).input('message',sql.NVarChar(sql.MAX),`${dto.reason} Thời gian mới: ${new Date(info.TgBatDau).toISOString()} – ${new Date(info.TgKetThuc).toISOString()}; địa điểm: ${info.DiaDiem ?? 'Chưa cập nhật'}.`)
        .query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung) SELECT DISTINCT t.MaTK,@id,N'Thay đổi hoạt động',@title,@message FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung JOIN DKTHAMGIA d ON d.MaSV=s.MaSV WHERE d.MaHD=@id AND d.TrangThai IN(N'Đã đăng ký',N'Đã xác nhận')`);
      await tx.commit(); return {message:'Đã cập nhật lịch và tạo thông báo cho sinh viên đã đăng ký',data:info};
    } catch(error) {try{await tx.rollback();}catch{/* transaction has already rolled back */} throw error;}
  }
  async listWaitlist(context:SessionContext,activityId:number) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN']);
    return this.db.query(`SELECT q.MaCho,q.MaHD,q.MaSV,s.MSSV,n.HoTen,l.TenLop,q.DangKyLuc,q.TrangThai,
      ROW_NUMBER() OVER(ORDER BY q.DangKyLuc,q.MaCho) AS ViTri
      FROM HANGDOICHODANGKY q JOIN SINHVIEN s ON s.MaSV=q.MaSV JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung JOIN LOP l ON l.MaLop=s.MaLop
      WHERE q.MaHD=@p1 AND q.TrangThai IN(N'Đang chờ',N'Đã mời') ORDER BY q.DangKyLuc,q.MaCho`,[activityId]);
  }
  async promoteWaitlist(context:SessionContext,activityId:number) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN']);
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      await new sql.Request(tx).input('id',sql.BigInt,activityId).query(`SELECT MaHD FROM HOATDONGHOCTHUAT WITH(UPDLOCK,HOLDLOCK) WHERE MaHD=@id`);
      const candidate=await new sql.Request(tx).input('id',sql.BigInt,activityId).query(`
        SELECT TOP(1) q.MaCho,q.MaSV,q.MaHD,h.SLSVDuKien,
          (SELECT COUNT(*) FROM DKTHAMGIA d WHERE d.MaHD=h.MaHD AND d.TrangThai NOT IN(N'Đã hủy',N'Từ chối')) AS SoLuong,
          CASE WHEN EXISTS(SELECT 1 FROM CUOCTHI c WHERE c.MaHD=h.MaHD) THEN N'Dự thi' ELSE N'Tham gia' END AS HinhThuc
        FROM HANGDOICHODANGKY q WITH(UPDLOCK,READPAST,ROWLOCK) JOIN HOATDONGHOCTHUAT h ON h.MaHD=q.MaHD
        WHERE q.MaHD=@id AND q.TrangThai=N'Đang chờ' ORDER BY q.DangKyLuc,q.MaCho`);
      const item=candidate.recordset[0];
      if(!item){await tx.rollback();throw new NotFoundException('Danh sách chờ đang trống');}
      if(item.SLToiDa && item.SoLuong>=item.SLToiDa){await tx.rollback();throw new BadRequestException('Hoạt động vẫn đủ chỉ tiêu, chưa thể nhận người từ danh sách chờ');}
      const created=await new sql.Request(tx).input('hd',sql.BigInt,activityId).input('sv',sql.BigInt,item.MaSV).input('type',sql.NVarChar(30),item.HinhThuc)
        .query(`INSERT INTO DKTHAMGIA(MaHD,MaSV,NgayDK,HinhThuc,NguonDK,TrangThai) OUTPUT INSERTED.MaDK,INSERTED.NgayDK VALUES(@hd,@sv,SYSDATETIME(),@type,N'Khoa',N'Đã đăng ký')`);
      await new sql.Request(tx).input('id',sql.BigInt,item.MaCho).query(`UPDATE HANGDOICHODANGKY SET TrangThai=N'Đã đăng ký' WHERE MaCho=@id`);
      await new sql.Request(tx).input('sv',sql.BigInt,item.MaSV).input('hd',sql.BigInt,activityId).query(`
        INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
        SELECT t.MaTK,@hd,N'Đăng ký được xác nhận',N'Bạn đã được nhận vào hoạt động',CONCAT(N'Đã có chỗ cho bạn tham gia ',h.TenHoatDong)
        FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung JOIN HOATDONGHOCTHUAT h ON h.MaHD=@hd WHERE s.MaSV=@sv`);
      await tx.commit(); return {...created.recordset[0],maCho:item.MaCho,maSV:item.MaSV,maHD:activityId};
    } catch(error) { try{await tx.rollback();}catch{/* transaction has already rolled back */} throw error; }
  }
  async addSeminarMaterial(context:SessionContext,seminarId:number,dto:SeminarMaterialDto) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN']);
    if(!(await this.db.query(`SELECT 1 AS ok FROM SEMINAR WHERE MaSeminar=@p1`,[seminarId])).length) throw new NotFoundException('Không tìm thấy seminar');
    const rows=await this.db.query(`INSERT INTO TEPSEMINAR(MaSeminar,TenTep,UrlTep,LoaiTep) OUTPUT INSERTED.MaTep,INSERTED.TenTep,INSERTED.UrlTep,INSERTED.LoaiTep VALUES(@p1,@p2,@p3,@p4)`,[seminarId,dto.tenTep,dto.urlTep,dto.loaiTep??null]);
    if(!rows[0]) throw new NotFoundException('Không tìm thấy seminar'); return rows[0];
  }
  async reportSummary(context:SessionContext,from?:string,to?:string) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','PHONG_CTSV','PHONGCTSV']);
    return this.db.query(`SELECT h.MaHD,h.TenHoatDong,h.TgDuKien,h.TrangThai,k.TenKhoa,bm.TenBM,
      (SELECT COUNT(*) FROM DKTHAMGIA d WHERE d.MaHD=h.MaHD AND d.TrangThai NOT IN(N'Đã hủy',N'Từ chối')) SoLuotDangKy,
      (SELECT COUNT(*) FROM DKTHAMGIA d JOIN DIEMDANH dd ON dd.MaDK=d.MaDK WHERE d.MaHD=h.MaHD AND dd.TrangThai IN(N'Đã điểm danh',N'Đã xác nhận')) SoLuotThamDu,
      (SELECT COALESCE(SUM(c.SoTien),0) FROM CHIPHITHUCTE c WHERE c.MaHD=h.MaHD) TongChiPhi
      FROM HOATDONGHOCTHUAT h LEFT JOIN KEHOACHHOCTHUAT p ON p.MaKeHoach=COALESCE(h.MaKeHoachKhoa,h.MaKeHoach) LEFT JOIN KHOA k ON k.MaKhoa=p.MaKhoa LEFT JOIN BOMON bm ON bm.MaBM=h.MaBM
      WHERE (@p1 IS NULL OR TRY_CONVERT(date,h.TgDuKien,23)>=@p1)
        AND (@p2 IS NULL OR TRY_CONVERT(date,h.TgDuKien,23)<DATEADD(DAY,1,@p2)) ORDER BY h.TgDuKien DESC`,[from??null,to??null]);
  }
  async reportTrainingPoints(context:SessionContext,semester?:string,academicYear?:string) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','PHONG_CTSV','PHONGCTSV']);
    return this.db.query(`SELECT d.NamHoc,d.HocKy,k.TenKhoa,bm.TenBM,COUNT(*) AS SoLuotGhiNhan,
      SUM(CASE WHEN d.SoDiem>0 THEN d.SoDiem ELSE 0 END) AS TongDiemCong,
      SUM(CASE WHEN d.SoDiem<0 THEN d.SoDiem ELSE 0 END) AS TongDiemTru,
      SUM(CASE WHEN d.TrangThai=N'Đã xác nhận' THEN d.SoDiem ELSE 0 END) AS TongDiemDaXacNhan
      FROM DIEMRENLUYEN d JOIN SINHVIEN sv ON sv.MaSV=d.MaSV JOIN LOP l ON l.MaLop=sv.MaLop JOIN KHOA k ON k.MaKhoa=l.MaKhoa
      JOIN HOATDONGHOCTHUAT h ON h.MaHD=d.MaHD LEFT JOIN KEHOACHHOCTHUAT p ON p.MaKeHoach=COALESCE(h.MaKeHoachKhoa,h.MaKeHoach) LEFT JOIN BOMON bm ON bm.MaBM=h.MaBM
      WHERE (@p1 IS NULL OR d.HocKy=@p1) AND (@p2 IS NULL OR d.NamHoc=@p2)
      GROUP BY d.NamHoc,d.HocKy,k.TenKhoa,bm.TenBM ORDER BY d.NamHoc DESC,d.HocKy,k.TenKhoa,bm.TenBM`,[semester??null,academicYear??null]);
  }

  // --- QUẢN LÝ HOẠT ĐỘNG HỌC THUẬT & CÁC BAN ---
  async listAcademicActivities(context: SessionContext) {
    const isAcademicCoordinator = this.isAcademicCoordinator(context);
    if (!isAcademicCoordinator) this.require(context, ['ADMIN', 'TRUONGKHOA', 'CANBOKHOA', 'GIANGVIEN', 'PHONGCTSV', 'HIEUTRUONG', 'PHONGKHCN', 'SINHVIEN']);
    const canViewAll = isAcademicCoordinator || context.user.roles.some((role) => ['ADMIN', 'TRUONGKHOA', 'CANBOKHOA', 'PHONGCTSV', 'HIEUTRUONG', 'PHONGKHCN'].includes(key(role)));
    return this.db.query(`
      SELECT
        h.MaHD,
        (SELECT ISNULL(MAX(h2.MaHD), 0) + 1 FROM HOATDONGHOCTHUAT h2) AS MaHDKeTiep,
        h.HocKy,h.NamHoc,h.CapTC,h.TgBatDau,h.TgKetThuc,h.MaKeHoach,h.MaKeHoachKhoa,
        h.MaBM AS MaBM,COALESCE(h.MaBM,ownerGv.MaBM) AS MaBMHienThi,
        COALESCE(activityBm.TenBM,ownerBm.TenBM,bm.TenBM) AS TenBM,
        COALESCE(activityBm.MaKhoa,ownerBm.MaKhoa,bm.MaKhoa,ownerCb.MaKhoa) AS MaKhoa,
        h.TenHoatDong,h.LoaiHoatDong,h.NoiDung,CONVERT(NVARCHAR(225),h.TgDuKien) AS TgDuKien,
        h.DiaDiem,h.TienDoTH,h.DoiTuongThamDu,h.SLSVDuKien,h.TrangThai,
        departmentProposal.TrangThai AS TrangThaiDeXuatBoMon,
        departmentProposal.GhiChuDuyet AS GhiChuDeXuatBoMon,
        departmentPlan.TrangThai AS TrangThaiKeHoachKhoa,
        cost.TrangThai AS TrangThaiDuTru,cost.TongKinhPhi AS KinhPhiDuTru,
        (SELECT COUNT(*) FROM BANCHIDAO bcd WHERE bcd.MaHD=h.MaHD) AS SoThanhVienChiDao,
        (SELECT COUNT(*) FROM BANTOCHUC btc WHERE btc.MaHD=h.MaHD) AS SoThanhVienToChuc,
        (SELECT COUNT(*) FROM BANHOTRO bht WHERE bht.MaHD=h.MaHD) AS SoThanhVienHoTro
      FROM HOATDONGHOCTHUAT h
      LEFT JOIN KEHOACHHOCTHUAT kh ON kh.MaKeHoach=COALESCE(h.MaKeHoachKhoa,h.MaKeHoach)
      LEFT JOIN BOMON activityBm ON activityBm.MaBM=h.MaBM
      LEFT JOIN TAIKHOAN activityOwner ON activityOwner.MaTK=h.NguoiLap
      LEFT JOIN GIANGVIEN ownerGv ON ownerGv.MaNgDung=activityOwner.MaNgDung
      LEFT JOIN BOMON ownerBm ON ownerBm.MaBM=ownerGv.MaBM
      LEFT JOIN CANBOKHOA ownerCb ON ownerCb.MaNgDung=activityOwner.MaNgDung
      LEFT JOIN BOMON bm ON bm.MaBM=h.MaBM
      OUTER APPLY (SELECT TOP (1) d.TrangThai,d.TongKinhPhi FROM DUTRUKINHPHI d WHERE d.MaHD=h.MaHD ORDER BY d.MaDuTruKP DESC) cost
      OUTER APPLY (SELECT TOP (1) p.TrangThai,p.MaKeHoachKhoa,p.GhiChuDuyet FROM KEHOACHCUOCTHIBOMON p WHERE p.MaHD=h.MaHD ORDER BY p.MaDeXuat DESC) departmentProposal
      LEFT JOIN KEHOACHHOCTHUAT departmentPlan ON departmentPlan.MaKeHoach=departmentProposal.MaKeHoachKhoa
      WHERE (@p3 = 1 OR (@p2 = 1 AND h.TrangThai IN (N'Chờ duyệt', N'Đã duyệt', N'Đã công bố')))
         OR h.NguoiLap = CAST(@p1 AS INT)
      ORDER BY h.MaHD DESC
    `, [context.userId, canViewAll ? 1 : 0, isAcademicCoordinator ? 1 : 0]);
  }

  async nextAcademicActivityId(context: SessionContext) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const row = (await this.db.query<{ NextId: number }>('SELECT ISNULL(MAX(MaHD), 0) + 1 AS NextId FROM HOATDONGHOCTHUAT'))[0];
    return { nextId: row?.NextId ?? 1 };
  }

  async createAcademicActivity(context: SessionContext, dto: CreateAcademicActivityDto) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    await this.requireProposalDepartment(context, dto.maBM);
    if (!dto.namHoc?.trim() || !dto.noiDung?.trim()) throw new BadRequestException('Đề xuất phải có năm học và nội dung kế hoạch');
    const tenHoatDong = dto.tenHoatDong.trim();
    const rows = await this.db.query(`
      INSERT INTO HOATDONGHOCTHUAT (
        HocKy, NamHoc, CapTC, TgBatDau, TgKetThuc, MaBM, TenHoatDong, LoaiHoatDong, NoiDung, TgDuKien, DiaDiem, TienDoTH, DoiTuongThamDu, SLSVDuKien, TrangThai, NguoiLap
      )
      OUTPUT INSERTED.*
      VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12, @p13, @p14, N'Dự thảo', @p15)
    `, [
      dto.hocKy?.trim() || null,
      dto.namHoc?.trim() || null,
      dto.capTC === undefined ? 'Cấp Khoa/Liên bộ môn' : dto.capTC.trim() || null,
      dto.tgBatDau?.trim() || null,
      dto.tgKetThuc?.trim() || null,
      dto.maBM ?? null,
      tenHoatDong,
      dto.loaiHoatDong,
      dto.noiDung.trim(),
      dto.tgDuKien ? dto.tgDuKien.trim() : null,
      dto.diaDiem?.trim() || null,
      dto.tienDoTH?.trim() || null,
      dto.doiTuongThamDu.trim(),
      dto.slsvDuKien?.trim() ?? '0',
      context.userId ? parseInt(context.userId, 10) : null
    ]);
    return rows[0];
  }

  async createActivityBudget(context: SessionContext, activityId: number, dto: CreateActivityBudgetDto) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    await this.requireOwnedProposal(context, activityId);
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const activity = (await new sql.Request(transaction).input('activityId', sql.BigInt, activityId)
        .query<{ MaHD: number; TrangThai: string; NguoiLap: number }>('SELECT MaHD,TrangThai,NguoiLap FROM HOATDONGHOCTHUAT WITH (UPDLOCK, ROWLOCK) WHERE MaHD=@activityId')).recordset[0];
      if (!activity) throw new NotFoundException('Không tìm thấy hoạt động học thuật');
      if (String(activity.NguoiLap) !== String(context.userId)) throw new ForbiddenException('Chỉ người lập được sửa bản chi phí');
      if (!['Dự thảo','Từ chối'].includes(activity.TrangThai)) throw new BadRequestException('Không sửa chi phí khi đề xuất đã gửi hoặc đã được ký duyệt');

      const blocked = (await new sql.Request(transaction).input('activityId', sql.BigInt, activityId)
        .query(`SELECT TOP (1) MaDuTruKP FROM DUTRUKINHPHI WITH (UPDLOCK, HOLDLOCK)
          WHERE MaHD=@activityId AND TrangThai IN (N'Chờ duyệt',N'Đã duyệt')`)).recordset[0];
      if (blocked) throw new BadRequestException('Hoạt động đã gửi hoặc được duyệt; không thể sửa kinh phí.');

      const proposal = (await new sql.Request(transaction).input('activityId', sql.BigInt, activityId)
        .query<{ MaDuTruKP: number; TrangThai: string }>(`SELECT TOP (1) MaDuTruKP,TrangThai FROM DUTRUKINHPHI WITH (UPDLOCK, HOLDLOCK)
          WHERE MaHD=@activityId ORDER BY MaDuTruKP DESC`)).recordset[0];
      if (proposal?.TrangThai === 'Từ chối') {
        await new sql.Request(transaction).input('proposalId', sql.BigInt, proposal.MaDuTruKP)
          .query(`UPDATE DUTRUKINHPHI SET TrangThai=N'Dự thảo',NguoiDuyet=NULL,NgayDuyet=NULL,GhiChuDuyet=NULL WHERE MaDuTruKP=@proposalId`);
        await new sql.Request(transaction).input('proposalId', sql.BigInt, proposal.MaDuTruKP)
          .query(`UPDATE KINHPHIHOATDONG SET TrangThai=N'Dự thảo' WHERE MaDuTruKP=@proposalId`);
      }

      const inserted = await new sql.Request(transaction)
        .input('proposalId', sql.BigInt, proposal?.MaDuTruKP ?? null)
        .input('activityId', sql.BigInt, activityId)
        .input('description', sql.NVarChar(sql.MAX), dto.noiDung.trim())
        .input('quantity', sql.Decimal(10, 2), dto.soLuong ?? null)
        .input('unit', sql.NVarChar(50), dto.donViTinh?.trim() || null)
        .input('unitPrice', sql.Decimal(18, 2), dto.donGia ?? null)
        .input('amount', sql.Decimal(18, 2), dto.soTien)
        .input('explanation', sql.NVarChar(500), dto.thuyetMinh?.trim() || null)
        .input('source', sql.NVarChar(100), dto.nguonKinhPhi?.trim() || 'Kinh phí học thuật')
        .input('note', sql.NVarChar(500), dto.ghiChu?.trim() || null)
        .query(`INSERT INTO KINHPHIHOATDONG (MaDuTruKP,MaHD,NoiDung,SoLuong,DonViTinh,DonGia,SoTien,ThuyetMinh,NguonKinhPhi,GhiChu)
          OUTPUT INSERTED.* VALUES (@proposalId,@activityId,@description,@quantity,@unit,@unitPrice,@amount,@explanation,@source,@note)`);

      await this.refreshActivityBudgetSummary(activityId, transaction);
      if (proposal) {
        await new sql.Request(transaction).input('proposalId', sql.BigInt, proposal.MaDuTruKP)
          .query(`UPDATE DUTRUKINHPHI SET TongKinhPhi=(SELECT COALESCE(SUM(SoTien),0) FROM KINHPHIHOATDONG WHERE MaDuTruKP=@proposalId)
            WHERE MaDuTruKP=@proposalId`);
      }
      await new sql.Request(transaction).input('activityId', sql.BigInt, activityId)
        .query(`UPDATE HOATDONGHOCTHUAT SET KinhPhiDuTru=(SELECT COALESCE(SUM(SoTien),0) FROM KINHPHIHOATDONG WHERE MaHD=@activityId)
          WHERE MaHD=@activityId`);
      await transaction.commit();
      return inserted.recordset[0];
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async listActivityBudgets(context: SessionContext, includeAll = false) {
    const isAcademicCoordinator = this.isAcademicCoordinator(context);
    if (!isAcademicCoordinator) this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN', 'TRUONGKHOA', 'PHONGCTSV', 'PHONGKHCN', 'HIEUTRUONG']);
    const canViewAll = isAcademicCoordinator
      || (includeAll && isAcademicCoordinator)
      || context.user.roles.some((role) => ['ADMIN', 'TRUONGKHOA', 'CANBOKHOA', 'PHONGCTSV', 'HIEUTRUONG', 'PHONGKHCN'].includes(key(role)));
    return this.db.query(`
      SELECT k.*, h.NguoiLap AS NguoiLapHoatDong, h.TenHoatDong, h.LoaiHoatDong, h.TrangThai AS TrangThaiHoatDong, h.MaKeHoachKhoa,
             departmentProposal.TrangThai AS TrangThaiDeXuatBoMon,
             h.SLSVDuKien AS SLSVDuKienHoatDong,
             TRY_CONVERT(INT,NULLIF(h.SLSVDuKien,N'')) AS SLSinhVienHoatDong,
             d.MaDuTruKP AS MaHoSoDuTru, d.MaHD AS MaHoatDongDuTru,
             d.TenTieuDe, COALESCE(d.NamHoc,h.NamHoc,N'Chưa xác định') AS NamHoc,
             d.TongKinhPhi, CASE WHEN h.TrangThai IN(N'Đã duyệt',N'Đã công bố') THEN N'Đã duyệt' ELSE COALESCE(d.TrangThai,k.TrangThai) END AS TrangThaiDuTru, d.GhiChuDuyet,
             d.NguoiDuyet, d.NgayDuyet, kh.TrangThai AS TrangThaiKeHoachKhoa
      FROM KINHPHIHOATDONG k
      JOIN HOATDONGHOCTHUAT h ON h.MaHD = k.MaHD
      LEFT JOIN DUTRUKINHPHI d ON d.MaDuTruKP = k.MaDuTruKP
      LEFT JOIN KEHOACHHOCTHUAT kh ON kh.MaKeHoach=h.MaKeHoachKhoa
      OUTER APPLY (SELECT TOP (1) p.TrangThai FROM KEHOACHCUOCTHIBOMON p WHERE p.MaHD=h.MaHD ORDER BY p.MaDeXuat DESC) departmentProposal
      WHERE (@p1 = 1 OR h.NguoiLap = CAST(@p2 AS INT))
      ORDER BY COALESCE(d.NamHoc,h.NamHoc) DESC,h.TenHoatDong,k.MaKPHD
    `, [canViewAll ? 1 : 0, context.userId]);
  }

  private requireBudgetEstimateCreator(context: SessionContext) {
    if (this.isAcademicCoordinator(context)) return;
    this.require(context, ['ADMIN', 'CANBOKHOA']);
  }

  private requireBudgetEstimateReader(context: SessionContext) {
    const allowed = this.isAcademicCoordinator(context)
      || context.user.roles.some((role) => ['ADMIN', 'TRUONGKHOA', 'CANBOKHOA', 'GIANGVIEN'].includes(key(role)));
    if (!allowed) throw new ForbiddenException('Bạn không có quyền xem dự trù kinh phí');
  }

  async listBudgetEstimates(context: SessionContext) {
    this.requireBudgetEstimateReader(context);
    return this.db.query(`
      SELECT d.MaDuTruKP,d.TenTieuDe,d.NamHoc,d.NgayLap,d.NguoiLap,d.NguoiDuyet,d.NgayDuyet,d.TrangThai,d.TongKinhPhi,d.GhiChuDuyet,
        COUNT(DISTINCT link.MaKPHD) AS SoKhoan,COUNT(DISTINCT line.MaHD) AS SoHoatDong
      FROM DUTRUKINHPHI d
      JOIN DUTRUKINHPHI_HOATDONG link ON link.MaDuTruKP=d.MaDuTruKP
      JOIN KINHPHIHOATDONG line ON line.MaKPHD=link.MaKPHD
      GROUP BY d.MaDuTruKP,d.TenTieuDe,d.NamHoc,d.NgayLap,d.NguoiLap,d.NguoiDuyet,d.NgayDuyet,d.TrangThai,d.TongKinhPhi,d.GhiChuDuyet
      ORDER BY d.NamHoc DESC,d.NgayLap DESC,d.MaDuTruKP DESC
    `);
  }

  async nextBudgetEstimateId(context: SessionContext) {
    this.requireBudgetEstimateReader(context);
    const row = (await this.db.query<{ NextId: number }>(`SELECT ISNULL(MAX(MaDuTruKP),0)+1 AS NextId FROM DUTRUKINHPHI`))[0];
    return { nextId: row?.NextId ?? 1 };
  }

  async getBudgetEstimate(context: SessionContext, estimateId: number) {
    this.requireBudgetEstimateReader(context);
    const header = (await this.db.query(`
      SELECT d.MaDuTruKP,d.TenTieuDe,d.NamHoc,d.NgayLap,d.NguoiLap,d.NguoiDuyet,d.NgayDuyet,d.TrangThai,d.TongKinhPhi,d.GhiChuDuyet
      FROM DUTRUKINHPHI d WHERE d.MaDuTruKP=@p1
        AND EXISTS(SELECT 1 FROM DUTRUKINHPHI_HOATDONG x WHERE x.MaDuTruKP=d.MaDuTruKP)
    `, [estimateId]))[0];
    if (!header) throw new NotFoundException('Không tìm thấy hồ sơ dự trù tổng hợp');
    const lines = await this.db.query(`
      SELECT line.*,h.TenHoatDong,h.LoaiHoatDong,h.NamHoc AS NamHocHoatDong,h.SLSVDuKien AS SLSVDuKienHoatDong
      FROM DUTRUKINHPHI_HOATDONG link
      JOIN KINHPHIHOATDONG line ON line.MaKPHD=link.MaKPHD
      JOIN HOATDONGHOCTHUAT h ON h.MaHD=line.MaHD
      WHERE link.MaDuTruKP=@p1 ORDER BY h.MaHD,line.MaKPHD
    `, [estimateId]);
    return { header, lines };
  }

  async createBudgetEstimate(context: SessionContext, dto: CreateBudgetEstimateDto) {
    this.requireBudgetEstimateCreator(context);
    const year = dto.namHoc.trim();
    const title = dto.tenTieuDe.trim();
    const createdAt = dto.ngayLap ? new Date(`${dto.ngayLap}T00:00:00.000Z`) : new Date();
    if (!year || !title) throw new BadRequestException('Cần nhập tên hồ sơ và năm học');
    const tx = new sql.Transaction(this.db.pool);
    await tx.begin();
    try {
      const existing = (await new sql.Request(tx).input('year', sql.NVarChar(20), year)
        .query(`SELECT TOP(1) d.MaDuTruKP FROM DUTRUKINHPHI d WITH(UPDLOCK,HOLDLOCK)
          JOIN DUTRUKINHPHI_HOATDONG link ON link.MaDuTruKP=d.MaDuTruKP
          WHERE d.NamHoc=@year AND d.TrangThai IN(N'Dự thảo',N'Chờ duyệt',N'Cần bổ sung',N'Đã duyệt',N'Từ chối')`)).recordset[0];
      if (existing) throw new ConflictException(`Năm học ${year} đã có hồ sơ dự trù tổng hợp. Hãy mở hồ sơ đó để gửi hoặc xem trạng thái.`);
      const eligible = (await new sql.Request(tx).input('year', sql.NVarChar(20), year)
        .query<{ SoKhoan: number; TongKinhPhi: number }>(`
          SELECT COUNT(*) AS SoKhoan,COALESCE(SUM(line.SoTien),0) AS TongKinhPhi
          FROM KINHPHIHOATDONG line WITH(UPDLOCK,HOLDLOCK)
          JOIN HOATDONGHOCTHUAT h ON h.MaHD=line.MaHD
          OUTER APPLY (SELECT TOP (1) p.TrangThai FROM KEHOACHCUOCTHIBOMON p WHERE p.MaHD=h.MaHD ORDER BY p.MaDeXuat DESC) departmentProposal
          WHERE h.NamHoc=@year
            AND h.TrangThai IN(N'Chờ duyệt',N'Đã duyệt',N'Đã công bố')
            AND (departmentProposal.TrangThai IN(N'Chờ khoa',N'Đã duyệt')
              OR (departmentProposal.TrangThai IS NULL AND h.TrangThai IN(N'Đã duyệt',N'Đã công bố')))
            AND NOT EXISTS(SELECT 1 FROM DUTRUKINHPHI_HOATDONG link WHERE link.MaKPHD=line.MaKPHD)
        `)).recordset[0];
      if (!eligible?.SoKhoan) throw new BadRequestException(`Năm học ${year} chưa có kinh phí nào được chuyển từ Ban bộ môn hoặc hoạt động nào đã được duyệt để tổng hợp`);
      const header = (await new sql.Request(tx)
        .input('title', sql.NVarChar(250), title).input('year', sql.NVarChar(20), year)
        .input('createdAt', sql.DateTimeOffset(7), createdAt)
        .input('total', sql.Decimal(18, 2), eligible.TongKinhPhi).input('owner', sql.BigInt, Number(context.userId))
        .query<{ MaDuTruKP: number }>(`INSERT INTO DUTRUKINHPHI(MaHD,TenTieuDe,NamHoc,NgayLap,TongKinhPhi,NguoiLap,TrangThai)
          OUTPUT INSERTED.MaDuTruKP VALUES(NULL,@title,@year,@createdAt,@total,@owner,N'Dự thảo')`)).recordset[0];
      await new sql.Request(tx).input('estimateId', sql.BigInt, header.MaDuTruKP).input('year', sql.NVarChar(20), year)
        .query(`INSERT INTO DUTRUKINHPHI_HOATDONG(MaDuTruKP,MaKPHD)
          SELECT @estimateId,line.MaKPHD
          FROM KINHPHIHOATDONG line
          JOIN HOATDONGHOCTHUAT h ON h.MaHD=line.MaHD
          OUTER APPLY (SELECT TOP (1) p.TrangThai FROM KEHOACHCUOCTHIBOMON p WHERE p.MaHD=h.MaHD ORDER BY p.MaDeXuat DESC) departmentProposal
          WHERE h.NamHoc=@year
            AND h.TrangThai IN(N'Chờ duyệt',N'Đã duyệt',N'Đã công bố')
            AND (departmentProposal.TrangThai IN(N'Chờ khoa',N'Đã duyệt')
              OR (departmentProposal.TrangThai IS NULL AND h.TrangThai IN(N'Đã duyệt',N'Đã công bố')))
            AND NOT EXISTS(SELECT 1 FROM DUTRUKINHPHI_HOATDONG link WHERE link.MaKPHD=line.MaKPHD)`);
      await tx.commit();
      return { success: true, maDuTruKP: header.MaDuTruKP, soKhoan: eligible.SoKhoan, tongKinhPhi: eligible.TongKinhPhi };
    } catch (error) { await tx.rollback().catch(() => undefined); throw error; }
  }

  async submitBudgetEstimate(context: SessionContext, estimateId: number) {
    this.requireBudgetEstimateCreator(context);
    const rows = await this.db.query(`UPDATE d SET TrangThai=N'Chờ duyệt',NguoiDuyet=NULL,NgayDuyet=NULL,GhiChuDuyet=NULL
      OUTPUT INSERTED.MaDuTruKP,INSERTED.TenTieuDe,INSERTED.NamHoc,INSERTED.TrangThai
      FROM DUTRUKINHPHI d WHERE d.MaDuTruKP=@p1 AND d.MaHD IS NULL
        AND d.TrangThai IN(N'Dự thảo',N'Cần bổ sung',N'Từ chối')
        AND EXISTS(SELECT 1 FROM DUTRUKINHPHI_HOATDONG link WHERE link.MaDuTruKP=d.MaDuTruKP)`, [estimateId]);
    if (!rows[0]) throw new BadRequestException('Chỉ hồ sơ dự trù tổng hợp ở trạng thái nháp, cần bổ sung hoặc từ chối mới được gửi');
    return rows[0];
  }

  async reviewBudgetEstimate(context: SessionContext, estimateId: number, dto: ReviewActivityBudgetDto) {
    await this.requireFacultySigner(context);
    const status = dto.action === 'approve' ? 'Đã duyệt' : dto.action === 'request_changes' ? 'Cần bổ sung' : 'Từ chối';
    const rows = await this.db.query(`UPDATE d SET TrangThai=@p1,NguoiDuyet=@p2,NgayDuyet=SYSDATETIME(),GhiChuDuyet=@p3
      OUTPUT INSERTED.MaDuTruKP,INSERTED.TenTieuDe,INSERTED.NamHoc,INSERTED.TongKinhPhi,INSERTED.TrangThai,INSERTED.NguoiLap,INSERTED.NguoiDuyet,INSERTED.NgayDuyet,INSERTED.GhiChuDuyet
      FROM DUTRUKINHPHI d WHERE d.MaDuTruKP=@p4 AND d.MaHD IS NULL AND d.TrangThai=N'Chờ duyệt'
        AND EXISTS(SELECT 1 FROM DUTRUKINHPHI_HOATDONG link WHERE link.MaDuTruKP=d.MaDuTruKP)`,
      [status, context.userId, dto.ghiChu?.trim() || null, estimateId]);
    if (!rows[0]) throw new NotFoundException('Không tìm thấy hồ sơ dự trù tổng hợp đang chờ duyệt');
    await this.db.query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
      VALUES(@p1,NULL,N'Dự trù kinh phí',@p2,@p3)`, [rows[0].NguoiLap, `Hồ sơ dự trù ${status.toLowerCase()}`, dto.ghiChu?.trim() || `Hồ sơ “${rows[0].TenTieuDe}” đã được ${status.toLowerCase()}.`]);
    return rows[0];
  }

  async updateActivityBudgetLine(context: SessionContext, lineId: number, dto: CreateActivityBudgetDto) {
    this.require(context, ['ADMIN','CANBOKHOA','GIANGVIEN']);
    const line = (await this.db.query<{MaHD:number;MaDuTruKP:number|null;NguoiLap:number;ActivityStatus:string;BudgetStatus:string|null}>(`
      SELECT k.MaHD,k.MaDuTruKP,h.NguoiLap,h.TrangThai AS ActivityStatus,d.TrangThai AS BudgetStatus
      FROM KINHPHIHOATDONG k JOIN HOATDONGHOCTHUAT h ON h.MaHD=k.MaHD
      LEFT JOIN DUTRUKINHPHI d ON d.MaDuTruKP=k.MaDuTruKP WHERE k.MaKPHD=@p1`, [lineId]))[0];
    if (!line) throw new NotFoundException('Không tìm thấy khoản dự trù');
    if (String(line.NguoiLap)!==String(context.userId)) throw new ForbiddenException('Chỉ người lập hoạt động được sửa khoản dự trù');
    if (!['Dự thảo','Từ chối'].includes(line.ActivityStatus) || (line.BudgetStatus && !['Dự thảo','Từ chối','Cần bổ sung'].includes(line.BudgetStatus))) throw new BadRequestException('Không sửa chi phí khi đề xuất đã gửi hoặc đã được ký duyệt');
    await this.db.query(`UPDATE KINHPHIHOATDONG SET NoiDung=@p1,SoLuong=@p2,DonViTinh=@p3,DonGia=@p4,SoTien=@p5,ThuyetMinh=@p6,NguonKinhPhi=@p7,GhiChu=@p8,TrangThai=N'Dự thảo' WHERE MaKPHD=@p9`, [dto.noiDung.trim(),dto.soLuong??null,dto.donViTinh?.trim()||null,dto.donGia??null,dto.soTien,dto.thuyetMinh?.trim()||null,dto.nguonKinhPhi?.trim()||'Kinh phí học thuật',dto.ghiChu?.trim()||null,lineId]);
    await this.refreshActivityBudgetSummary(line.MaHD);
    if (line.MaDuTruKP) await this.db.query(`UPDATE DUTRUKINHPHI SET TrangThai=N'Dự thảo',NguoiDuyet=NULL,NgayDuyet=NULL,GhiChuDuyet=NULL,TongKinhPhi=(SELECT COALESCE(SUM(SoTien),0) FROM KINHPHIHOATDONG WHERE MaDuTruKP=@p1) WHERE MaDuTruKP=@p1`, [line.MaDuTruKP]);
    await this.db.query(`UPDATE HOATDONGHOCTHUAT SET KinhPhiDuTru=(SELECT COALESCE(SUM(SoTien),0) FROM KINHPHIHOATDONG WHERE MaHD=@p1) WHERE MaHD=@p1`, [line.MaHD]);
    return {updated:true,maKPHD:lineId};
  }

  async deleteActivityBudgetLine(context: SessionContext, lineId: number) {
    this.require(context, ['ADMIN','CANBOKHOA','GIANGVIEN']);
    const line = (await this.db.query<{MaHD:number;MaDuTruKP:number|null;NguoiLap:number;ActivityStatus:string;BudgetStatus:string|null}>(`
      SELECT k.MaHD,k.MaDuTruKP,h.NguoiLap,h.TrangThai AS ActivityStatus,d.TrangThai AS BudgetStatus
      FROM KINHPHIHOATDONG k JOIN HOATDONGHOCTHUAT h ON h.MaHD=k.MaHD
      LEFT JOIN DUTRUKINHPHI d ON d.MaDuTruKP=k.MaDuTruKP WHERE k.MaKPHD=@p1`, [lineId]))[0];
    if (!line) throw new NotFoundException('Không tìm thấy khoản dự trù');
    if (String(line.NguoiLap) !== String(context.userId)) throw new ForbiddenException('Chỉ người lập hoạt động được xóa khoản dự trù');
    if (!['Dự thảo','Từ chối'].includes(line.ActivityStatus) || (line.BudgetStatus && !['Dự thảo','Từ chối','Cần bổ sung'].includes(line.BudgetStatus))) {
      throw new BadRequestException('Không xóa chi phí khi đề xuất đã gửi hoặc đã được ký duyệt');
    }

    await this.db.query('DELETE FROM KINHPHIHOATDONG WHERE MaKPHD=@p1', [lineId]);
    await this.refreshActivityBudgetSummary(line.MaHD);
    if (line.MaDuTruKP) {
      await this.db.query(`UPDATE DUTRUKINHPHI SET TrangThai=N'Dự thảo',NguoiDuyet=NULL,NgayDuyet=NULL,GhiChuDuyet=NULL,
        TongKinhPhi=(SELECT COALESCE(SUM(SoTien),0) FROM KINHPHIHOATDONG WHERE MaDuTruKP=@p1) WHERE MaDuTruKP=@p1`, [line.MaDuTruKP]);
    }
    await this.db.query(`UPDATE HOATDONGHOCTHUAT SET KinhPhiDuTru=(SELECT COALESCE(SUM(SoTien),0) FROM KINHPHIHOATDONG WHERE MaHD=@p1)
      WHERE MaHD=@p1`, [line.MaHD]);
    return {deleted:true,maKPHD:lineId};
  }

  async deleteActivityBudget(context: SessionContext, proposalId: number) {
    this.require(context, ['ADMIN','CANBOKHOA','GIANGVIEN']);
    const proposal = (await this.db.query<{MaHD:number;NguoiLap:number;ActivityStatus:string;BudgetStatus:string}>(`SELECT d.MaHD,h.NguoiLap,h.TrangThai AS ActivityStatus,d.TrangThai AS BudgetStatus FROM DUTRUKINHPHI d JOIN HOATDONGHOCTHUAT h ON h.MaHD=d.MaHD WHERE d.MaDuTruKP=@p1`,[proposalId]))[0];
    if (!proposal) throw new NotFoundException('Không tìm thấy hồ sơ dự trù');
    if (String(proposal.NguoiLap)!==String(context.userId)) throw new ForbiddenException('Chỉ người lập hoạt động được xóa hồ sơ dự trù');
    if (!['Dự thảo','Từ chối'].includes(proposal.ActivityStatus) || !['Dự thảo','Từ chối'].includes(proposal.BudgetStatus)) throw new BadRequestException('Chỉ được xóa dự trù còn ở trạng thái dự thảo hoặc bị từ chối');
    await this.db.query('DELETE FROM DUTRUKINHPHI WHERE MaDuTruKP=@p1',[proposalId]);
    await this.db.query(`UPDATE HOATDONGHOCTHUAT SET KinhPhiDuTru=(SELECT COALESCE(SUM(SoTien),0) FROM KINHPHIHOATDONG WHERE MaHD=@p1) WHERE MaHD=@p1`,[proposal.MaHD]);
    return {deleted:true,maDuTruKP:proposalId};
  }

  private async submitProposalPackage(context: SessionContext, activityId: number) {
    this.require(context,['ADMIN','CANBOKHOA','GIANGVIEN']);
    const owned=await this.requireOwnedProposal(context,activityId);
    if(!owned.NamHoc?.trim() || !owned.NoiDung?.trim() || !owned.TenHoatDong?.trim()) throw new BadRequestException('Đề xuất cần năm học, tên hoạt động và nội dung kế hoạch trước khi gửi');
    if(!['Dự thảo','Từ chối'].includes(owned.TrangThai)) throw new BadRequestException('Đề xuất không còn ở trạng thái được gửi');
    const tx=new sql.Transaction(this.db.pool);await tx.begin();
    try {
      const activity=(await new sql.Request(tx).input('activityId',sql.BigInt,activityId)
        .query<AnnualProposal>(`SELECT MaHD,NguoiLap,MaBM,NamHoc,TenHoatDong,NoiDung,TrangThai FROM HOATDONGHOCTHUAT WITH(UPDLOCK,HOLDLOCK) WHERE MaHD=@activityId`)).recordset[0];
      if(!activity || String(activity.NguoiLap)!==String(context.userId)) throw new ForbiddenException('Đề xuất không thuộc người gửi');
      if(!['Dự thảo','Từ chối'].includes(activity.TrangThai)) throw new ConflictException('Đề xuất vừa được gửi hoặc ký duyệt');
      const departmentId=activity.MaBM ?? await this.resolveDefaultProposalDepartment(activity.NguoiLap);
      if(!activity.NamHoc?.trim() || !activity.NoiDung?.trim() || !departmentId) throw new BadRequestException('Kế hoạch cần có năm học, nội dung và người lập thuộc bộ môn để chuyển Ban bộ môn xem xét');
      await this.requireProposalDepartment(context, departmentId);
      let proposal=(await new sql.Request(tx).input('activityId',sql.BigInt,activityId)
        .query<{MaDuTruKP:number;TrangThai:string}>(`SELECT TOP (1) MaDuTruKP,TrangThai FROM DUTRUKINHPHI WITH(UPDLOCK,HOLDLOCK) WHERE MaHD=@activityId ORDER BY MaDuTruKP DESC`)).recordset[0];
      const totals=(await new sql.Request(tx).input('activityId',sql.BigInt,activityId).input('proposalId',sql.BigInt,proposal?.MaDuTruKP??null)
        .query<{SoDong:number;TongKinhPhi:number}>(`SELECT COUNT(*) AS SoDong,COALESCE(SUM(SoTien),0) AS TongKinhPhi FROM KINHPHIHOATDONG WITH(UPDLOCK,HOLDLOCK)
          WHERE MaHD=@activityId AND (MaDuTruKP=@proposalId OR MaDuTruKP IS NULL)`)).recordset[0];
      if(!totals?.SoDong) throw new BadRequestException('Mỗi cuộc thi/seminar phải có một bản chi phí với ít nhất một khoản dự trù trước khi gửi khoa');
      await new sql.Request(tx).input('activityId',sql.Int,activityId).input('department',sql.Int,departmentId)
        .input('year',sql.NVarChar(20),activity.NamHoc).input('title',sql.NVarChar(200),activity.TenHoatDong)
        .input('content',sql.NVarChar(sql.MAX),activity.NoiDung).input('total',sql.Decimal(18,2),totals.TongKinhPhi).input('account',sql.BigInt,context.userId)
        .query(`IF EXISTS(SELECT 1 FROM KEHOACHCUOCTHIBOMON WHERE MaHD=@activityId)
          UPDATE KEHOACHCUOCTHIBOMON SET MaBM=@department,NamHoc=@year,TenCuocThi=@title,NoiDung=@content,DuTruKinhPhi=@total,NguoiLap=@account,TrangThai=N'Chờ Trưởng bộ môn',GhiChuDuyet=NULL,NgayCapNhat=SYSDATETIMEOFFSET() WHERE MaHD=@activityId
          ELSE INSERT INTO KEHOACHCUOCTHIBOMON(MaBM,NamHoc,TenCuocThi,NoiDung,DuTruKinhPhi,NguoiLap,TrangThai,MaHD) VALUES(@department,@year,@title,@content,@total,@account,N'Chờ Trưởng bộ môn',@activityId)`);
      if(proposal?.TrangThai==='Đã duyệt') throw new BadRequestException('Bản chi phí đã ký không thể ghép với đề xuất chưa ký; hãy liên hệ khoa kiểm tra hồ sơ');
      if(!proposal) {
        proposal=(await new sql.Request(tx).input('activityId',sql.BigInt,activityId).input('title',sql.NVarChar(250),'Bản chi phí: '+activity.TenHoatDong)
          .input('year',sql.NVarChar(20),activity.NamHoc).input('total',sql.Decimal(18,2),totals.TongKinhPhi).input('account',sql.BigInt,context.userId)
          .query<{MaDuTruKP:number;TrangThai:string}>(`INSERT INTO DUTRUKINHPHI(MaHD,TenTieuDe,NamHoc,TongKinhPhi,NguoiLap,TrangThai)
            OUTPUT INSERTED.MaDuTruKP,INSERTED.TrangThai VALUES(@activityId,@title,@year,@total,@account,N'Dự thảo')`)).recordset[0];
      }
      await new sql.Request(tx).input('activityId',sql.BigInt,activityId).input('proposalId',sql.BigInt,proposal.MaDuTruKP)
        .query(`UPDATE KINHPHIHOATDONG SET MaDuTruKP=@proposalId WHERE MaHD=@activityId AND MaDuTruKP IS NULL`);
      const submitted=await new sql.Request(tx).input('proposalId',sql.BigInt,proposal.MaDuTruKP).input('total',sql.Decimal(18,2),totals.TongKinhPhi)
        .query(`UPDATE DUTRUKINHPHI SET TrangThai=N'Chờ duyệt',TongKinhPhi=@total,NguoiDuyet=NULL,NgayDuyet=NULL,GhiChuDuyet=NULL
          OUTPUT INSERTED.MaDuTruKP,INSERTED.MaHD,INSERTED.TrangThai WHERE MaDuTruKP=@proposalId AND TrangThai IN(N'Dự thảo',N'Từ chối',N'Cần bổ sung',N'Chờ duyệt')`);
      if(!submitted.recordset[0]) throw new ConflictException('Bản chi phí vừa thay đổi');
      await new sql.Request(tx).input('proposalId',sql.BigInt,proposal.MaDuTruKP)
        .query(`UPDATE KINHPHIHOATDONG SET TrangThai=N'Chờ duyệt' WHERE MaDuTruKP=@proposalId`);
      const event=JSON.stringify({action:'submit',userId:context.userId,at:new Date().toISOString(),maDuTruKP:proposal.MaDuTruKP});
      const rows=await new sql.Request(tx).input('activityId',sql.BigInt,activityId).input('account',sql.BigInt,context.userId)
        .input('total',sql.Decimal(18,2),totals.TongKinhPhi).input('event',sql.NVarChar(sql.MAX),event)
        .query(`UPDATE HOATDONGHOCTHUAT SET TrangThai=N'Chờ Trưởng bộ môn',KinhPhiDuTru=@total,NguoiDuyetDeXuat=NULL,NgayDuyetDeXuat=NULL,
          LichSuDuyetDeXuat=JSON_MODIFY(COALESCE(LichSuDuyetDeXuat,N'[]'),'append $',JSON_QUERY(@event))
          OUTPUT INSERTED.MaHD,INSERTED.TrangThai WHERE MaHD=@activityId AND NguoiLap=@account AND TrangThai IN(N'Dự thảo',N'Từ chối')`);
      if(!rows.recordset[0]) throw new ConflictException('Đề xuất vừa thay đổi');
      await tx.commit();
      return {success:true,message:'Đã gửi hoạt động và bản chi phí sang Ban bộ môn xem xét',activity:rows.recordset[0],duTru:submitted.recordset[0]};
    } catch(error) {await tx.rollback().catch(()=>undefined);throw error;}
  }
  async submitActivityBudget(context: SessionContext, activityId: number) {
    const result=await this.submitProposalPackage(context,activityId);
    return {...result.duTru,activity:result.activity,message:result.message};
  }
  async reviewActivityBudget(context: SessionContext, proposalId: number, dto: ReviewActivityBudgetDto) {
    this.require(context, ['ADMIN', 'TRUONGKHOA']);
    const stage = (await this.db.query<{ MaKeHoachKhoa:number|null; TrangThaiDeXuat:string|null; TrangThaiKeHoach:string|null }>(`
      SELECT h.MaKeHoachKhoa,p.TrangThai AS TrangThaiDeXuat,kh.TrangThai AS TrangThaiKeHoach
      FROM DUTRUKINHPHI d JOIN HOATDONGHOCTHUAT h ON h.MaHD=d.MaHD
      LEFT JOIN KEHOACHCUOCTHIBOMON p ON p.MaHD=h.MaHD
      LEFT JOIN KEHOACHHOCTHUAT kh ON kh.MaKeHoach=h.MaKeHoachKhoa
      WHERE d.MaDuTruKP=@p1`,[proposalId]))[0];
    if (!stage || !stage.MaKeHoachKhoa || stage.TrangThaiDeXuat!=='Đã duyệt' || stage.TrangThaiKeHoach!=='Chờ Trưởng khoa ký duyệt') {
      throw new BadRequestException('Dự trù chỉ được Trưởng khoa duyệt sau khi Trưởng ban học thuật tổng hợp và trình kế hoạch chung');
    }
    const nextStatus = dto.action === 'approve' ? 'Đã duyệt' : dto.action === 'request_changes' ? 'Cần bổ sung' : 'Từ chối';
    const rows = await this.db.query(`UPDATE DUTRUKINHPHI
      SET TrangThai=@p1,NguoiDuyet=@p2,NgayDuyet=SYSDATETIME(),GhiChuDuyet=@p3
      OUTPUT INSERTED.MaDuTruKP,INSERTED.MaHD,INSERTED.TenTieuDe,INSERTED.NamHoc,INSERTED.TongKinhPhi,
        INSERTED.TrangThai,INSERTED.NguoiDuyet,INSERTED.NgayDuyet,INSERTED.GhiChuDuyet
      WHERE MaDuTruKP=@p4 AND TrangThai=N'Chờ duyệt'`, [nextStatus, context.userId, dto.ghiChu?.trim() || null, proposalId]);
    if (!rows[0]) throw new NotFoundException('Không tìm thấy dự trù đang chờ khoa duyệt');
    await this.db.query(`UPDATE KINHPHIHOATDONG SET TrangThai=@p1 WHERE MaDuTruKP=@p2`, [nextStatus, proposalId]);
    const owner = (await this.db.query<{ MaTK: number; MaHD: number }>(`SELECT h.NguoiLap AS MaTK,h.MaHD FROM DUTRUKINHPHI d JOIN HOATDONGHOCTHUAT h ON h.MaHD=d.MaHD WHERE d.MaDuTruKP=@p1`, [proposalId]))[0];
    if (owner && dto.ghiChu?.trim()) await this.db.query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung) VALUES(@p1,@p2,N'Kinh phí hoạt động',@p3,@p4)`, [owner.MaTK, owner.MaHD, 'Kinh phí cần bổ sung', dto.ghiChu.trim()]);
    return rows[0];
  }

  async updateAcademicActivity(context: SessionContext, id: number, dto: UpdateAcademicActivityDto) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const act = (await this.db.query<{ MaHD: number }>(`SELECT MaHD FROM HOATDONGHOCTHUAT WHERE MaHD = @p1 AND NguoiLap = @p2`, [id, context.userId]))[0];
    if (!act) throw new NotFoundException('Không tìm thấy hoạt động học thuật');

    await this.db.query(`
      UPDATE HOATDONGHOCTHUAT
      SET 
        HocKy = COALESCE(@p1, HocKy),
        NamHoc = COALESCE(@p2, NamHoc),
        CapTC = CASE WHEN @p3 IS NULL THEN CapTC ELSE NULLIF(@p3,N'') END,
        TgBatDau = COALESCE(@p4, TgBatDau),
        TgKetThuc = COALESCE(@p5, TgKetThuc),
        MaBM = CASE WHEN @p6=-1 THEN MaBM ELSE @p6 END,
        TenHoatDong = COALESCE(@p7, TenHoatDong),
        LoaiHoatDong = COALESCE(@p8, LoaiHoatDong),
        NoiDung = COALESCE(@p9, NoiDung),
        TgDuKien = COALESCE(@p10, TgDuKien),
        DiaDiem = @p11,
        TienDoTH = @p12,
        DoiTuongThamDu = COALESCE(@p13, DoiTuongThamDu),
        SLSVDuKien = COALESCE(@p14, SLSVDuKien),
        TrangThai = COALESCE(@p15, TrangThai)
      WHERE MaHD = @p16 AND NguoiLap = @p17
    `, [
      dto.hocKy?.trim() || null,
      dto.namHoc?.trim() || null,
      dto.capTC !== undefined ? dto.capTC.trim() : null,
      dto.tgBatDau?.trim() || null,
      dto.tgKetThuc?.trim() || null,
      dto.maBM !== undefined ? dto.maBM : -1,
      dto.tenHoatDong ? dto.tenHoatDong.trim() : null,
      dto.loaiHoatDong || null,
      dto.noiDung !== undefined ? dto.noiDung.trim() : null,
      dto.tgDuKien ? dto.tgDuKien.trim() : null,
      dto.diaDiem !== undefined ? (dto.diaDiem ? dto.diaDiem.trim() : null) : null,
      dto.tienDoTH !== undefined ? (dto.tienDoTH ? dto.tienDoTH.trim() : null) : null,
      dto.doiTuongThamDu ? dto.doiTuongThamDu.trim() : null,
      dto.slsvDuKien !== undefined ? dto.slsvDuKien.trim() : null,
      dto.trangThai || null,
      id,
      context.userId
    ]);
    await this.refreshActivityBudgetSummary(id);
    return { success: true, message: 'Đã cập nhật hoạt động học thuật' };
  }

  async deleteAcademicActivity(context: SessionContext, id: number) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const act = (await this.db.query<{ MaHD: number }>(`SELECT MaHD FROM HOATDONGHOCTHUAT WHERE MaHD = @p1 AND NguoiLap = @p2`, [id, context.userId]))[0];
    if (!act) throw new NotFoundException('Không tìm thấy hoạt động học thuật');

    await this.db.query(`DELETE FROM BANCHIDAO WHERE MaHD = @p1 AND EXISTS (SELECT 1 FROM HOATDONGHOCTHUAT h WHERE h.MaHD=@p1 AND h.NguoiLap=@p2)`, [id, context.userId]);
    await this.db.query(`DELETE FROM BANTOCHUC WHERE MaHD = @p1 AND EXISTS (SELECT 1 FROM HOATDONGHOCTHUAT h WHERE h.MaHD=@p1 AND h.NguoiLap=@p2)`, [id, context.userId]);
    await this.db.query(`DELETE FROM BANHOTRO WHERE MaHD = @p1 AND EXISTS (SELECT 1 FROM HOATDONGHOCTHUAT h WHERE h.MaHD=@p1 AND h.NguoiLap=@p2)`, [id, context.userId]);
    await this.db.query(`DELETE FROM HOATDONGHOCTHUAT WHERE MaHD = @p1 AND NguoiLap = @p2`, [id, context.userId]);
    return { success: true, message: 'Đã xóa hoạt động học thuật' };
  }

  async submitAcademicActivity(context: SessionContext, id: number) {
    return this.submitProposalPackage(context,id);
  }

  async approveAcademicActivity(context: SessionContext, id: number) {
    await this.requireFacultySigner(context);
    const departmentProposal=(await this.db.query<{MaDeXuat:number}>(`SELECT MaDeXuat FROM KEHOACHCUOCTHIBOMON WHERE MaHD=@p1`,[id]))[0];
    if(departmentProposal) throw new BadRequestException('Hoạt động bộ môn được Trưởng khoa duyệt cùng kế hoạch học thuật chung tại trang Kế hoạch học thuật');
    const activity=(await this.db.query<AnnualProposal>('SELECT MaHD,NguoiLap,MaBM,NamHoc,TenHoatDong,NoiDung,TrangThai FROM HOATDONGHOCTHUAT WHERE MaHD=@p1',[id]))[0];
    if(!activity || activity.TrangThai!=='Chờ duyệt') throw new BadRequestException('Đề xuất không ở trạng thái chờ ký');
    const faculty=await this.resolvePlanFaculty();
    const department=(await this.db.query<{MaKhoa:number}>('SELECT MaKhoa FROM BOMON WHERE MaBM=@p1',[activity.MaBM]))[0];
    if(!department) throw new BadRequestException('Đề xuất chưa có bộ môn phụ trách');
    this.assertPlanFaculty(department.MaKhoa,faculty);
    const budget=(await this.db.query<{MaDuTruKP:number;TrangThai:string}>('SELECT TOP(1) MaDuTruKP,TrangThai FROM DUTRUKINHPHI WHERE MaHD=@p1 ORDER BY MaDuTruKP DESC',[id]))[0];
    if(!budget || budget.TrangThai!=='Đã duyệt') throw new BadRequestException('Trưởng khoa cần ký bản chi phí trước khi duyệt đề xuất');
    const event=JSON.stringify({action:'approve',userId:context.userId,at:new Date().toISOString()});
    const result=await this.db.query(`UPDATE HOATDONGHOCTHUAT SET TrangThai=N'Đã duyệt',NguoiDuyetDeXuat=@p2,NgayDuyetDeXuat=SYSDATETIMEOFFSET(),
      LichSuDuyetDeXuat=JSON_MODIFY(LichSuDuyetDeXuat,'append $',JSON_QUERY(@p3)) OUTPUT INSERTED.MaHD,INSERTED.TrangThai
      WHERE MaHD=@p1 AND TrangThai=N'Chờ duyệt'`,[id,context.userId,event]);
    if(!result[0]) throw new ConflictException('Đề xuất vừa thay đổi');
    return {success:true,activity:result[0]};
  }

  // --- BAN CHỈ ĐẠO ---
  async listSteeringCommittee(context: SessionContext, activityId?: number) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN', 'PHONGCTSV', 'HIEUTRUONG', 'PHONGKHCN', 'SINHVIEN']);
    return this.db.query(`
      SELECT 
        b.MaChiDao, b.MaHD, b.MaNgDung, b.HoTen, b.HocVi, b.ChucDanh, b.ChucVu,
        h.TenHoatDong,
        h.MaHD AS MaHoatDong
      FROM BANCHIDAO b
      JOIN HOATDONGHOCTHUAT h ON h.MaHD = b.MaHD
      WHERE (@p1 IS NULL OR b.MaHD = @p1)
      ORDER BY b.MaChiDao DESC
    `, [activityId ?? null]);
  }

  async addSteeringMember(context: SessionContext, dto: CreateCommitteeMemberDto) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const rows = await this.db.query(`
      INSERT INTO BANCHIDAO (MaHD, MaNgDung, HoTen, HocVi, ChucDanh, ChucVu)
      OUTPUT INSERTED.*
      VALUES (@p1, @p2, @p3, @p4, @p5, @p6)
    `, [
      dto.maHD,
      dto.maNgDung ?? null,
      dto.hoTen.trim(),
      dto.hocVi?.trim() || null,
      dto.chucDanh?.trim() || null,
      dto.chucVu?.trim() || null
    ]);
    return rows[0];
  }

  async deleteSteeringMember(context: SessionContext, id: number) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    await this.db.query(`DELETE FROM BANCHIDAO WHERE MaChiDao = @p1`, [id]);
    return { success: true, message: 'Đã xóa thành viên Ban chỉ đạo' };
  }

  async updateCommitteeMember(context: SessionContext, table: 'BANCHIDAO' | 'BANTOCHUC' | 'BANHOTRO', idColumn: string, id: number, dto: CreateCommitteeMemberDto) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const hasTask = table === 'BANTOCHUC';
    const rows = await this.db.query(`UPDATE ${table} SET MaHD=@p1, HoTen=@p2, HocVi=@p3, ChucDanh=@p4, ChucVu=@p5${hasTask ? ', NhiemVu=@p6' : ''} OUTPUT INSERTED.* WHERE ${idColumn}=@p${hasTask ? 7 : 6}`, hasTask
      ? [dto.maHD, dto.hoTen.trim(), dto.hocVi?.trim() || null, dto.chucDanh?.trim() || null, dto.chucVu?.trim() || null, dto.nhiemVu?.trim() || null, id]
      : [dto.maHD, dto.hoTen.trim(), dto.hocVi?.trim() || null, dto.chucDanh?.trim() || null, dto.chucVu?.trim() || null, id]);
    if (!rows[0]) throw new NotFoundException('Không tìm thấy thành viên');
    return rows[0];
  }

  // --- BAN TỔ CHỨC ---
  async listOrganizingCommittee(context: SessionContext, activityId?: number) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN', 'PHONGCTSV', 'HIEUTRUONG', 'PHONGKHCN', 'SINHVIEN']);
    return this.db.query(`
      SELECT 
        b.MaBanTC, b.MaHD, b.MaNgDung, b.HoTen, b.HocVi, b.ChucDanh, b.ChucVu, b.NhiemVu, b.MaGV,
        h.TenHoatDong,
        h.MaHD AS MaHoatDong
      FROM BANTOCHUC b
      JOIN HOATDONGHOCTHUAT h ON h.MaHD = b.MaHD
      WHERE (@p1 IS NULL OR b.MaHD = @p1)
      ORDER BY b.MaBanTC DESC
    `, [activityId ?? null]);
  }

  async addOrganizingMember(context: SessionContext, dto: CreateCommitteeMemberDto) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const rows = await this.db.query(`
      INSERT INTO BANTOCHUC (MaHD, MaNgDung, HoTen, HocVi, ChucDanh, ChucVu, NhiemVu)
      OUTPUT INSERTED.*
      VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7)
    `, [
      dto.maHD,
      dto.maNgDung ?? null,
      dto.hoTen.trim(),
      dto.hocVi?.trim() || null,
      dto.chucDanh?.trim() || null,
      dto.chucVu?.trim() || null,
      dto.nhiemVu?.trim() || null
    ]);
    return rows[0];
  }

  async deleteOrganizingMember(context: SessionContext, id: number) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    await this.db.query(`DELETE FROM BANTOCHUC WHERE MaBanTC = @p1`, [id]);
    return { success: true, message: 'Đã xóa thành viên Ban tổ chức' };
  }

  // --- BAN HỖ TRỢ ---
  async listSupportCommittee(context: SessionContext, activityId?: number) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN', 'PHONGCTSV', 'HIEUTRUONG', 'PHONGKHCN', 'SINHVIEN']);
    return this.db.query(`
      SELECT 
        b.MaBanHoTro, b.MaHD, b.MaNgDung, b.HoTen, b.HocVi, b.ChucDanh, b.ChucVu,
        h.TenHoatDong,
        h.MaHD AS MaHoatDong
      FROM BANHOTRO b
      JOIN HOATDONGHOCTHUAT h ON h.MaHD = b.MaHD
      WHERE (@p1 IS NULL OR b.MaHD = @p1)
      ORDER BY b.MaBanHoTro DESC
    `, [activityId ?? null]);
  }

  async addSupportMember(context: SessionContext, dto: CreateCommitteeMemberDto) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const rows = await this.db.query(`
      INSERT INTO BANHOTRO (MaHD, MaNgDung, HoTen, HocVi, ChucDanh, ChucVu)
      OUTPUT INSERTED.*
      VALUES (@p1, @p2, @p3, @p4, @p5, @p6)
    `, [
      dto.maHD,
      dto.maNgDung ?? null,
      dto.hoTen.trim(),
      dto.hocVi?.trim() || null,
      dto.chucDanh?.trim() || null,
      dto.chucVu?.trim() || null
    ]);
    return rows[0];
  }

  async deleteSupportMember(context: SessionContext, id: number) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    await this.db.query(`DELETE FROM BANHOTRO WHERE MaBanHoTro = @p1`, [id]);
    return { success: true, message: 'Đã xóa thành viên Ban hỗ trợ' };
  }
}

