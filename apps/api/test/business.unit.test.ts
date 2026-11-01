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
import { detailedPlanReviewStage, validateDetailedPlanDates } from '../src/business/detailed-plans/detailed-plans.service';
import { requireOpenRegistration } from '../src/business/registration/registration-policy';
import { CompetitionWorkflowService } from '../src/business/workflow/competition-workflow.service';
import { DepartmentPlansService } from '../src/business/workflow/department-plans.service';

test('Đề xuất bộ môn: quyền Trưởng bộ môn đã lưu ở chức vụ, không cấp cho Trưởng khoa và Phó khoa', async () => {
  const memberships = [{ MaBM: 2, TenBM: 'Hệ thống thông tin', VaiTro: 'Trưởng bộ môn' }];
  const db = { query: async (query: string) => {
    if (query.includes('FROM TAIKHOAN t')) return memberships;
    if (query.includes('FROM KEHOACHCUOCTHIBOMON p')) return [];
    assert.fail(`Truy vấn ngoài dự kiến: ${query}`);
  } } as unknown as DatabaseService;
  const service = new DepartmentPlansService(db);
  const head = { ...context(['CANBOKHOA']), user: { ...context(['CANBOKHOA']).user, position: 'Trưởng bộ môn' } };
  assert.deepEqual(await service.departments(head), memberships);
  await assert.rejects(service.facultyQueue(head), isHttpStatus(403));
  const dean = { ...context(['TRUONGKHOA']), user: { ...context(['TRUONGKHOA']).user, position: 'Trưởng khoa' } };
  await assert.rejects(service.departments(dean), isHttpStatus(403));
  const vice = { ...context(['CANBOKHOA']), user: { ...context(['CANBOKHOA']).user, position: 'Phó Trưởng khoa' } };
  await assert.rejects(service.departments(vice), isHttpStatus(403));
});

const isHttpStatus = (status: number) => (error: unknown) =>
  error instanceof HttpException && error.getStatus() === status;

test('Quy trình ký chi tiết và điều kiện mở đăng ký', () => {
  assert.deepEqual(detailedPlanReviewStage('Chờ khoa ký',['TRUONGKHOA'],'approve'),{stage:'faculty',status:'Chờ CTSV ký'});
  assert.deepEqual(detailedPlanReviewStage('Chờ CTSV ký',['PHONGCTSV'],'approve'),{stage:'student-affairs',status:'Đã duyệt'});
  assert.throws(()=>detailedPlanReviewStage('Chờ khoa ký',['PHONGCTSV'],'approve'),isHttpStatus(403));
  assert.throws(()=>detailedPlanReviewStage('Chờ CTSV ký',['TRUONGKHOA'],'approve'),isHttpStatus(403));
  assert.throws(()=>detailedPlanReviewStage('Đã duyệt',['ADMIN'],'approve'),isHttpStatus(400));
  assert.equal(detailedPlanReviewStage('Chờ CTSV ký',['PHONGCTSV'],'request_changes').status,'Cần bổ sung');
  assert.throws(()=>requireOpenRegistration({TrangThai:'Đã công bố',CoSoDuyet:0}),isHttpStatus(400));
  assert.throws(()=>requireOpenRegistration({TrangThai:'Đã duyệt',CoSoDuyet:1}),isHttpStatus(400));
  assert.doesNotThrow(()=>requireOpenRegistration({TrangThai:'Đã công bố',CoSoDuyet:1}));
  assert.throws(()=>validateDetailedPlanDates({tenKeHoach:'KH',noiDung:'Nội dung',thoiGianBatDau:'2030-01-02',thoiGianKetThuc:'2030-01-01'}),isHttpStatus(400));
});

