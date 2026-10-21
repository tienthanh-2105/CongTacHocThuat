import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import sql from 'mssql';
import { DatabaseService } from '../../database.service';
import type {
  CreateCompetitionCommitteeDto,
  CreateManagedUserDto,
  CreatePlanDto,
  UpdateManagedUserDto,
} from '../../../presentation/admin/admin.dto';

type ManagedUserRow = {
  id: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  roleId: number;
  role: string;
  accountStatus: string;
  personStatus: string | null;
};

const userSelect = `SELECT CAST(a.MaTK AS INT) AS id, a.TenDangNhap AS username,
  COALESCE(n.HoTen, a.TenDangNhap) AS name, n.Email AS email, n.SDT AS phone,
  a.MaVaiTro AS roleId, r.TenVaiTro AS role, a.TrangThai AS accountStatus,
  n.TrangThai AS personStatus
  FROM TAIKHOAN a JOIN VAITRO r ON r.MaVaiTro = a.MaVaiTro
  LEFT JOIN NGUOIDUNG n ON n.MaNgDung = a.MaNgDung`;

@Injectable()
export class AdminRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async listUsers(search?: string) {
    const rows = await this.db.query<ManagedUserRow>(
      `${userSelect} WHERE (@p1 IS NULL OR a.TenDangNhap LIKE @p1 OR n.HoTen LIKE @p1 OR n.Email LIKE @p1)
       ORDER BY a.MaTK DESC OFFSET 0 ROWS FETCH NEXT 200 ROWS ONLY`,
      [search?.trim() ? `%${search.trim()}%` : null],
    );
    return rows.map((row) => this.presentUser(row));
  }

  async getUser(id: number) {
    const rows = await this.db.query<ManagedUserRow>(`${userSelect} WHERE a.MaTK = @p1`, [id]);
    return rows[0] ? this.presentUser(rows[0]) : null;
  }

  private presentUser(row: ManagedUserRow) {
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      email: row.email,
      phone: row.phone,
      roleId: row.roleId,
      role: row.role,
      active: row.accountStatus === 'Hoạt động' && (row.personStatus === null || row.personStatus === 'Hoạt động'),
      status: row.accountStatus,
    };
  }

  async createUser(dto: CreateManagedUserDto, passwordHash: string) {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const check = new sql.Request(transaction);
      check.input('username', sql.VarChar(100), dto.tenDangNhap.trim());
      const duplicate = await check.query('SELECT TOP (1) MaTK FROM TAIKHOAN WITH (UPDLOCK, HOLDLOCK) WHERE TenDangNhap = @username');
      if (duplicate.recordset.length) throw new ConflictException('Tên đăng nhập đã được sử dụng');

      const roleRequest = new sql.Request(transaction);
      roleRequest.input('roleId', sql.Int, dto.maVaiTro);
      const role = await roleRequest.query('SELECT MaVaiTro FROM VAITRO WHERE MaVaiTro = @roleId');
      if (!role.recordset.length) throw new NotFoundException('Không tìm thấy vai trò được chọn');

      const personRequest = new sql.Request(transaction);
      personRequest.input('name', sql.NVarChar(100), dto.hoTen.trim());
      personRequest.input('email', sql.VarChar(150), dto.email?.trim() || null);
      personRequest.input('phone', sql.VarChar(11), dto.sdt?.trim() || null);
      personRequest.input('birthDate', sql.Date, dto.ngaySinh ?? null);
      personRequest.input('gender', sql.NVarChar(5), dto.gioiTinh ?? null);
      const person = await personRequest.query<{ MaNgDung: number }>(
        `INSERT INTO NGUOIDUNG(HoTen, Email, SDT, NgaySinh, GioiTinh, TrangThai)
         OUTPUT INSERTED.MaNgDung VALUES(@name, @email, @phone, @birthDate, @gender, N'Hoạt động')`,
      );

      const accountRequest = new sql.Request(transaction);
      accountRequest.input('personId', sql.Int, person.recordset[0].MaNgDung);
      accountRequest.input('roleId', sql.Int, dto.maVaiTro);
      accountRequest.input('username', sql.VarChar(100), dto.tenDangNhap.trim());
      accountRequest.input('passwordHash', sql.VarChar(255), passwordHash);
      const account = await accountRequest.query<{ MaTK: number }>(
        `INSERT INTO TAIKHOAN(MaNgDung, MaVaiTro, TenDangNhap, MatKhau, PBMatKhau, TrangThai)
         OUTPUT INSERTED.MaTK VALUES(@personId, @roleId, @username, @passwordHash, 0, N'Hoạt động')`,
      );
      await transaction.commit();
      return account.recordset[0].MaTK as number;
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }

  async updateUser(id: number, dto: UpdateManagedUserDto, passwordHash?: string) {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const accountRequest = new sql.Request(transaction);
      accountRequest.input('id', sql.Int, id);
      const account = await accountRequest.query<{ MaNgDung: number | null }>(
        'SELECT MaNgDung FROM TAIKHOAN WITH (UPDLOCK, ROWLOCK) WHERE MaTK = @id',
      );
      if (!account.recordset.length) throw new NotFoundException('Không tìm thấy tài khoản');
      const personId = account.recordset[0].MaNgDung;

      if (dto.maVaiTro !== undefined) {
        const roleRequest = new sql.Request(transaction);
        roleRequest.input('roleId', sql.Int, dto.maVaiTro);
        const role = await roleRequest.query('SELECT MaVaiTro FROM VAITRO WHERE MaVaiTro = @roleId');
        if (!role.recordset.length) throw new NotFoundException('Không tìm thấy vai trò được chọn');
        const updateRole = new sql.Request(transaction);
        updateRole.input('id', sql.Int, id);
        updateRole.input('roleId', sql.Int, dto.maVaiTro);
        await updateRole.query('UPDATE TAIKHOAN SET MaVaiTro = @roleId WHERE MaTK = @id');
      }

      if (personId !== null && (dto.hoTen !== undefined || dto.email !== undefined || dto.sdt !== undefined)) {
        const personRequest = new sql.Request(transaction);
        personRequest.input('personId', sql.Int, personId);
        const updates: string[] = [];
        if (dto.hoTen !== undefined) {
          personRequest.input('name', sql.NVarChar(100), dto.hoTen.trim());
          updates.push('HoTen = @name');
        }
        if (dto.email !== undefined) {
          personRequest.input('email', sql.VarChar(150), dto.email?.trim() || null);
          updates.push('Email = @email');
        }
        if (dto.sdt !== undefined) {
          personRequest.input('phone', sql.VarChar(11), dto.sdt?.trim() || null);
          updates.push('SDT = @phone');
        }
        await personRequest.query(`UPDATE NGUOIDUNG SET ${updates.join(', ')} WHERE MaNgDung = @personId`);
      }

      if (dto.hoatDong !== undefined) {
        const statusRequest = new sql.Request(transaction);
        statusRequest.input('id', sql.Int, id);
        statusRequest.input('status', sql.NVarChar(30), dto.hoatDong ? 'Hoạt động' : 'Khóa');
        await statusRequest.query('UPDATE TAIKHOAN SET TrangThai = @status WHERE MaTK = @id');
        if (personId !== null) {
          const personStatusRequest = new sql.Request(transaction);
          personStatusRequest.input('personId', sql.Int, personId);
          personStatusRequest.input('personStatus', sql.NVarChar(30), dto.hoatDong ? 'Hoạt động' : 'Khóa');
          await personStatusRequest.query('UPDATE NGUOIDUNG SET TrangThai = @personStatus WHERE MaNgDung = @personId');
        }
        if (!dto.hoatDong) {
          const sessions = new sql.Request(transaction);
          sessions.input('id', sql.Int, id);
          await sessions.query('DELETE FROM PHIENDANGNHAP WHERE MaTK = @id');
        }
      }

      if (passwordHash) {
        const passwordRequest = new sql.Request(transaction);
        passwordRequest.input('id', sql.Int, id);
        passwordRequest.input('passwordHash', sql.VarChar(255), passwordHash);
        await passwordRequest.query('UPDATE TAIKHOAN SET MatKhau = @passwordHash, PBMatKhau = PBMatKhau + 1 WHERE MaTK = @id');
        const sessions = new sql.Request(transaction);
        sessions.input('id', sql.Int, id);
        await sessions.query('DELETE FROM PHIENDANGNHAP WHERE MaTK = @id');
      }

      await transaction.commit();
      return this.getUser(id);
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }

  async listRoles() {
    const rows = await this.db.query<{
      roleId: number; role: string; permissionId: number | null; permission: string | null; description: string | null;
    }>(
      `SELECT r.MaVaiTro AS roleId, r.TenVaiTro AS role, p.MaQuyen AS permissionId,
              p.TenQuyen AS permission, p.MoTa AS description
       FROM VAITRO r LEFT JOIN VAITRO_QUYEN rp ON rp.MaVT = r.MaVaiTro
       LEFT JOIN PHANQUYEN p ON p.MaQuyen = rp.MaQuyen
       ORDER BY r.MaVaiTro, p.MaQuyen`,
    );
    const roles = new Map<number, { id: number; name: string; permissions: Array<{ id: number; name: string; description: string | null }> }>();
    for (const row of rows) {
      const role = roles.get(row.roleId) ?? { id: row.roleId, name: row.role, permissions: [] };
      if (row.permissionId !== null && row.permission !== null) {
        role.permissions.push({ id: row.permissionId, name: row.permission, description: row.description });
      }
      roles.set(row.roleId, role);
    }
    return [...roles.values()];
  }

  async listPermissions() {
    return this.db.query<{ id: number; name: string; description: string | null }>(
      'SELECT MaQuyen AS id, TenQuyen AS name, MoTa AS description FROM PHANQUYEN ORDER BY MaQuyen',
    );
  }

  async updateRolePermissions(roleId: number, permissionIds: number[]) {
    const uniqueIds = [...new Set(permissionIds)];
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const roleRequest = new sql.Request(transaction);
      roleRequest.input('roleId', sql.Int, roleId);
      const role = await roleRequest.query<{ name: string }>('SELECT TenVaiTro AS name FROM VAITRO WHERE MaVaiTro = @roleId');
      if (!role.recordset.length) throw new NotFoundException('Không tìm thấy vai trò');

      const countRequest = new sql.Request(transaction);
      countRequest.input('count', sql.Int, uniqueIds.length);
      countRequest.input('ids', sql.NVarChar(sql.MAX), JSON.stringify(uniqueIds));
      const valid = await countRequest.query<{ count: number }>(
        `SELECT COUNT(*) AS count FROM PHANQUYEN WHERE MaQuyen IN (SELECT TRY_CONVERT(INT, [value]) FROM OPENJSON(@ids))`,
      );
      if (valid.recordset[0].count !== uniqueIds.length) throw new BadRequestException('Danh sách quyền có mã không hợp lệ');

      const security = await new sql.Request(transaction).query<{ id: number }>(
        `SELECT MaQuyen AS id FROM PHANQUYEN WHERE TenQuyen = N'Quản Trị Hệ Thống'`,
      );
      const systemAdminPermissionId = security.recordset[0]?.id;
      if (role.recordset[0].name === 'Quản trị viên' && systemAdminPermissionId && !uniqueIds.includes(systemAdminPermissionId)) {
        throw new BadRequestException('Không thể bỏ quyền Quản Trị Hệ Thống khỏi vai trò Quản trị viên');
      }

      const deleteRequest = new sql.Request(transaction);
      deleteRequest.input('roleId', sql.Int, roleId);
      await deleteRequest.query('DELETE FROM VAITRO_QUYEN WHERE MaVT = @roleId');
      for (const permissionId of uniqueIds) {
        const insertRequest = new sql.Request(transaction);
        insertRequest.input('roleId', sql.Int, roleId);
        insertRequest.input('permissionId', sql.Int, permissionId);
        await insertRequest.query('INSERT INTO VAITRO_QUYEN(MaVT, MaQuyen) VALUES(@roleId, @permissionId)');
      }
      await transaction.commit();
      return this.listRoles();
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }

  async listPlans() {
    return this.db.query(
      `SELECT k.MaKeHoach AS id, k.TenKeHoach AS name, k.NamHoc AS schoolYear,
              k.HocKy AS semester, k.TrangThai AS status, k.LoaiKeHoach AS type,
              k.MaKhoa AS facultyId, f.TenKhoa AS faculty, k.MaBM AS departmentId,
              b.TenBM AS department, k.NgPhuTrach AS responsibleStaffId,
              k.NguoiDuyet AS reviewerAccountId, k.NgayDuyet AS reviewedAt,
              k.LichSuDuyet AS reviewHistory
       FROM KEHOACHHOCTHUAT k JOIN KHOA f ON f.MaKhoa = k.MaKhoa
       LEFT JOIN BOMON b ON b.MaBM = k.MaBM
       ORDER BY k.MaKeHoach DESC`,
    );
  }

  async getPlan(id: number) {
    const rows = await this.db.query(
      `SELECT k.MaKeHoach AS id, k.TenKeHoach AS name, k.NamHoc AS schoolYear,
              k.HocKy AS semester, k.TrangThai AS status, k.LoaiKeHoach AS type,
              k.MaKhoa AS facultyId, f.TenKhoa AS faculty, k.MaBM AS departmentId,
              b.TenBM AS department, k.NgPhuTrach AS responsibleStaffId,
              k.NguoiDuyet AS reviewerAccountId, k.NgayDuyet AS reviewedAt,
              k.LichSuDuyet AS reviewHistory
       FROM KEHOACHHOCTHUAT k JOIN KHOA f ON f.MaKhoa = k.MaKhoa
       LEFT JOIN BOMON b ON b.MaBM = k.MaBM WHERE k.MaKeHoach = @p1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async createPlan(dto: CreatePlanDto, accountId: number) {
    const faculty = await this.db.query<{ id: number }>('SELECT MaKhoa AS id FROM KHOA WHERE MaKhoa = @p1', [dto.maKhoa]);
    if (!faculty.length) throw new NotFoundException('Không tìm thấy khoa');
    if (dto.maBM !== undefined) {
      const department = await this.db.query<{ id: number }>(
        'SELECT MaBM AS id FROM BOMON WHERE MaBM = @p1 AND MaKhoa = @p2',
        [dto.maBM, dto.maKhoa],
      );
      if (!department.length) throw new BadRequestException('Bộ môn không thuộc khoa đã chọn');
    }
    if (dto.ngPhuTrach !== undefined) {
      const staff = await this.db.query<{ id: number }>(
        'SELECT MaCanBo AS id FROM CANBOKHOA WHERE MaCanBo = @p1 AND MaKhoa = @p2',
        [dto.ngPhuTrach, dto.maKhoa],
      );
      if (!staff.length) throw new BadRequestException('Cán bộ phụ trách không thuộc khoa đã chọn');
    }
    const history = JSON.stringify([{
      nguoi_thuc_hien: accountId,
      thoi_gian: new Date().toISOString(),
      trang_thai: 'Dự thảo',
      noi_dung: 'Tạo kế hoạch',
    }]);
    const request = this.db.pool.request();
    request.input('name', sql.NVarChar(200), dto.tenKeHoach.trim());
    request.input('schoolYear', sql.VarChar(20), dto.namHoc);
    request.input('semester', sql.NVarChar(30), dto.hocKy?.trim() || null);
    request.input('facultyId', sql.Int, dto.maKhoa);
    request.input('staffId', sql.Int, dto.ngPhuTrach ?? null);
    request.input('departmentId', sql.Int, dto.maBM ?? null);
    request.input('type', sql.VarChar(20), dto.loaiKeHoach);
    request.input('history', sql.NVarChar(sql.MAX), history);
    const result = await request.query<{ id: number }>(
      `INSERT INTO KEHOACHHOCTHUAT(TenKeHoach, NamHoc, HocKy, TrangThai, MaKhoa, NgPhuTrach, MaBM, LoaiKeHoach, LichSuDuyet)
       OUTPUT INSERTED.MaKeHoach AS id
       VALUES(@name, @schoolYear, @semester, N'Dự thảo', @facultyId, @staffId, @departmentId, @type, @history)`,
    );
    return this.getPlan(result.recordset[0].id);
  }

  async changePlanStatus(id: number, accountId: number, status: string, note: string | undefined, submit: boolean) {
    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const lockRequest = new sql.Request(transaction);
      lockRequest.input('id', sql.Int, id);
      const current = await lockRequest.query<{ status: string }>(
        'SELECT TrangThai AS status FROM KEHOACHHOCTHUAT WITH (UPDLOCK, ROWLOCK) WHERE MaKeHoach = @id',
      );
      if (!current.recordset.length) throw new NotFoundException('Không tìm thấy kế hoạch');
      const currentStatus = current.recordset[0].status;
      if (submit && !['Dự thảo', 'Cần bổ sung'].includes(currentStatus)) {
        throw new ConflictException('Chỉ kế hoạch ở trạng thái Dự thảo hoặc Cần bổ sung mới được gửi duyệt');
      }
      if (!submit && currentStatus !== 'Chờ duyệt') {
        throw new ConflictException('Chỉ kế hoạch đang Chờ duyệt mới được xét duyệt');
      }

      const event = JSON.stringify({
        nguoi_thuc_hien: accountId,
        thoi_gian: new Date().toISOString(),
        trang_thai: status,
        noi_dung: note?.trim() || (submit ? 'Gửi kế hoạch để xét duyệt' : ''),
      });
      const update = new sql.Request(transaction);
      update.input('id', sql.Int, id);
      update.input('status', sql.NVarChar(30), status);
      update.input('event', sql.NVarChar(sql.MAX), event);
      if (submit) {
        await update.query(
          `UPDATE KEHOACHHOCTHUAT
           SET TrangThai = @status,
               LichSuDuyet = JSON_MODIFY(CASE WHEN ISJSON(LichSuDuyet) = 1 THEN LichSuDuyet ELSE N'[]' END, 'append $', JSON_QUERY(@event))
           WHERE MaKeHoach = @id`,
        );
      } else {
        update.input('reviewerId', sql.Int, accountId);
        await update.query(
          `UPDATE KEHOACHHOCTHUAT
           SET TrangThai = @status, NguoiDuyet = @reviewerId, NgayDuyet = SYSDATETIMEOFFSET(),
               LichSuDuyet = JSON_MODIFY(CASE WHEN ISJSON(LichSuDuyet) = 1 THEN LichSuDuyet ELSE N'[]' END, 'append $', JSON_QUERY(@event))
           WHERE MaKeHoach = @id`,
        );
      }
      await transaction.commit();
      return this.getPlan(id);
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }

  async listCompetitions() {
    return this.db.query(
      `SELECT c.MaCThi AS id, c.TenCuocThi AS name, c.MaHD AS activityId,
              h.TenHoatDong AS activity, COALESCE(h.MaKeHoach, h.MaKeHoachKhoa) AS planId,
              k.TrangThai AS planStatus
       FROM CUOCTHI c JOIN HOATDONGHOCTHUAT h ON h.MaHD = c.MaHD
       LEFT JOIN KEHOACHHOCTHUAT k ON k.MaKeHoach = COALESCE(h.MaKeHoach, h.MaKeHoachKhoa)
       ORDER BY c.MaCThi DESC`,
    );
  }

  async listCompetitionBoards(competitionId: number) {
    const exists = await this.db.query<{ id: number }>('SELECT MaCThi AS id FROM CUOCTHI WHERE MaCThi = @p1', [competitionId]);
    if (!exists.length) return null;
    const rows = await this.db.query<{
      boardId: number; boardName: string; lecturerId: number | null; lecturer: string | null;
      position: string | null; duty: string | null;
    }>(
      `SELECT b.MaBan AS boardId, b.TenBanTC AS boardName, gv.MaGV AS lecturerId,
              n.HoTen AS lecturer, bt.ChucVu AS position, bt.NhiemVu AS duty
       FROM BANCUOCTHI b
       LEFT JOIN BANTOCHUC bt ON bt.MaBanTC = b.MaBan
       LEFT JOIN GIANGVIEN gv ON gv.MaGV = bt.MaGV
       LEFT JOIN NGUOIDUNG n ON n.MaNgDung = gv.MaNgDung
       WHERE b.MaCThi = @p1 ORDER BY b.MaBan, gv.MaGV`,
      [competitionId],
    );
    const boards = new Map<number, { id: number; name: string; members: Array<{ lecturerId: number; lecturer: string | null; position: string | null; duty: string | null }> }>();
    for (const row of rows) {
      const board = boards.get(row.boardId) ?? { id: row.boardId, name: row.boardName, members: [] };
      if (row.lecturerId !== null) {
        board.members.push({ lecturerId: row.lecturerId, lecturer: row.lecturer, position: row.position, duty: row.duty });
      }
      boards.set(row.boardId, board);
    }
    return [...boards.values()];
  }

  async createCompetitionBoard(competitionId: number, dto: CreateCompetitionCommitteeDto) {
    const lecturerIds = dto.thanhVien.map((member) => member.maGV);
    if (new Set(lecturerIds).size !== lecturerIds.length) throw new BadRequestException('Không thể thêm một giảng viên nhiều lần vào cùng một ban');

    const transaction = new sql.Transaction(this.db.pool);
    await transaction.begin();
    try {
      const competitionRequest = new sql.Request(transaction);
      competitionRequest.input('id', sql.Int, competitionId);
      const competition = await competitionRequest.query<{ name: string | null; planStatus: string | null }>(
        `SELECT c.TenCuocThi AS name, k.TrangThai AS planStatus
         FROM CUOCTHI c JOIN HOATDONGHOCTHUAT h ON h.MaHD = c.MaHD
         LEFT JOIN KEHOACHHOCTHUAT k ON k.MaKeHoach = COALESCE(h.MaKeHoach, h.MaKeHoachKhoa)
         WHERE c.MaCThi = @id`,
      );
      if (!competition.recordset.length) throw new NotFoundException('Không tìm thấy cuộc thi');
      if (competition.recordset[0].planStatus !== 'Đã duyệt') {
        throw new BadRequestException('Chỉ được thành lập ban cho cuộc thi thuộc kế hoạch đã được duyệt');
      }

      const nameRequest = new sql.Request(transaction);
      nameRequest.input('id', sql.Int, competitionId);
      nameRequest.input('name', sql.NVarChar(150), dto.tenBan.trim());
      const duplicate = await nameRequest.query('SELECT TOP (1) MaBan FROM BANCUOCTHI WHERE MaCThi = @id AND TenBanTC = @name');
      if (duplicate.recordset.length) throw new ConflictException('Tên ban này đã tồn tại trong cuộc thi');

      const idsJson = JSON.stringify(lecturerIds);
      const lecturerRequest = new sql.Request(transaction);
      lecturerRequest.input('ids', sql.NVarChar(sql.MAX), idsJson);
      const lecturers = await lecturerRequest.query<{ count: number }>(
        'SELECT COUNT(*) AS count FROM GIANGVIEN WHERE MaGV IN (SELECT TRY_CONVERT(INT, [value]) FROM OPENJSON(@ids))',
      );
      if (lecturers.recordset[0].count !== lecturerIds.length) throw new BadRequestException('Một hoặc nhiều mã giảng viên không tồn tại');

      const boardRequest = new sql.Request(transaction);
      boardRequest.input('competitionId', sql.Int, competitionId);
      boardRequest.input('name', sql.NVarChar(150), dto.tenBan.trim());
      const board = await boardRequest.query<{ id: number }>(
        'INSERT INTO BANCUOCTHI(MaCThi, TenBanTC) OUTPUT INSERTED.MaBan AS id VALUES(@competitionId, @name)',
      );
      const boardId = board.recordset[0].id;
      for (const member of dto.thanhVien) {
        const memberRequest = new sql.Request(transaction);
        memberRequest.input('boardId', sql.Int, boardId);
        memberRequest.input('lecturerId', sql.Int, member.maGV);
        memberRequest.input('position', sql.NVarChar(100), member.chucVu?.trim() || null);
        memberRequest.input('duty', sql.NVarChar(sql.MAX), member.nhiemVu.trim());
        await memberRequest.query(
          'INSERT INTO BANTOCHUC(MaBanTC, MaGV, ChucVu, NhiemVu) VALUES(@boardId, @lecturerId, @position, @duty)',
        );
      }
      await transaction.commit();
      return { id: boardId, name: dto.tenBan.trim(), competitionId, competition: competition.recordset[0].name, members: dto.thanhVien };
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }
}
