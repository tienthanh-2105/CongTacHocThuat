import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash } from 'bcryptjs';
import { AuthService } from '../src/business/auth/auth.service';
import type { AuthRepository } from '../src/data/auth.repository';
import type { SessionContext } from '../src/business/auth/auth.types';
import { FeaturesService } from '../src/business/features/features.service';
import type { FeaturesRepository } from '../src/data/repositories/features/features.repository';
import { RegistrationService } from '../src/business/registration/registration.service';
import type { RegistrationRepository } from '../src/data/repositories/registration/registration.repository';
import { WorkflowService } from '../src/business/workflow/workflow.service';
import type { DatabaseService } from '../src/data/database.service';

const isHttpStatus = (status: number) => (error: unknown) =>
  error instanceof HttpException && error.getStatus() === status;

function context(roles: string[] = ['SINHVIEN']): SessionContext {
  return {
    userId: '17',
    sessionId: 'unit-test-session',
    passwordVersion: 1,
    user: { id: '17', username: 'unit.test', name: 'Người kiểm thử', roles },
  };
}

test('AuthService', async (t) => {
  await t.test('đăng nhập hợp lệ trả token, tạo phiên và chỉ trả thông tin an toàn', async () => {
    const passwordHash = await hash('correct-password', 4);
    const created: unknown[][] = [];
    const repository = {
      findUserByUsername: async () => ({
        id: '17', username: 'unit.test', name: 'Người kiểm thử', active: true,
        passwordHash, passwordVersion: 2, roles: [{ role: { code: 'SINHVIEN' } }],
      }),
      createSession: async (...args: unknown[]) => { created.push(args); },
    } as unknown as AuthRepository;
    const config = { get: (key: string) => key === 'SESSION_TTL_SECONDS' ? 60 : 'test' } as ConfigService;
    const service = new AuthService(repository, config);

    const result = await service.login({ username: 'unit.test', password: 'correct-password' });

    assert.equal(result.user.username, 'unit.test');
    assert.deepEqual(result.user.roles, ['SINHVIEN']);
    assert.equal('passwordHash' in result.user, false);
    assert.equal(result.token.length, 64);
    assert.equal(created.length, 1);
    assert.equal(created[0][0], (await import('../src/business/auth/token')).tokenDigest(result.token));
  });

  await t.test('từ chối mật khẩu sai và tài khoản bị khóa', async () => {
    const passwordHash = await hash('correct-password', 4);
    const repository = {
      findUserByUsername: async (username: string) => ({
        id: username, username, name: username, active: username !== 'locked',
        passwordHash, passwordVersion: 1, roles: [],
      }),
      createSession: async () => assert.fail('Không được tạo phiên khi đăng nhập thất bại'),
    } as unknown as AuthRepository;
    const service = new AuthService(repository, { get: () => 60 } as unknown as ConfigService);

    await assert.rejects(service.login({ username: 'unit.test', password: 'wrong-password' }), isHttpStatus(401));
    await assert.rejects(service.login({ username: 'locked', password: 'correct-password' }), isHttpStatus(401));
  });
});