test('Vòng thi: chặn ra đề, chấm điểm, công bố khi chưa đủ điều kiện', async () => {
  const db={query:async (statement:string) => {
    if(statement.includes('FROM KHOA')) return [{MaKhoa:1,TenKhoa:'Công nghệ thông tin'}];
    if(statement.includes('SELECT * FROM VONGTHI')) return [{MaVong:1,MaCThi:1,TrangThai:'Chưa mở',BatDauLuc:new Date(Date.now()+86400000),KetThucLuc:new Date(Date.now()+172800000)}];
    if(statement.includes('FROM CUOCTHI c JOIN')) return [{MaCThi:1,MaHD:1,MaKhoa:1,TrangThai:'Đã công bố',TrangThaiKeHoach:'Đã duyệt'}];
    if(statement.includes('FROM BAITHI')) return [{MaVong:1}];
    if(statement.includes('FROM KETQUAHOCTHUAT')) return [{MaCThi:1,MaBaiNguon:null,TrangThai:'Dự thảo'}];
    if(statement.includes('FROM PHANCONGVONGTHI') || statement.includes('FROM DETHIVONG')) return [];
    assert.fail('Không được ghi dữ liệu khi chưa đủ điều kiện: '+statement);
  }} as unknown as DatabaseService;
  const service=new CompetitionWorkflowService(db);
  await assert.rejects(service.saveExam(context(['GIANGVIEN']),1,{noiDung:'Đề bí mật'}),isHttpStatus(403));
  await assert.rejects(service.scoreWork(context(['GIANGVIEN']),1,{diem:80}),isHttpStatus(403));
  await assert.rejects(service.setRoundStatus(context(['ADMIN']),1,{trangThai:'Đang mở'}),isHttpStatus(400));
  await assert.rejects(service.submitWork(context(['SINHVIEN']),1,{tieuDe:'Bài thi'}),isHttpStatus(400));
  await assert.rejects(service.publishResult(context(['ADMIN']),1),isHttpStatus(400));
});

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
    TrangThai: 'Đã công bố', CoSoDuyet: 1,
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
      findCompetitionById: async () => ({ MaCThi: 5, MaHD: 31, TenCuocThi: 'Cuộc thi thử', HanDangKy: activity.HanDangKy, TrangThai: 'Đã công bố', CoSoDuyet: 1 }),
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
  await t.test('chặn sinh viên gửi đề xuất và cán bộ khoa tự ký thay Trưởng khoa', async () => {
    const service=new WorkflowService({query:async()=>assert.fail('Không được truy vấn khi thiếu quyền')} as unknown as DatabaseService);
    await assert.rejects(service.submitAcademicActivity(context(['SINHVIEN']),31),isHttpStatus(403));
    await assert.rejects(service.approveAcademicActivity(context(['CANBOKHOA']),31),isHttpStatus(403));
  });

  await t.test('ghi nhận DRL yêu cầu quyền CTSV và lưu trạng thái chờ xác nhận', async () => {
    let statement = '';
    const db = {
      query: async (sql: string) => { if(sql.includes('SELECT d.DiemRenLuyen')) return [{DiemRenLuyen:5}]; statement = sql; return [{ MaDiem: 8, TrangThai: 'Chờ xác nhận' }]; },
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

test('WorkflowService: kế hoạch năm học của Khoa Công nghệ thông tin', async (t) => {
  const faculty = { MaKhoa: 47, TenKhoa: 'Khoa Công nghệ thông tin' };
  const otherFaculty = { MaKhoa: 8, TenKhoa: 'Khoa Kinh tế' };
  const departments = [
    { MaBM: 71, TenBM: 'Kỹ thuật phần mềm', MaKhoa: faculty.MaKhoa },
    { MaBM: 72, TenBM: 'Hệ thống thông tin', MaKhoa: faculty.MaKhoa },
    { MaBM: 90, TenBM: 'Quản trị kinh doanh', MaKhoa: otherFaculty.MaKhoa },
  ];
  const plans = [
    { MaKeHoach: 5, MaKhoa: faculty.MaKhoa, TenKeHoach: 'Kế hoạch CNTT', TrangThai: 'Dự thảo' },
    { MaKeHoach: 6, MaKhoa: otherFaculty.MaKhoa, TenKeHoach: 'Kế hoạch Kinh tế', TrangThai: 'Dự thảo' },
  ];
  const dto = { tenKeHoach: 'Kế hoạch năm học', namHoc: '2026-2027', maKhoa: faculty.MaKhoa };

  function makeService(faculties = [otherFaculty, faculty]) {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const writes: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (/FROM KHOA\b/.test(sql)) return faculties;
        if (/FROM BOMON\b/.test(sql)) {
          if (/WHERE MaBM=@p1/.test(sql)) return departments.filter(row => row.MaBM === params[0]);
          assert.match(sql, /WHERE MaKhoa=@p1/, 'Bộ môn phải được lọc theo khoa trong truy vấn');
          return departments.filter(row => row.MaKhoa === params[0]);
        }
        if (/SELECT p\.\*/.test(sql) && /FROM KEHOACHHOCTHUAT/.test(sql)) {
          if (/p\.MaKeHoach=@p1/.test(sql)) {
            assert.match(sql, /p\.MaKhoa=@p2/, 'Truy cập trực tiếp phải giới hạn khoa');
            return plans.filter(row => row.MaKeHoach === params[0] && row.MaKhoa === params[1]);
          }
          assert.match(sql, /WHERE p\.MaKhoa=@p1/, 'Danh sách kế hoạch phải giới hạn khoa');
          return plans.filter(row => row.MaKhoa === params[0]);
        }
        if (/SELECT MaKhoa,TrangThai,LoaiKeHoach FROM KEHOACHHOCTHUAT/.test(sql)) {
          return plans.filter(row => row.MaKeHoach === params[0]);
        }
        if (/FROM CHITIETKEHOACH d JOIN KEHOACHHOCTHUAT/.test(sql)) {
          return [{ MaChiTiet: 30, MaKeHoach: 6, MaKhoa: otherFaculty.MaKhoa, PlanStatus: 'Đã duyệt' }];
        }
        if (/SELECT MaKeHoach FROM CHITIETKEHOACH/.test(sql)) return [{MaKeHoach:6}];
        if (/FROM CHITIETKEHOACH/.test(sql)) return [{ MaChiTiet: 31, MaKeHoach: 5 }];
        if (/FROM HOATDONGHOCTHUAT/.test(sql)) return [];
        if (/FROM KEHOACHCUOCTHIBOMON/.test(sql)) return [];
        if (/INSERT INTO KEHOACHHOCTHUAT/.test(sql)) {
          writes.push({ sql, params });
          return [{ MaKeHoach: 100 }];
        }
        if (/FROM TAIKHOAN t JOIN NGUOIDUNG/.test(sql)) return [{ MaKhoa: otherFaculty.MaKhoa, MaCanBo: 9, MaBM: null }];
        assert.fail(`Truy vấn ngoài dự kiến: ${sql}`);
      },
    } as unknown as DatabaseService;
    return { service: new WorkflowService(db), queries, writes };
  }

  await t.test('xác định khoa qua các tên chính xác đã chuẩn hóa, không cố định mã khoa', async () => {
    for (const name of ['Công nghệ thông tin', 'Khoa Công nghệ thông tin', 'CNTT', 'Khoa CNTT', '  khoa CÔNG NGHỆ THÔNG TIN  '.normalize('NFD')]) {
      const { service } = makeService([otherFaculty, { ...faculty, TenKhoa: name }]);
      const result = await service.listPlanUnits(context(['ADMIN']));
      assert.equal(result.faculty.MaKhoa, 47);
      assert.equal(result.faculty.TenKhoa, name);
    }
  });

  await t.test('chỉ trả bộ môn thuộc CNTT cho các vai trò được xem kế hoạch', async () => {
    const { service } = makeService();
    for (const role of ['ADMIN', 'CANBOKHOA', 'GIANGVIEN', 'TRUONGBOMON', 'TRUONGKHOA', 'PHONGKHCN', 'HIEUTRUONG']) {
      const result = await service.listPlanUnits(context([role]));
      assert.deepEqual(result, { faculty, departments: departments.slice(0, 2) });
    }
    const blocked = makeService();
    await assert.rejects(blocked.service.listPlanUnits(context(['SINHVIEN'])), isHttpStatus(403));
    assert.equal(blocked.queries.length, 0);
  });

  await t.test('báo cấu hình rõ ràng khi thiếu hoặc có nhiều khoa khớp, không nhận tên chỉ chứa CNTT', async () => {
    for (const faculties of [
      [otherFaculty],
      [otherFaculty, { ...faculty, TenKhoa: 'Công nghệ thông tin ứng dụng' }],
      [faculty, { MaKhoa: 99, TenKhoa: 'CNTT' }],
    ]) {
      const { service, writes } = makeService(faculties);
      await assert.rejects(service.listPlanUnits(context(['ADMIN'])), error => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 503);
        assert.match(error.message, /Công nghệ thông tin/);
        return true;
      });
      assert.equal(writes.length, 0);
    }
  });

  await t.test('danh sách và truy cập trực tiếp chỉ cho phép kế hoạch CNTT', async () => {
    const { service } = makeService();
    assert.deepEqual(await service.listPlans(context(['ADMIN'])), [plans[0]]);
    const detail = await service.getPlan(context(['GIANGVIEN']), 5);
    assert.equal(detail.MaKeHoach, 5);
    assert.deepEqual(detail.hoatDong, [{ MaChiTiet: 31, MaKeHoach: 5 }]);
    assert.deepEqual(detail.hoatDongHocThuat, []);
    assert.deepEqual(detail.deXuatBoMon, []);
    await assert.rejects(service.getPlan(context(['ADMIN']), 6), isHttpStatus(404));
  });

  await t.test('chỉ tạo kế hoạch cho CNTT và bộ môn thuộc CNTT, giữ kiểm tra khoa của người lập', async () => {
    const { service, writes } = makeService();
    await assert.rejects(service.createPlan(context(['ADMIN']), { ...dto, maKhoa: otherFaculty.MaKhoa }), isHttpStatus(403));
    await assert.rejects(service.createPlan(context(['ADMIN']), { ...dto, maBM: 90 }), isHttpStatus(400));
    await assert.rejects(service.createPlan(context(['GIANGVIEN']), dto), isHttpStatus(403));
    assert.equal(writes.length, 0);
    const result = await service.createPlan(context(['ADMIN']), dto);
    assert.deepEqual(result, { maKeHoach: 100, trangThai: 'Dự thảo' });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].params[9], faculty.MaKhoa);
    assert.equal(writes[0].params[11], 'KHOA');
  });

  await t.test('chặn mọi thao tác trực tiếp với kế hoạch khoa khác trước khi ghi dữ liệu', async () => {
    const { service, writes } = makeService();
    const admin = context(['ADMIN']);
    const attempts: Array<() => Promise<unknown>> = [
      () => service.addPlanActivity(admin, 6, { tenHoatDong: 'Seminar', duToan: 0 }),
      () => service.selectPlanActivities(admin, 6, { maHDs: [] }),
      () => service.submitPlan(admin, 6),
      () => service.reviewPlan(admin, 6, { action: 'approve' }),
      () => service.publishPlanNews(admin, 6),
      () => service.publishPlanActivity(admin, 30),
    ];
    for (const attempt of attempts) await assert.rejects(attempt(), isHttpStatus(403));
    assert.equal(writes.length, 0);
  });
});
