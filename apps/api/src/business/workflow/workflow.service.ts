import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import sql from 'mssql';
import { DatabaseService } from '../../data/database.service';
import type { SessionContext } from '../auth/auth.types';
import { ActivityChangeDto, AdjustTrainingPointDto, CompetitionResultDto, CreatePlanActivityDto, CreatePlanDto, CreateRoundDto, ReviewPlanDto, ScoreWorkDto, SubmitWorkDto, AwardTrainingPointDto, CreateStudentAccountDto, CreateStudentProfileDto, CreateLinkedStudentProfileDto, SeminarMaterialDto, UpdateStudentRecordDto, CreateClassDto, UpdateClassDto, UpdateStaffRecordDto, CreateStaffRecordDto, CreateStaffAccountDto, CreateAcademicActivityDto, UpdateAcademicActivityDto, CreateCommitteeMemberDto, CreateActivityBudgetDto, ReviewActivityBudgetDto } from '../../presentation/workflow/workflow.dto';

const key = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
@Injectable()
export class WorkflowService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private require(context: SessionContext, roles: string[]) {
    const allowed = new Set(roles.map(key));
    if (!context.user.roles.some(role => allowed.has(key(role)))) throw new ForbiddenException('Bạn không có quyền thực hiện chức năng này');
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
            WHEN q.MaQuanTri IS NOT NULL THEN N'Quản trị viên'
            ELSE r.TenVaiTro
          END
        ) AS ChucVuVaiTro,
        COALESCE(n.HoTen, a.TenDangNhap) AS HoTen, n.Email, n.SDT,
        COALESCE(s.MSSV, CONCAT('GV', RIGHT(CONCAT('0000', COALESCE(gv.MaGV, cb.MaCanBo, q.MaQuanTri)), 4)), a.TenDangNhap) AS MaDinhDanh,
        COALESCE(l.TenLop, bm.TenBM, k.TenKhoa, N'Khoa CNTT') AS DonViLop,
        CASE 
          WHEN s.MaSV IS NOT NULL THEN 'SINHVIEN'
          WHEN gv.MaGV IS NOT NULL OR cb.MaCanBo IS NOT NULL OR q.MaQuanTri IS NOT NULL THEN 'CANBO'
          ELSE 'KHAC'
        END AS LoaiDoiTuong
      FROM TAIKHOAN a
      JOIN VAITRO r ON r.MaVaiTro = a.MaVaiTro
      LEFT JOIN NGUOIDUNG n ON n.MaNgDung = a.MaNgDung
      LEFT JOIN GIANGVIEN gv ON gv.MaNgDung = n.MaNgDung
      LEFT JOIN BOMON bm ON bm.MaBM = gv.MaBM
      LEFT JOIN CANBOKHOA cb ON cb.MaNgDung = n.MaNgDung
      LEFT JOIN KHOA k ON k.MaKhoa = cb.MaKhoa
      LEFT JOIN QUANTRIVIEN q ON q.MaNgDung = n.MaNgDung
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
        q.MaQuanTri, q.MoTa AS MoTaQuanTri,
        a.MaTK, a.TenDangNhap, r.TenVaiTro,
        CONCAT('GV', RIGHT(CONCAT('0000', COALESCE(gv.MaGV, cb.MaCanBo, q.MaQuanTri, n.MaNgDung)), 4)) AS MaDinhDanh,
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
      LEFT JOIN QUANTRIVIEN q ON q.MaNgDung = n.MaNgDung
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
        await this.db.query('DELETE FROM GIANGVIEN_BOMON WHERE MaGV = @p1', [gv.MaGV]);
        for (const bmId of dto.maBMList) {
          if (bmId) {
            await this.db.query(
              'INSERT INTO GIANGVIEN_BOMON (MaGV, MaBM, VaiTro) VALUES (@p1, @p2, N\'Phụ trách\')',
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
    await this.db.query('DELETE FROM QUANTRIVIEN WHERE MaNgDung = @p1', [id]);
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

  listPlans(context: SessionContext) {
    this.require(context, ['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','TRUONG_BO_MON','TRUONGBOMON','TRUONGKHOA','PHONG_KHCN','PHONGKHCN','HIEU_TRUONG','HIEUTRUONG']);
    return this.db.query(`SELECT p.*, k.TenKhoa, bm.TenBM FROM KEHOACHHOCTHUAT p JOIN KHOA k ON k.MaKhoa=p.MaKhoa LEFT JOIN BOMON bm ON bm.MaBM=p.MaBM ORDER BY p.NamHoc DESC,p.MaKeHoach DESC`);
  }
  async getPlan(context:SessionContext,planId:number) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','TRUONG_BO_MON','TRUONGBOMON','TRUONGKHOA','PHONG_KHCN','PHONGKHCN','HIEU_TRUONG','HIEUTRUONG']);
    const plan=(await this.db.query(`SELECT p.*,k.TenKhoa,bm.TenBM FROM KEHOACHHOCTHUAT p JOIN KHOA k ON k.MaKhoa=p.MaKhoa LEFT JOIN BOMON bm ON bm.MaBM=p.MaBM WHERE p.MaKeHoach=@p1`,[planId]))[0];
    if(!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
    const activities=await this.db.query(`SELECT * FROM CHITIETKEHOACH WHERE MaKeHoach=@p1 ORDER BY MaChiTiet`,[planId]);
    return {...plan,hoatDong:activities};
  }
  async createPlan(context: SessionContext, dto: CreatePlanDto) {
    this.require(context, ['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','TRUONG_BO_MON','TRUONGBOMON']);
    if(dto.maBM) {
      const unit=(await this.db.query<{MaKhoa:number}>(`SELECT MaKhoa FROM BOMON WHERE MaBM=@p1`,[dto.maBM]))[0];
      if(!unit) throw new NotFoundException('Không tìm thấy Bộ môn');
      if(unit.MaKhoa!==dto.maKhoa) throw new BadRequestException('Bộ môn phải thuộc khoa được chọn');
    }
    let responsible:number|null=null;
    if(!context.user.roles.some(role=>key(role)==='ADMIN')) {
      const profile=(await this.db.query<{MaKhoa:number|null;MaCanBo:number|null;MaBM:number|null}>(`SELECT cb.MaKhoa,cb.MaCanBo,gv.MaBM FROM TAIKHOAN t JOIN NGUOIDUNG n ON n.MaNgDung=t.MaNgDung
        LEFT JOIN CANBOKHOA cb ON cb.MaNgDung=n.MaNgDung LEFT JOIN GIANGVIEN gv ON gv.MaNgDung=n.MaNgDung WHERE t.MaTK=@p1`,[context.userId]))[0];
      let profileFaculty=profile?.MaKhoa??null;
      if(!profileFaculty && profile?.MaBM) profileFaculty=(await this.db.query<{MaKhoa:number}>(`SELECT MaKhoa FROM BOMON WHERE MaBM=@p1`,[profile.MaBM]))[0]?.MaKhoa??null;
      if(!profileFaculty || profileFaculty!==dto.maKhoa) throw new ForbiddenException('Bạn chỉ được lập kế hoạch thuộc khoa/bộ môn của mình');
      responsible=profile?.MaCanBo??null;
    }
    const rows = await this.db.query(`INSERT INTO KEHOACHHOCTHUAT(SoKeHoach,TenKeHoach,NgayBanHanh,NamHoc,HocKy,CanCu,MucDich,YeuCau,NoiDung,TrangThai,MaKhoa,NgPhuTrach,MaBM,LoaiKeHoach)
      OUTPUT INSERTED.MaKeHoach VALUES(@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,N'Dự thảo',@p10,@p11,@p12,@p13)`, [dto.soKeHoach ?? `KH-${Date.now()}`,dto.tenKeHoach,dto.ngayBanHanh ?? null,dto.namHoc,dto.hocKy ?? null,dto.canCu ?? null,dto.mucDich ?? null,dto.yeuCau ?? null,dto.noiDung ?? null,dto.maKhoa,responsible,dto.maBM ?? null,dto.loaiKeHoach ?? (dto.maBM ? 'BO_MON' : 'KHOA')]);
    return { maKeHoach: rows[0].MaKeHoach, trangThai: 'Dự thảo' };
  }
  async addPlanActivity(context: SessionContext, planId: number, dto: CreatePlanActivityDto) {
    this.require(context, ['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','TRUONG_BO_MON','TRUONGBOMON']);
    const plan=(await this.db.query<{TrangThai:string}>(`SELECT TrangThai FROM KEHOACHHOCTHUAT WHERE MaKeHoach=@p1`,[planId]))[0];
    if(!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
    if(!['Dự thảo','Cần bổ sung'].includes(plan.TrangThai)) throw new BadRequestException('Chỉ chỉnh sửa hạng mục khi kế hoạch còn ở trạng thái dự thảo/cần bổ sung');
    const rows = await this.db.query(`INSERT INTO CHITIETKEHOACH(MaKeHoach,TenHoatDong,NoiDung,ThoiGianDuKien,ThoiGianKetThuc,HanDangKy,DiaDiem,DoiTuong,ChiTieu,NguoiPhuTrach,DuToan)
      OUTPUT INSERTED.MaChiTiet VALUES(@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11)`, [planId,dto.tenHoatDong,dto.noiDung ?? null,dto.thoiGianDuKien ?? null,dto.thoiGianKetThuc ?? null,dto.hanDangKy ?? null,dto.diaDiem ?? null,dto.doiTuong ?? null,dto.chiTieu ?? null,dto.nguoiPhuTrach ?? null,dto.duToan]);
    if (!rows[0]) throw new NotFoundException('Không tìm thấy kế hoạch');
    return rows[0];
  }
  async publishPlanActivity(context:SessionContext,detailId:number) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN']);
    const detail=(await this.db.query<{MaChiTiet:number;MaKeHoach:number;TenHoatDong:string;NoiDung:string|null;ThoiGianDuKien:Date|null;ThoiGianKetThuc:Date|null;HanDangKy:Date|null;DiaDiem:string|null;ChiTieu:number|null;DuToan:number;TrangThai:string;PlanStatus:string}>(
      `SELECT d.*,p.TrangThai AS PlanStatus FROM CHITIETKEHOACH d JOIN KEHOACHHOCTHUAT p ON p.MaKeHoach=d.MaKeHoach WHERE d.MaChiTiet=@p1`,[detailId]))[0];
    if(!detail) throw new NotFoundException('Không tìm thấy hoạt động trong kế hoạch');
    if(detail.PlanStatus!=='Đã duyệt') throw new BadRequestException('Chỉ được tạo hoạt động từ kế hoạch đã duyệt');
    if(!detail.ThoiGianDuKien || !detail.ThoiGianKetThuc) throw new BadRequestException('Cần nhập thời gian bắt đầu và kết thúc trước khi tạo hoạt động');
    if(detail.TrangThai==='Đã tạo') throw new BadRequestException('Hoạt động này đã được tạo');
    if(detail.ThoiGianKetThuc<=detail.ThoiGianDuKien) throw new BadRequestException('Thời gian kết thúc cần sau thời gian bắt đầu');
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const claim=await new sql.Request(tx).input('id',sql.BigInt,detailId).query(`UPDATE CHITIETKEHOACH SET TrangThai=N'Đang tạo' WHERE MaChiTiet=@id AND TrangThai<>N'Đã tạo'; SELECT @@ROWCOUNT AS changed;`);
      if(!claim.recordset[0]?.changed) throw new BadRequestException('Hoạt động này đã được tạo hoặc đang được xử lý');
      const created=await new sql.Request(tx)
        .input('name',sql.NVarChar(250),detail.TenHoatDong)
        .input('description',sql.NVarChar(sql.MAX),detail.NoiDung).input('start',sql.DateTime2,detail.ThoiGianDuKien)
        .input('end',sql.DateTime2,detail.ThoiGianKetThuc).input('deadline',sql.DateTime2,detail.HanDangKy)
        .input('place',sql.NVarChar(255),detail.DiaDiem).input('capacity',sql.Int,detail.ChiTieu).input('budget',sql.Decimal(18,2),detail.DuToan)
        .query(`INSERT INTO HOATDONGHOCTHUAT(TenHoatDong,MoTa,TgBatDau,TgKetThuc,HanDangKy,DiaDiem,SLToiDa,TrangThai,KinhPhiDuTru)
          OUTPUT INSERTED.MaHD,INSERTED.TenHoatDong VALUES(@name,@description,@start,@end,@deadline,@place,@capacity,N'Đã công bố',@budget)`);
      await new sql.Request(tx).input('activityId',sql.BigInt,created.recordset[0].MaHD).input('title',sql.NVarChar(250),`Hoạt động mới: ${detail.TenHoatDong}`)
        .query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
          SELECT DISTINCT t.MaTK,@activityId,N'Hoạt động mới',@title,CONCAT(N'Hoạt động mới đã được công bố. Thời gian: ',CONVERT(nvarchar(30),h.TgDuKien,126),N'; địa điểm: ',COALESCE(h.DiaDiem,N'Chưa cập nhật'))
          FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung JOIN HOATDONGHOCTHUAT h ON h.MaHD=@activityId`);
      await new sql.Request(tx).input('id',sql.BigInt,detailId).query(`UPDATE CHITIETKEHOACH SET TrangThai=N'Đã tạo' WHERE MaChiTiet=@id`);
      await tx.commit(); return created.recordset[0];
    } catch(error) { await tx.rollback(); throw error; }
  }
  async submitPlan(context: SessionContext, planId: number) {
    this.require(context, ['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','TRUONG_BO_MON','TRUONGBOMON']);
    const rows = await this.db.query(`UPDATE KEHOACHHOCTHUAT SET TrangThai=N'Chờ Trưởng khoa ký duyệt',LichSuDuyet=JSON_MODIFY(COALESCE(LichSuDuyet,N'[]'),'append $',JSON_QUERY(@p2)) OUTPUT INSERTED.MaKeHoach,INSERTED.TrangThai WHERE MaKeHoach=@p1 AND TrangThai IN (N'Dự thảo',N'Cần bổ sung')`, [planId,JSON.stringify({action:'submit',userId:context.userId,role:context.user.roles[0],at:new Date().toISOString()})]);
    if (!rows[0]) throw new NotFoundException('Không tìm thấy kế hoạch ở trạng thái có thể trình duyệt');
    return rows[0];
  }
  async reviewPlan(context: SessionContext, planId: number, dto: ReviewPlanDto) {
    const reviewers = ['ADMIN','CAN_BO_KHOA','CANBOKHOA','TRUONGKHOA','PHONG_KHCN','PHONGKHCN','HIEU_TRUONG','HIEUTRUONG'];
    this.require(context, reviewers);
    const roleKeys = context.user.roles.map(key);
    const isAdmin = roleKeys.includes('ADMIN');
    const tx = new sql.Transaction(this.db.pool);
    await tx.begin();
    try {
      const planResult = await new sql.Request(tx).input('id', sql.BigInt, planId)
        .query<{ TrangThai: string; LichSuDuyet: string }>(`SELECT TrangThai,LichSuDuyet FROM KEHOACHHOCTHUAT WITH (UPDLOCK,ROWLOCK) WHERE MaKeHoach=@id`);
      const plan = planResult.recordset[0];
      if (!plan) throw new NotFoundException('Không tìm thấy kế hoạch');

      const stages = [
        { status: 'Chờ Trưởng khoa ký duyệt', role: 'TRUONGKHOA', acceptedRoles: ['TRUONGKHOA','CANBOKHOA'], code: 'faculty-dean', title: 'Trưởng khoa ký và duyệt' },
        { status: 'Chờ Phòng KHCN ký duyệt', role: 'PHONGKHCN', acceptedRoles: ['PHONGKHCN'], code: 'research-office', title: 'Phòng KHCN ký duyệt' },
        { status: 'Chờ Ban giám hiệu duyệt', role: 'HIEUTRUONG', acceptedRoles: ['HIEUTRUONG'], code: 'university-board', title: 'Ban giám hiệu duyệt' },
      ];
      const stageIndex = stages.findIndex((stage) => stage.status === plan.TrangThai);
      if (stageIndex < 0) throw new BadRequestException('Kế hoạch không ở bước chờ ký duyệt');
      const stage = stages[stageIndex];
      if (!isAdmin && !stage.acceptedRoles.some((role) => roleKeys.includes(role))) {
        throw new ForbiddenException(`Bước hiện tại dành cho ${stage.title}`);
      }

      const finalStatus = dto.action === 'approve'
        ? stages[stageIndex + 1]?.status ?? 'Đã duyệt'
        : dto.action === 'request_changes' ? 'Cần bổ sung' : 'Không duyệt';
      const actorRole = isAdmin ? 'ADMIN' : context.user.roles.find((role) => stage.acceptedRoles.includes(key(role))) ?? stage.role;
      const event = JSON.stringify({
        action: dto.action,
        stage: stage.code,
        stageName: stage.title,
        expectedRole: stage.role,
        role: actorRole,
        userId: context.userId,
        signed: dto.action === 'approve',
        note: dto.ghiChu ?? null,
        at: new Date().toISOString(),
      });
      const result = await new sql.Request(tx)
        .input('id', sql.BigInt, planId)
        .input('currentStatus', sql.NVarChar(30), plan.TrangThai)
        .input('nextStatus', sql.NVarChar(30), finalStatus)
        .input('reviewer', sql.BigInt, context.userId)
        .input('event', sql.NVarChar(sql.MAX), event)
        .query(`UPDATE KEHOACHHOCTHUAT SET TrangThai=@nextStatus,NguoiDuyet=@reviewer,
          NgayDuyet=CASE WHEN @nextStatus=N'Đã duyệt' THEN SYSDATETIMEOFFSET() ELSE NgayDuyet END,
          LichSuDuyet=JSON_MODIFY(COALESCE(LichSuDuyet,N'[]'),'append $',JSON_QUERY(@event))
          OUTPUT INSERTED.MaKeHoach,INSERTED.TrangThai,INSERTED.NguoiDuyet,INSERTED.NgayDuyet,INSERTED.LichSuDuyet
          WHERE MaKeHoach=@id AND TrangThai=@currentStatus`);
      if (!result.recordset[0]) throw new ConflictException('Trạng thái kế hoạch vừa thay đổi; hãy tải lại và kiểm tra bước hiện tại.');
      await tx.commit();
      return result.recordset[0];
    } catch (error) {
      try { await tx.rollback(); } catch { /* Keep the original workflow error. */ }
      throw error;
    }
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
  async awardPoint(context:SessionContext,dto:AwardTrainingPointDto) {
    this.require(context,['ADMIN','PHONG_CTSV','PHONGCTSV','CONG_TAC_SINH_VIEN','CAN_BO_CTSV']);
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
    const q=(await this.db.query<{MaQR:number;MaHD:number;TgBatDau:Date;TenHoatDong:string}>(`SELECT qr.MaQR,qr.MaHD,h.TgDuKien,h.TenHoatDong FROM MAQR qr JOIN HOATDONGHOCTHUAT h ON h.MaHD=qr.MaHD WHERE qr.MaQRCode=@p1 AND qr.TrangThai=N'Hoạt động' AND qr.TGMo<=SYSDATETIMEOFFSET() AND qr.TGHetHan>SYSDATETIMEOFFSET()`,[token]))[0];
    if(!q) throw new BadRequestException('Mã điểm danh không hợp lệ hoặc đã hết hạn');
    const reg=(await this.db.query<{MaDK:number;MaSV:number}>(`SELECT dk.MaDK,dk.MaSV FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung JOIN DKTHAMGIA dk ON dk.MaSV=s.MaSV WHERE t.MaTK=@p1 AND dk.MaHD=@p2 AND dk.TrangThai IN (N'Đã đăng ký',N'Đã xác nhận')`,[context.userId,q.MaHD]))[0];
    if(!reg) throw new ForbiddenException('Bạn chưa đăng ký hoạt động này');
    if((await this.db.query(`SELECT 1 AS found FROM DIEMDANH WHERE MaDK=@p1`,[reg.MaDK])).length) throw new ConflictException('Bạn đã được điểm danh cho hoạt động này');
    const start=new Date(q.TgBatDau); const month=start.getMonth()+1; const year=start.getFullYear();
    const academicYear=month>=8?`${year}-${year+1}`:`${year-1}-${year}`;
    const semester=month>=8?'HK1':month<=1||month>=2&&month<=5?'HK2':'HK3';
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const rows=await new sql.Request(tx).input('qr',sql.BigInt,q.MaQR).input('registration',sql.BigInt,reg.MaDK)
        .query(`INSERT INTO DIEMDANH(MaQR,MaDK,TrangThai) OUTPUT INSERTED.MaDD,INSERTED.BatDauLuc,INSERTED.TrangThai VALUES(@qr,@registration,N'Đã điểm danh')`);
      await new sql.Request(tx).input('student',sql.BigInt,reg.MaSV).input('activity',sql.BigInt,q.MaHD)
        .input('semester',sql.NVarChar(30),semester).input('year',sql.VarChar(20),academicYear).input('account',sql.BigInt,context.userId).input('name',sql.NVarChar(250),q.TenHoatDong)
        .query(`IF NOT EXISTS(SELECT 1 FROM DIEMRENLUYEN WITH(UPDLOCK,HOLDLOCK) WHERE MaSV=@student AND MaHD=@activity AND TrangThai IN(N'Chờ xác nhận',N'Đã xác nhận'))
          INSERT INTO DIEMRENLUYEN(MaSV,MaHD,HocKy,NamHoc,SoDiem,LyDo,TrangThai,NguoiGhi)
          VALUES(@student,@activity,@semester,@year,5,CONCAT(N'Điểm danh tham gia hoạt động: ',@name),N'Chờ xác nhận',@account)`);
      await new sql.Request(tx).input('activity',sql.BigInt,q.MaHD).input('account',sql.BigInt,context.userId).input('title',sql.NVarChar(250),`Điểm danh thành công: ${q.TenHoatDong}`)
        .input('message',sql.NVarChar(sql.MAX),'Bạn được ghi nhận điểm danh. 5 điểm rèn luyện đã được gửi chờ Phòng Công tác sinh viên xác nhận.')
        .query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung) VALUES(@account,@activity,N'Điểm danh',@title,@message)`);
      await tx.commit(); return {...rows.recordset[0],diemRenLuyen:{soDiem:5,trangThai:'Chờ xác nhận'}};
    } catch(error) {try{await tx.rollback();}catch{/* already rolled back */} throw error;}
  }
  async manualAttendance(context:SessionContext,registrationId:number) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','BAN_TO_CHUC','BANTOCHUC']);
    const registration=(await this.db.query<{MaDK:number;MaSV:number;MaHD:number;TgBatDau:Date;TenHoatDong:string}>(
      `SELECT d.MaDK,d.MaSV,d.MaHD,h.TgDuKien,h.TenHoatDong FROM DKTHAMGIA d JOIN HOATDONGHOCTHUAT h ON h.MaHD=d.MaHD
       WHERE d.MaDK=@p1 AND d.TrangThai IN(N'Đã đăng ký',N'Đã xác nhận')`,[registrationId]))[0];
    if(!registration) throw new NotFoundException('Không tìm thấy đăng ký đang hoạt động');
    if((await this.db.query(`SELECT 1 AS found FROM DIEMDANH WHERE MaDK=@p1`,[registrationId])).length) throw new ConflictException('Sinh viên đã được điểm danh');
    const start=new Date(registration.TgBatDau); const month=start.getMonth()+1; const year=start.getFullYear();
    const academicYear=month>=8?`${year}-${year+1}`:`${year-1}-${year}`;
    const semester=month>=8?'HK1':month<=5?'HK2':'HK3';
    const tx=new sql.Transaction(this.db.pool); await tx.begin();
    try {
      const attendance=await new sql.Request(tx).input('registration',sql.BigInt,registrationId).input('account',sql.BigInt,context.userId)
        .query(`INSERT INTO DIEMDANH(MaQR,MaDK,TrangThai,NguonDiemDanh,NguoiXacNhan)
          OUTPUT INSERTED.MaDD,INSERTED.BatDauLuc,INSERTED.TrangThai,INSERTED.NguonDiemDanh
          VALUES(NULL,@registration,N'Đã điểm danh',N'Danh sách ký tay',@account)`);
      await new sql.Request(tx).input('student',sql.BigInt,registration.MaSV).input('activity',sql.BigInt,registration.MaHD)
        .input('semester',sql.NVarChar(30),semester).input('year',sql.VarChar(20),academicYear).input('account',sql.BigInt,context.userId).input('name',sql.NVarChar(250),registration.TenHoatDong)
        .query(`IF NOT EXISTS(SELECT 1 FROM DIEMRENLUYEN WITH(UPDLOCK,HOLDLOCK) WHERE MaSV=@student AND MaHD=@activity AND TrangThai IN(N'Chờ xác nhận',N'Đã xác nhận'))
          INSERT INTO DIEMRENLUYEN(MaSV,MaHD,HocKy,NamHoc,SoDiem,LyDo,TrangThai,NguoiGhi)
          VALUES(@student,@activity,@semester,@year,5,CONCAT(N'Điểm danh tham gia hoạt động: ',@name),N'Chờ xác nhận',@account)`);
      await new sql.Request(tx).input('student',sql.BigInt,registration.MaSV).input('activity',sql.BigInt,registration.MaHD)
        .input('title',sql.NVarChar(250),`Điểm danh thành công: ${registration.TenHoatDong}`)
        .query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
          SELECT t.MaTK,@activity,N'Điểm danh',@title,N'Bạn đã được điểm danh thủ công. 5 điểm rèn luyện đang chờ xác nhận.'
          FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung WHERE s.MaSV=@student`);
      await tx.commit();
      return {...attendance.recordset[0],maDK:registrationId,diemRenLuyen:{soDiem:5,trangThai:'Chờ xác nhận'}};
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
      FROM HOATDONGHOCTHUAT h LEFT JOIN KEHOACHHOCTHUAT p ON p.MaKeHoach=h.MaKeHoachKhoa LEFT JOIN KHOA k ON k.MaKhoa=p.MaKhoa LEFT JOIN BOMON bm ON bm.MaBM=p.MaBM
      WHERE (@p1 IS NULL OR h.TgDuKien>=@p1) AND (@p2 IS NULL OR h.TgDuKien<DATEADD(DAY,1,@p2)) ORDER BY h.TgDuKien DESC`,[from??null,to??null]);
  }
  async reportTrainingPoints(context:SessionContext,semester?:string,academicYear?:string) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','PHONG_CTSV','PHONGCTSV']);
    return this.db.query(`SELECT d.NamHoc,d.HocKy,k.TenKhoa,bm.TenBM,COUNT(*) AS SoLuotGhiNhan,
      SUM(CASE WHEN d.SoDiem>0 THEN d.SoDiem ELSE 0 END) AS TongDiemCong,
      SUM(CASE WHEN d.SoDiem<0 THEN d.SoDiem ELSE 0 END) AS TongDiemTru,
      SUM(CASE WHEN d.TrangThai=N'Đã xác nhận' THEN d.SoDiem ELSE 0 END) AS TongDiemDaXacNhan
      FROM DIEMRENLUYEN d JOIN SINHVIEN sv ON sv.MaSV=d.MaSV JOIN LOP l ON l.MaLop=sv.MaLop JOIN KHOA k ON k.MaKhoa=l.MaKhoa
      JOIN HOATDONGHOCTHUAT h ON h.MaHD=d.MaHD LEFT JOIN KEHOACHHOCTHUAT p ON p.MaKeHoach=h.MaKeHoachKhoa LEFT JOIN BOMON bm ON bm.MaBM=p.MaBM
      WHERE (@p1 IS NULL OR d.HocKy=@p1) AND (@p2 IS NULL OR d.NamHoc=@p2)
      GROUP BY d.NamHoc,d.HocKy,k.TenKhoa,bm.TenBM ORDER BY d.NamHoc DESC,d.HocKy,k.TenKhoa,bm.TenBM`,[semester??null,academicYear??null]);
  }

  // --- QUẢN LÝ HOẠT ĐỘNG HỌC THUẬT & CÁC BAN ---
  async listAcademicActivities(context: SessionContext) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN', 'PHONGCTSV', 'HIEUTRUONG', 'PHONGKHCN', 'SINHVIEN']);
    const canViewAll = context.user.roles.some((role) => ['ADMIN', 'CANBOKHOA', 'PHONGCTSV', 'HIEUTRUONG', 'PHONGKHCN'].includes(key(role)));
    return this.db.query(`
      SELECT 
        h.MaHD,
        (SELECT ISNULL(MAX(h2.MaHD), 0) + 1 FROM HOATDONGHOCTHUAT h2) AS MaHDKeTiep,
        h.HocKy,
        h.NamHoc,
        h.TgBatDau,
        h.TgKetThuc,
        kh.MaBM,
        bm.TenBM,
        h.TenHoatDong,
        h.LoaiHoatDong,
        h.NoiDung,
        CONVERT(VARCHAR(10), h.TgDuKien, 120) AS TgDuKien,
        h.DiaDiem,
        h.TienDoTH,
        h.DoiTuongThamDu,
        h.SLSVDuKien,
        h.TrangThai,
        (SELECT COUNT(*) FROM BANCHIDAO bcd WHERE bcd.MaHD = h.MaHD) AS SoThanhVienChiDao,
        (SELECT COUNT(*) FROM BANTOCHUC btc WHERE btc.MaHD = h.MaHD) AS SoThanhVienToChuc,
        (SELECT COUNT(*) FROM BANHOTRO bht WHERE bht.MaHD = h.MaHD) AS SoThanhVienHoTro
      FROM HOATDONGHOCTHUAT h
      LEFT JOIN KEHOACHHOCTHUAT kh ON kh.MaKeHoach = COALESCE(h.MaKeHoachKhoa, h.MaKeHoach)
      LEFT JOIN BOMON bm ON bm.MaBM = kh.MaBM
      WHERE (@p2 = 1 AND h.TrangThai IN (N'Chờ duyệt', N'Đã duyệt', N'Đã công bố'))
         OR (@p2 = 0 AND h.NguoiLap = CAST(@p1 AS INT))
      ORDER BY h.MaHD ASC
    `, [context.userId, canViewAll ? 1 : 0]);
  }

  async nextAcademicActivityId(context: SessionContext) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const row = (await this.db.query<{ NextId: number }>('SELECT ISNULL(MAX(MaHD), 0) + 1 AS NextId FROM HOATDONGHOCTHUAT'))[0];
    return { nextId: row?.NextId ?? 1 };
  }

  async createAcademicActivity(context: SessionContext, dto: CreateAcademicActivityDto) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const tenHoatDong = dto.tenHoatDong.trim();
    const rows = await this.db.query(`
      INSERT INTO HOATDONGHOCTHUAT (
        HocKy, NamHoc, TgBatDau, TgKetThuc, MaBM, TenHoatDong, LoaiHoatDong, NoiDung, TgDuKien, DiaDiem, TienDoTH, DoiTuongThamDu, SLSVDuKien, TrangThai, NguoiLap
      )
      OUTPUT INSERTED.*
      VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12, @p13, N'Dự thảo', @p14)
    `, [
      dto.hocKy?.trim() || null,
      dto.namHoc?.trim() || null,
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
      dto.slsvDuKien ?? 0,
      context.userId ? parseInt(context.userId, 10) : null
    ]);
    return rows[0];
  }

  async createActivityBudget(context: SessionContext, activityId: number, dto: CreateActivityBudgetDto) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const activity = (await new sql.Request(transaction).input('activityId', sql.BigInt, activityId)
        .query<{ MaHD: number }>('SELECT MaHD FROM HOATDONGHOCTHUAT WITH (UPDLOCK, ROWLOCK) WHERE MaHD=@activityId')).recordset[0];
      if (!activity) throw new NotFoundException('Không tìm thấy hoạt động học thuật');

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

  async listActivityBudgets(context: SessionContext) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN', 'TRUONGKHOA', 'PHONGCTSV', 'PHONGKHCN', 'HIEUTRUONG']);
    return this.db.query(`
      SELECT k.*, h.TenHoatDong, h.LoaiHoatDong, h.TrangThai AS TrangThaiHoatDong,
             d.MaDuTruKP AS MaHoSoDuTru, d.MaHD AS MaHoatDongDuTru,
             d.TenTieuDe, COALESCE(d.NamHoc,h.NamHoc,N'Chưa xác định') AS NamHoc,
             d.TongKinhPhi, d.TrangThai AS TrangThaiDuTru, d.GhiChuDuyet,
             d.NguoiDuyet, d.NgayDuyet
      FROM KINHPHIHOATDONG k
      JOIN HOATDONGHOCTHUAT h ON h.MaHD = k.MaHD
      LEFT JOIN DUTRUKINHPHI d ON d.MaDuTruKP = k.MaDuTruKP
      ORDER BY COALESCE(d.NamHoc,h.NamHoc) DESC,h.TenHoatDong,k.MaKPHD
    `);
  }

  async submitActivityBudget(context: SessionContext, activityId: number) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const activity = (await new sql.Request(transaction).input('activityId', sql.BigInt, activityId)
        .query<{ MaHD: number; TenHoatDong: string; NamHoc: string | null }>(`SELECT MaHD,TenHoatDong,NamHoc
          FROM HOATDONGHOCTHUAT WITH (UPDLOCK, ROWLOCK) WHERE MaHD=@activityId`)).recordset[0];
      if (!activity) throw new NotFoundException('Không tìm thấy hoạt động học thuật');

      const existingHeader = (await new sql.Request(transaction).input('activityId', sql.BigInt, activityId)
        .query<{ MaDuTruKP: number; TrangThai: string }>(`SELECT TOP (1) MaDuTruKP,TrangThai FROM DUTRUKINHPHI WITH (UPDLOCK, HOLDLOCK)
          WHERE MaHD=@activityId ORDER BY MaDuTruKP DESC`)).recordset[0];
      if (existingHeader && ['Chờ duyệt', 'Đã duyệt'].includes(existingHeader.TrangThai)) {
        throw new BadRequestException('Dự trù của hoạt động đã được gửi hoặc đã duyệt.');
      }

      let proposalId = existingHeader?.MaDuTruKP ?? null;
      if (!proposalId) {
        const unassigned = (await new sql.Request(transaction).input('activityId', sql.BigInt, activityId)
          .query<{ SoDong: number; TongKinhPhi: number }>(`SELECT COUNT(*) AS SoDong,COALESCE(SUM(SoTien),0) AS TongKinhPhi
            FROM KINHPHIHOATDONG WHERE MaHD=@activityId AND MaDuTruKP IS NULL`)).recordset[0];
        if (!unassigned?.SoDong) throw new BadRequestException('Hãy tạo ít nhất một khoản dự trù cho hoạt động trước khi gửi khoa.');
        const created = await new sql.Request(transaction)
          .input('activityId', sql.BigInt, activityId)
          .input('title', sql.NVarChar(250), `Dự trù kinh phí – ${activity.TenHoatDong}`)
          .input('year', sql.NVarChar(20), activity.NamHoc?.trim() || null)
          .input('amount', sql.Decimal(18, 2), unassigned.TongKinhPhi)
          .input('accountId', sql.BigInt, Number(context.userId))
          .query<{ MaDuTruKP: number }>(`INSERT INTO DUTRUKINHPHI(MaHD,TenTieuDe,NamHoc,TongKinhPhi,NguoiLap,TrangThai)
            OUTPUT INSERTED.MaDuTruKP
            VALUES(@activityId,@title,COALESCE(@year,CONCAT(YEAR(SYSDATETIME())-CASE WHEN MONTH(SYSDATETIME())<8 THEN 1 ELSE 0 END,'-',YEAR(SYSDATETIME())+CASE WHEN MONTH(SYSDATETIME())>=8 THEN 1 ELSE 0 END)),@amount,@accountId,N'Dự thảo')`);
        proposalId = created.recordset[0].MaDuTruKP;
        await new sql.Request(transaction).input('proposalId', sql.BigInt, proposalId).input('activityId', sql.BigInt, activityId)
          .query(`UPDATE KINHPHIHOATDONG SET MaDuTruKP=@proposalId WHERE MaHD=@activityId AND MaDuTruKP IS NULL`);
      }

      const totals = (await new sql.Request(transaction).input('proposalId', sql.BigInt, proposalId).input('activityId', sql.BigInt, activityId)
        .query<{ SoDong: number; TongKinhPhi: number }>(`SELECT COUNT(*) AS SoDong,COALESCE(SUM(SoTien),0) AS TongKinhPhi
          FROM KINHPHIHOATDONG WHERE MaHD=@activityId AND MaDuTruKP=@proposalId`)).recordset[0];
      if (!totals?.SoDong) throw new BadRequestException('Không có khoản dự trù nào thuộc hồ sơ của hoạt động này.');

      const submitted = await new sql.Request(transaction)
        .input('proposalId', sql.BigInt, proposalId)
        .input('total', sql.Decimal(18, 2), totals.TongKinhPhi)
        .query(`UPDATE DUTRUKINHPHI SET TrangThai=N'Chờ duyệt',TongKinhPhi=@total,NguoiDuyet=NULL,NgayDuyet=NULL,GhiChuDuyet=NULL
          OUTPUT INSERTED.MaDuTruKP,INSERTED.MaHD,INSERTED.TenTieuDe,INSERTED.NamHoc,INSERTED.TongKinhPhi,INSERTED.TrangThai
          WHERE MaDuTruKP=@proposalId AND TrangThai IN (N'Dự thảo',N'Từ chối')`);
      if (!submitted.recordset[0]) throw new ConflictException('Dự trù vừa được thay đổi; hãy tải lại danh sách.');

      await new sql.Request(transaction).input('activityId', sql.BigInt, activityId).input('total', sql.Decimal(18, 2), totals.TongKinhPhi)
        .query('UPDATE HOATDONGHOCTHUAT SET KinhPhiDuTru=@total WHERE MaHD=@activityId');
      await transaction.commit();
      return submitted.recordset[0];
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async reviewActivityBudget(context: SessionContext, proposalId: number, dto: ReviewActivityBudgetDto) {
    this.require(context, ['ADMIN', 'CANBOKHOA', 'TRUONGKHOA']);
    const nextStatus = dto.action === 'approve' ? 'Đã duyệt' : 'Từ chối';
    const rows = await this.db.query(`UPDATE DUTRUKINHPHI
      SET TrangThai=@p1,NguoiDuyet=@p2,NgayDuyet=SYSDATETIME(),GhiChuDuyet=@p3
      OUTPUT INSERTED.MaDuTruKP,INSERTED.MaHD,INSERTED.TenTieuDe,INSERTED.NamHoc,INSERTED.TongKinhPhi,
        INSERTED.TrangThai,INSERTED.NguoiDuyet,INSERTED.NgayDuyet,INSERTED.GhiChuDuyet
      WHERE MaDuTruKP=@p4 AND TrangThai=N'Chờ duyệt'`, [nextStatus, context.userId, dto.ghiChu?.trim() || null, proposalId]);
    if (!rows[0]) throw new NotFoundException('Không tìm thấy dự trù đang chờ khoa duyệt');
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
        TgBatDau = COALESCE(@p3, TgBatDau),
        TgKetThuc = COALESCE(@p4, TgKetThuc),
        MaBM = COALESCE(@p5, MaBM),
        TenHoatDong = COALESCE(@p6, TenHoatDong),
        LoaiHoatDong = COALESCE(@p7, LoaiHoatDong),
        NoiDung = COALESCE(@p8, NoiDung),
        TgDuKien = COALESCE(@p9, TgDuKien),
        DiaDiem = @p10,
        TienDoTH = @p11,
        DoiTuongThamDu = COALESCE(@p12, DoiTuongThamDu),
        SLSVDuKien = COALESCE(@p13, SLSVDuKien),
        TrangThai = COALESCE(@p14, TrangThai)
      WHERE MaHD = @p15 AND NguoiLap = @p16
    `, [
      dto.hocKy?.trim() || null,
      dto.namHoc?.trim() || null,
      dto.tgBatDau?.trim() || null,
      dto.tgKetThuc?.trim() || null,
      dto.maBM !== undefined ? dto.maBM : null,
      dto.tenHoatDong ? dto.tenHoatDong.trim() : null,
      dto.loaiHoatDong || null,
      dto.noiDung !== undefined ? dto.noiDung.trim() : null,
      dto.tgDuKien ? dto.tgDuKien.trim() : null,
      dto.diaDiem !== undefined ? (dto.diaDiem ? dto.diaDiem.trim() : null) : null,
      dto.tienDoTH !== undefined ? (dto.tienDoTH ? dto.tienDoTH.trim() : null) : null,
      dto.doiTuongThamDu ? dto.doiTuongThamDu.trim() : null,
      dto.slsvDuKien !== undefined ? dto.slsvDuKien : null,
      dto.trangThai || null,
      id,
      context.userId
    ]);
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
    this.require(context, ['ADMIN', 'CANBOKHOA', 'GIANGVIEN']);
    const rows = await this.db.query(`UPDATE HOATDONGHOCTHUAT SET TrangThai=N'Chờ duyệt' OUTPUT INSERTED.MaHD, INSERTED.TrangThai WHERE MaHD=@p1 AND NguoiLap=@p2 AND TrangThai=N'Dự thảo'`, [id, context.userId]);
    if (!rows[0]) throw new NotFoundException('Hoạt động không tồn tại hoặc không còn ở trạng thái dự thảo');
    return { success: true, message: 'Đã gửi hoạt động lên phê duyệt', activity: rows[0] };
  }

  async approveAcademicActivity(context: SessionContext, id: number) {
    this.require(context, ['ADMIN', 'CANBOKHOA']);
    const rows = await this.db.query(`UPDATE HOATDONGHOCTHUAT SET TrangThai=N'Đã duyệt' OUTPUT INSERTED.MaHD, INSERTED.TrangThai WHERE MaHD=@p1 AND TrangThai=N'Chờ duyệt'`, [id]);
    if (!rows[0]) throw new NotFoundException('Hoạt động không ở trạng thái chờ duyệt hoặc không tồn tại');
    return { success: true, message: 'Đã duyệt hoạt động học thuật', activity: rows[0] };
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