test('RegistrationService', async (t) => {
  const student = { MaSV: 27, MSSV: '23310027', HoTen: 'Người kiểm thử', TenLop: 'D24' };
  const activity = {
    MaHD: 31, TenHoatDong: 'Seminar kiểm thử', HanDangKy: new Date(Date.now() + 86_400_000),
    TrangThai: 'Đã công bố',
  };

  await t.test('đăng ký cá nhân thành công và gửi thông báo', async () => {
    let notifications = 0;
    const repository = {
      findStudentByUserId: async () => student,
      findActivityById: async () => activity,
      findRegistration: async () => null,
      registerIndividualWithinCapacity: async () => ({ waitlisted: false as const, MaDK: 81, NgayDK: new Date() }),
      createRegistrationNotification: async () => { notifications++; },
    } as unknown as RegistrationRepository;
    const result = await new RegistrationService(repository).registerIndividual('17', { maHD: 31, hinhThuc: 'Tham gia' });

    assert.equal(result.data.maDK, 81);
    assert.equal(result.data.sinhVien.mssv, student.MSSV);
    assert.equal(notifications, 1);
  });

  await t.test('đưa vào danh sách chờ khi hoạt động đủ chỗ', async () => {
    let notifications = 0;
    const repository = {
      findStudentByUserId: async () => student,
      findActivityById: async () => activity,
      findRegistration: async () => null,
      registerIndividualWithinCapacity: async () => ({ waitlisted: true as const, MaCho: 9, ViTri: 2 }),
      createRegistrationNotification: async () => { notifications++; },
    } as unknown as RegistrationRepository;
    const result = await new RegistrationService(repository).registerIndividual('17', { maHD: 31 });

    assert.equal(result.data.trangThai, 'Đang chờ');
    assert.equal(result.data.viTri, 2);
    assert.equal(notifications, 0);
  });

  await t.test('từ chối tài khoản chưa liên kết hồ sơ sinh viên', async () => {
    const repository = { findStudentByUserId: async () => null } as unknown as RegistrationRepository;
    await assert.rejects(
      new RegistrationService(repository).registerIndividual('17', { maHD: 31 }),
      isHttpStatus(400),
    );
  });

  await t.test('từ chối hoạt động đã đóng, quá hạn hoặc đã đăng ký trùng', async (t) => {
    const makeService = (currentActivity: typeof activity, registration: { TrangThai: string } | null) =>
      new RegistrationService({
        findStudentByUserId: async () => student,
        findActivityById: async () => currentActivity,
        findRegistration: async () => registration,
      } as unknown as RegistrationRepository);

    await t.test('hoạt động đã kết thúc', async () => {
      await assert.rejects(
        makeService({ ...activity, TrangThai: 'Đã kết thúc' }, null).registerIndividual('17', { maHD: 31 }),
        isHttpStatus(400),
      );
    });
    await t.test('hạn đăng ký đã qua', async () => {
      await assert.rejects(
        makeService({ ...activity, HanDangKy: new Date(Date.now() - 1000) }, null).registerIndividual('17', { maHD: 31 }),
        isHttpStatus(400),
      );
    });
    await t.test('đăng ký hiện hữu chưa bị hủy', async () => {
      await assert.rejects(
        makeService(activity, { TrangThai: 'Đã đăng ký' }).registerIndividual('17', { maHD: 31 }),
        isHttpStatus(409),
      );
    });
  });

  await t.test('đăng ký đội loại MSSV trùng trước khi ghi dữ liệu', async () => {
    let storedMembers: number[] = [];
    const repository = {
      findStudentByUserId: async () => student,
      findCompetitionById: async () => ({ MaCThi: 5, MaHD: 31, TenCuocThi: 'Cuộc thi thử', HanDangKy: activity.HanDangKy, TrangThai: 'Đã công bố' }),
      findTeamByName: async () => null,
      findStudentTeamInCompetition: async () => null,
      findStudentByMssv: async () => ({ ...student, MaSV: 28, MSSV: '23310028' }),
      createWaitlistedTeam: async () => null,
      createTeamWithMembers: async (_competitionId: number, _activityId: number, _name: string, _captainId: number, members: number[]) => {
        storedMembers = members;
        return { maDoi: 6, tenDoi: 'Đội thử', totalMembers: members.length + 1 };
      },
    } as unknown as RegistrationRepository;
    const result = await new RegistrationService(repository).registerTeam('17', {
      maCThi: 5, tenDoi: 'Đội thử', thanhVienMSSV: ['23310028', ' 23310028 '],
    });

    assert.equal(result.data.tongThanhVien, 2);
    assert.deepEqual(storedMembers, [28]);
  });
});

test('FeaturesService', async (t) => {
  const profile = { MaSV: 27, TongDiemRenLuyen: '18' };

  await t.test('sinh viên xem được tổng điểm và lịch sử DRL', async () => {
    const repository = {
      getMobileProfile: async () => profile,
      getMobileTrainingPoints: async () => [{ MaDiem: 3, SoDiem: 5, TrangThai: 'Đã xác nhận' }],
    } as unknown as FeaturesRepository;
    const result = await new FeaturesService(repository, {} as RegistrationService).getMyTrainingPoints(context());

    assert.equal(result.tongDiem, 18);
    assert.equal(result.chiTiet.length, 1);
  });

  await t.test('không có hồ sơ sinh viên thì không tải được lịch sử cá nhân', async () => {
    const repository = { getMobileProfile: async () => ({ MaSV: null }) } as unknown as FeaturesRepository;
    const service = new FeaturesService(repository, {} as RegistrationService);

    await assert.rejects(service.getMyActivities(context()), isHttpStatus(400));
    await assert.rejects(service.getReminders(context()), isHttpStatus(400));
  });

  await t.test('seminar hợp lệ được chuyển tới repository và seminar sai thời gian bị chặn', async () => {
    let saved = false;
    const repository = {
      createSeminar: async (dto: unknown) => { saved = true; return dto; },
    } as unknown as FeaturesRepository;
    const service = new FeaturesService(repository, {} as RegistrationService);
    const dto = {
      tenHoatDong: 'Seminar kiểm thử', chuDe: 'Ứng dụng AI',
      tgBatDau: '2030-10-20T09:00:00.000Z', tgKetThuc: '2030-10-20T10:00:00.000Z',
      dvChuTri: 'Bộ môn Công nghệ phần mềm',
    };

    await service.createSeminar(context(['CANBOKHOA']), dto);
    assert.equal(saved, true);
    await assert.rejects(
      service.createSeminar(context(['CANBOKHOA']), { ...dto, tgKetThuc: dto.tgBatDau }),
      isHttpStatus(400),
    );
    await assert.rejects(
      service.createSeminar(context(['CANBOKHOA']), { ...dto, hanDangKy: '2030-10-20T09:30:00.000Z' }),
      isHttpStatus(400),
    );
  });

  await t.test('chỉ vai trò phù hợp mới duyệt quyết toán', async () => {
    let approvals = 0;
    const repository = {
      approveSettlement: async () => { approvals++; return { MaHS: 4, TrangThai: 'Đã duyệt' }; },
    } as unknown as FeaturesRepository;
    const service = new FeaturesService(repository, {} as RegistrationService);

    await assert.rejects(service.approveSettlement(context(['SINHVIEN']), 4), isHttpStatus(403));
    assert.equal(approvals, 0);
    const result = await service.approveSettlement(context(['CANBOKHOA']), 4);
    assert.equal(result.data.TrangThai, 'Đã duyệt');
    assert.equal(approvals, 1);
  });
});

