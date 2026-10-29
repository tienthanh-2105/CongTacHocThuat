import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import sql from 'mssql';
import { DatabaseService } from '../../data/database.service';
import type { SessionContext } from '../auth/auth.types';
import { ActivityChangeDto, AdjustTrainingPointDto, CompetitionResultDto, CreatePlanActivityDto, CreatePlanDto, CreateRoundDto, ReviewPlanDto, ScoreWorkDto, SubmitWorkDto, AwardTrainingPointDto, CreateStudentAccountDto, CreateStudentProfileDto, CreateLinkedStudentProfileDto, SeminarMaterialDto } from '../../presentation/workflow/workflow.dto';

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
    return this.db.query(`SELECT a.MaTK,a.MaNgDung,a.TenDangNhap,a.TrangThai,r.MaVaiTro,r.TenVaiTro,
      COALESCE(n.HoTen,a.TenDangNhap) AS HoTen,n.Email
      FROM TAIKHOAN a JOIN VAITRO r ON r.MaVaiTro=a.MaVaiTro
      LEFT JOIN NGUOIDUNG n ON n.MaNgDung=a.MaNgDung ORDER BY a.MaTK`);
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

  async listStudentClasses(context: SessionContext) {
    this.require(context, ['ADMIN']);
    return this.db.query(`SELECT l.MaLop,l.TenLop,l.KhoaHoc,k.TenKhoa
      FROM LOP l JOIN KHOA k ON k.MaKhoa=l.MaKhoa
      ORDER BY k.TenKhoa,l.TenLop`);
  }

  async listStudentRecords(context: SessionContext) {
    this.require(context, ['ADMIN']);
    return this.db.query(`SELECT s.MaSV,s.MSSV,n.MaNgDung,n.HoTen,n.Email,n.SDT,n.NgaySinh,n.GioiTinh,n.TrangThai,
        l.MaLop,l.TenLop,l.KhoaHoc,a.TenDangNhap
      FROM SINHVIEN s JOIN NGUOIDUNG n ON n.MaNgDung=s.MaNgDung
      JOIN LOP l ON l.MaLop=s.MaLop
      LEFT JOIN TAIKHOAN a ON a.MaNgDung=n.MaNgDung
      ORDER BY s.MaSV DESC`);
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
    this.require(context, ['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','TRUONG_BO_MON','TRUONGBOMON','PHONG_KHCN','PHONGKHCN','HIEU_TRUONG','HIEUTRUONG']);
    return this.db.query(`SELECT p.*, k.TenKhoa, bm.TenBM FROM KEHOACHHOCTHUAT p JOIN KHOA k ON k.MaKhoa=p.MaKhoa LEFT JOIN BOMON bm ON bm.MaBM=p.MaBM ORDER BY p.NamHoc DESC,p.MaKeHoach DESC`);
  }
  async getPlan(context:SessionContext,planId:number) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','TRUONG_BO_MON','TRUONGBOMON','PHONG_KHCN','PHONGKHCN','HIEU_TRUONG','HIEUTRUONG']);
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
    const rows = await this.db.query(`INSERT INTO KEHOACHHOCTHUAT(TenKeHoach,NamHoc,HocKy,TrangThai,MaKhoa,NgPhuTrach,MaBM,LoaiKeHoach)
      OUTPUT INSERTED.MaKeHoach VALUES(@p1,@p2,@p3,N'Dự thảo',@p4,@p5,@p6,@p7)`, [dto.tenKeHoach,dto.namHoc,dto.hocKy ?? null,dto.maKhoa,responsible,dto.maBM ?? null,dto.loaiKeHoach ?? (dto.maBM ? 'BO_MON' : 'KHOA')]);
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
        .input('plan',sql.BigInt,detail.MaKeHoach).input('name',sql.NVarChar(250),detail.TenHoatDong)
        .input('description',sql.NVarChar(sql.MAX),detail.NoiDung).input('start',sql.DateTime2,detail.ThoiGianDuKien)
        .input('end',sql.DateTime2,detail.ThoiGianKetThuc).input('deadline',sql.DateTime2,detail.HanDangKy)
        .input('place',sql.NVarChar(255),detail.DiaDiem).input('capacity',sql.Int,detail.ChiTieu).input('budget',sql.Decimal(18,2),detail.DuToan)
        .query(`INSERT INTO HOATDONGHOCTHUAT(MaKeHoach,TenHoatDong,MoTa,TgBatDau,TgKetThuc,HanDangKy,DiaDiem,SLToiDa,TrangThai,KinhPhiDuTru)
          OUTPUT INSERTED.MaHD,INSERTED.TenHoatDong VALUES(@plan,@name,@description,@start,@end,@deadline,@place,@capacity,N'Đã công bố',@budget)`);
      await new sql.Request(tx).input('activityId',sql.BigInt,created.recordset[0].MaHD).input('title',sql.NVarChar(250),`Hoạt động mới: ${detail.TenHoatDong}`)
        .query(`INSERT INTO THONGBAO(MaTK,MaHD,Loai,TieuDe,NoiDung)
          SELECT DISTINCT t.MaTK,@activityId,N'Hoạt động mới',@title,CONCAT(N'Hoạt động mới đã được công bố. Thời gian: ',CONVERT(nvarchar(30),h.TgBatDau,126),N'; địa điểm: ',COALESCE(h.DiaDiem,N'Chưa cập nhật'))
          FROM TAIKHOAN t JOIN SINHVIEN s ON s.MaNgDung=t.MaNgDung JOIN HOATDONGHOCTHUAT h ON h.MaHD=@activityId`);
      await new sql.Request(tx).input('id',sql.BigInt,detailId).query(`UPDATE CHITIETKEHOACH SET TrangThai=N'Đã tạo' WHERE MaChiTiet=@id`);
      await tx.commit(); return created.recordset[0];
    } catch(error) { await tx.rollback(); throw error; }
  }
  async submitPlan(context: SessionContext, planId: number) {
    this.require(context, ['ADMIN','CAN_BO_KHOA','CANBOKHOA','GIANG_VIEN','GIANGVIEN','TRUONG_BO_MON','TRUONGBOMON']);
    const rows = await this.db.query(`UPDATE KEHOACHHOCTHUAT SET TrangThai=N'Chờ duyệt',LichSuDuyet=JSON_MODIFY(LichSuDuyet,'append $',JSON_QUERY(@p2)) OUTPUT INSERTED.MaKeHoach,INSERTED.TrangThai WHERE MaKeHoach=@p1 AND TrangThai IN (N'Dự thảo',N'Cần bổ sung')`, [planId,JSON.stringify({action:'submit',userId:context.userId,role:context.user.roles[0],at:new Date().toISOString()})]);
    if (!rows[0]) throw new NotFoundException('Không tìm thấy kế hoạch ở trạng thái có thể trình duyệt');
    return rows[0];
  }
  async reviewPlan(context: SessionContext, planId: number, dto: ReviewPlanDto) {
    const reviewers = ['ADMIN','CAN_BO_KHOA','CANBOKHOA','PHONG_KHCN','PHONGKHCN','HIEU_TRUONG','HIEUTRUONG'];
    this.require(context, reviewers);
    const role = context.user.roles.some(r => key(r)==='ADMIN') ? 'ADMIN' : context.user.roles.find(r => reviewers.map(key).includes(key(r))) ?? '';
    const plan = (await this.db.query<{TrangThai:string;LichSuDuyet:string}>(`SELECT TrangThai,LichSuDuyet FROM KEHOACHHOCTHUAT WHERE MaKeHoach=@p1`,[planId]))[0];
    if (!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
    if (plan.TrangThai !== 'Chờ duyệt') throw new BadRequestException('Kế hoạch chưa ở trạng thái chờ duyệt');
    let history: Array<{action?:string;role?:string}> = [];
    try { history = JSON.parse(plan.LichSuDuyet || '[]'); } catch { /* malformed legacy history is preserved by rejecting below */ }
    const approvals = history.filter(item => item.action === 'approve').length;
    const roleKey = key(role);
    const expected = approvals === 0 ? ['CANBOKHOA'] : approvals === 1 ? ['PHONGKHCN'] : ['HIEUTRUONG'];
    if (roleKey === 'ADMIN') expected.splice(0, expected.length, 'ADMIN');
    if (!expected.includes(roleKey)) throw new ForbiddenException('Vai trò của bạn chưa đến bước duyệt kế hoạch này');
    const status = dto.action === 'approve' && approvals < 2 && roleKey !== 'ADMIN' ? 'Chờ duyệt' : dto.action === 'approve' ? 'Đã duyệt' : dto.action === 'request_changes' ? 'Cần bổ sung' : 'Không duyệt';
    if (dto.action === 'approve' && roleKey !== 'ADMIN' && history.some(item => item.action === 'approve' && item.role === role)) throw new BadRequestException('Vai trò này đã duyệt ở bước trước');
    const result = await this.db.query(`UPDATE KEHOACHHOCTHUAT SET TrangThai=@p2,NguoiDuyet=@p3,NgayDuyet=CASE WHEN @p2=N'Đã duyệt' THEN SYSDATETIMEOFFSET() ELSE NgayDuyet END,
      LichSuDuyet=JSON_MODIFY(LichSuDuyet,'append $',JSON_QUERY(@p4)) OUTPUT INSERTED.MaKeHoach,INSERTED.TrangThai,INSERTED.NgayDuyet WHERE MaKeHoach=@p1 AND TrangThai=N'Chờ duyệt'`,
      [planId,status,context.userId,JSON.stringify({action:dto.action,role,userId:context.userId,note:dto.ghiChu ?? null,at:new Date().toISOString()})]);
    return result[0];
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
    const q=(await this.db.query<{MaQR:number;MaHD:number;TgBatDau:Date;TenHoatDong:string}>(`SELECT qr.MaQR,qr.MaHD,h.TgBatDau,h.TenHoatDong FROM MAQR qr JOIN HOATDONGHOCTHUAT h ON h.MaHD=qr.MaHD WHERE qr.MaQRCode=@p1 AND qr.TrangThai=N'Hoạt động' AND qr.TGMo<=SYSDATETIMEOFFSET() AND qr.TGHetHan>SYSDATETIMEOFFSET()`,[token]))[0];
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
      `SELECT d.MaDK,d.MaSV,d.MaHD,h.TgBatDau,h.TenHoatDong FROM DKTHAMGIA d JOIN HOATDONGHOCTHUAT h ON h.MaHD=d.MaHD
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
        SELECT TOP(1) q.MaCho,q.MaSV,q.MaHD,h.SLToiDa,
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
    return this.db.query(`SELECT h.MaHD,h.TenHoatDong,h.TgBatDau,h.TrangThai,k.TenKhoa,bm.TenBM,
      (SELECT COUNT(*) FROM DKTHAMGIA d WHERE d.MaHD=h.MaHD AND d.TrangThai NOT IN(N'Đã hủy',N'Từ chối')) SoLuotDangKy,
      (SELECT COUNT(*) FROM DKTHAMGIA d JOIN DIEMDANH dd ON dd.MaDK=d.MaDK WHERE d.MaHD=h.MaHD AND dd.TrangThai IN(N'Đã điểm danh',N'Đã xác nhận')) SoLuotThamDu,
      (SELECT COALESCE(SUM(c.SoTien),0) FROM CHIPHITHUCTE c WHERE c.MaHD=h.MaHD) TongChiPhi
      FROM HOATDONGHOCTHUAT h LEFT JOIN KEHOACHHOCTHUAT p ON p.MaKeHoach=h.MaKeHoach LEFT JOIN KHOA k ON k.MaKhoa=p.MaKhoa LEFT JOIN BOMON bm ON bm.MaBM=p.MaBM
      WHERE (@p1 IS NULL OR h.TgBatDau>=@p1) AND (@p2 IS NULL OR h.TgBatDau<DATEADD(DAY,1,@p2)) ORDER BY h.TgBatDau DESC`,[from??null,to??null]);
  }
  async reportTrainingPoints(context:SessionContext,semester?:string,academicYear?:string) {
    this.require(context,['ADMIN','CAN_BO_KHOA','CANBOKHOA','PHONG_CTSV','PHONGCTSV']);
    return this.db.query(`SELECT d.NamHoc,d.HocKy,k.TenKhoa,bm.TenBM,COUNT(*) AS SoLuotGhiNhan,
      SUM(CASE WHEN d.SoDiem>0 THEN d.SoDiem ELSE 0 END) AS TongDiemCong,
      SUM(CASE WHEN d.SoDiem<0 THEN d.SoDiem ELSE 0 END) AS TongDiemTru,
      SUM(CASE WHEN d.TrangThai=N'Đã xác nhận' THEN d.SoDiem ELSE 0 END) AS TongDiemDaXacNhan
      FROM DIEMRENLUYEN d JOIN SINHVIEN sv ON sv.MaSV=d.MaSV JOIN LOP l ON l.MaLop=sv.MaLop JOIN KHOA k ON k.MaKhoa=l.MaKhoa
      JOIN HOATDONGHOCTHUAT h ON h.MaHD=d.MaHD LEFT JOIN KEHOACHHOCTHUAT p ON p.MaKeHoach=h.MaKeHoach LEFT JOIN BOMON bm ON bm.MaBM=p.MaBM
      WHERE (@p1 IS NULL OR d.HocKy=@p1) AND (@p2 IS NULL OR d.NamHoc=@p2)
      GROUP BY d.NamHoc,d.HocKy,k.TenKhoa,bm.TenBM ORDER BY d.NamHoc DESC,d.HocKy,k.TenKhoa,bm.TenBM`,[semester??null,academicYear??null]);
  }
}