test('WorkflowService', async (t) => {
  await t.test('gửi hoạt động lên duyệt chỉ khi có quyền và đúng người lập', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        return [{ MaHD: 31, TrangThai: 'Chờ duyệt' }];
      },
    } as unknown as DatabaseService;
    const service = new WorkflowService(db);

    await assert.rejects(service.submitAcademicActivity(context(['SINHVIEN']), 31), isHttpStatus(403));
    assert.equal(queries.length, 0);
    const result = await service.submitAcademicActivity(context(['GIANGVIEN']), 31);
    assert.equal(result.activity.TrangThai, 'Chờ duyệt');
    assert.match(queries[0].sql, /NguoiLap=@p2/);
  });

  await t.test('duyệt hoạt động bởi cán bộ khoa và chặn sinh viên', async () => {
    const db = {
      query: async () => [{ MaHD: 31, TrangThai: 'Đã duyệt' }],
    } as unknown as DatabaseService;
    const service = new WorkflowService(db);

    await assert.rejects(service.approveAcademicActivity(context(['SINHVIEN']), 31), isHttpStatus(403));
    const result = await service.approveAcademicActivity(context(['CANBOKHOA']), 31);
    assert.equal(result.activity.TrangThai, 'Đã duyệt');
  });

  await t.test('ghi nhận DRL yêu cầu quyền CTSV và lưu trạng thái chờ xác nhận', async () => {
    let statement = '';
    const db = {
      query: async (sql: string) => { statement = sql; return [{ MaDiem: 8, TrangThai: 'Chờ xác nhận' }]; },
    } as unknown as DatabaseService;
    const service = new WorkflowService(db);
    const dto = { maSV: 27, maHD: 31, hocKy: 'HK1', namHoc: '2026-2027', diem: 5, lyDo: 'Tham gia seminar' };

    await assert.rejects(service.awardPoint(context(['GIANGVIEN']), dto), isHttpStatus(403));
    const result = await service.awardPoint(context(['PHONGCTSV']), dto);
    assert.equal(result.TrangThai, 'Chờ xác nhận');
    assert.match(statement, /N'Chờ xác nhận'/);
  });

  await t.test('kết quả cuộc thi phải gắn đúng một cá nhân hoặc một đội', async (t) => {
    const db = {
      query: async (sql: string) => sql.includes('INSERT INTO KETQUAHOCTHUAT')
        ? [{ MaKQ: 11, TrangThai: 'Dự thảo' }]
        : [{ ok: 1 }],
    } as unknown as DatabaseService;
    const service = new WorkflowService(db);
    const authorized = context(['GIANGVIEN']);

    await t.test('không nhận dữ liệu không chọn đối tượng', async () => {
      await assert.rejects(service.createCompetitionResult(authorized, 5, {}), isHttpStatus(400));
    });
    await t.test('không nhận đồng thời cá nhân và đội', async () => {
      await assert.rejects(service.createCompetitionResult(authorized, 5, { maDK: 2, maDoi: 3 }), isHttpStatus(400));
    });
    await t.test('lưu được kết quả cho một cá nhân', async () => {
      const result = await service.createCompetitionResult(authorized, 5, { maDK: 2, xepHang: 1 });
      assert.equal(result.TrangThai, 'Dự thảo');
    });
  });
});
