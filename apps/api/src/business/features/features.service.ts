import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FeaturesRepository } from '../../data/repositories/features/features.repository';
import { RegistrationService } from '../registration/registration.service';
import type { SessionContext } from '../auth/auth.types';
import type { CreateExpenseDto, CreateSeminarDto, CreateSettlementReportDto, UpdateExpenseDto, UpdateSeminarDetailsDto } from '../../presentation/features/features.dto';
import { registrationDeadlineOverrideEnabled } from '../registration/registration-policy';

function roleKey(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

@Injectable()
export class FeaturesService {
  constructor(
    @Inject(FeaturesRepository) private readonly repository: FeaturesRepository,
    @Inject(RegistrationService) private readonly registrations: RegistrationService,
  ) {}

  private requireRole(context: SessionContext, roles: string[]) {
    const allowed = new Set(roles.map(roleKey));
    if (!context.user.roles.some(role => allowed.has(roleKey(role)))) {
      throw new ForbiddenException('Bạn không có quyền thực hiện chức năng này');
    }
  }

  private isAcademicCoordinator(context: SessionContext) {
    return context.user.roles.some(role => roleKey(role) === 'TRUONGBANHOCTHUAT')
      || roleKey(context.user.position ?? '').includes('TRUONGBANHOCTHUAT');
  }

  private async requireStudent(context: SessionContext) {
    const profile = await this.repository.getMobileProfile(context.userId);
    if (!profile) throw new NotFoundException('Không tìm thấy tài khoản');
    if (!profile.MaSV) throw new BadRequestException('Tài khoản chưa được liên kết với hồ sơ sinh viên');
    return profile;
  }

  getProfile(context: SessionContext) {
    return this.repository.getMobileProfile(context.userId).then(profile => {
      if (!profile) throw new NotFoundException('Không tìm thấy tài khoản');
      return profile;
    });
  }

  async getMobileActivities(context: SessionContext) {
    const student = await this.requireStudent(context);
    return this.repository.listMobileActivities(student.MaSV, registrationDeadlineOverrideEnabled());
  }

  async getMobileTopics(context: SessionContext) {
    await this.requireStudent(context);
    return this.repository.listMobileTopics();
  }

  async getMobileNotifications(context: SessionContext) {
    await this.requireStudent(context);
    return this.repository.getMobileNotifications(context.userId);
  }

  async getMyActivities(context: SessionContext) {
    await this.requireStudent(context);
    return this.repository.getMobileActivities(context.userId);
  }

  async getMyTrainingPoints(context: SessionContext) {
    const profile = await this.requireStudent(context);
    return {
      tongDiem: Number(profile.TongDiemRenLuyen ?? 0),
      chiTiet: await this.repository.getMobileTrainingPoints(context.userId),
    };
  }

  async getReminders(context: SessionContext) {
    await this.requireStudent(context);
    return this.repository.getReminders(context.userId);
  }

  listSeminars(context: SessionContext, managementOnly = false) {
    const canManage = context.user.roles.some(role => ['ADMIN','CANBOKHOA','GIANGVIEN','TRUONGKHOA','PHONGCTSV'].includes(roleKey(role)));
    return this.repository.listSeminars(canManage, managementOnly);
  }

  async listActivities() {
    const activities = await this.repository.listActivities();
    const reopened = registrationDeadlineOverrideEnabled();
    return activities.map((activity) => ({ ...activity, MoDangKySauHan: reopened }));
  }

  async getSeminar(id: number) {
    const seminar = await this.repository.findSeminar(id);
    if (!seminar) throw new NotFoundException(`Không tìm thấy seminar ${id}`);
    return seminar;
  }
  async updateSeminar(context: SessionContext, id: number, dto: UpdateSeminarDetailsDto) {
    this.requireRole(context,['ADMIN','GIANGVIEN','CANBOKHOA','TRUONGKHOA']);
    const result = await this.repository.updateSeminarDetails(context.userId,context.user.roles.includes('ADMIN'),id,dto);
    if (!result) throw new ForbiddenException('Chỉ người lập hoặc Ban tổ chức được phân công seminar này được cập nhật thông tin');
    return result;
  }

  async createSeminar(context: SessionContext, dto: CreateSeminarDto) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'GIANG_VIEN', 'GIANGVIEN']);
    const startsAt = new Date(dto.tgBatDau);
    const endsAt = new Date(dto.tgKetThuc);
    if (endsAt <= startsAt) throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    if (dto.hanDangKy && new Date(dto.hanDangKy) > startsAt) {
      throw new BadRequestException('Hạn đăng ký không được sau thời gian bắt đầu seminar');
    }
    return this.repository.createSeminar(dto, context.userId);
  }

  async registerSeminar(context: SessionContext, seminarId: number) {
    const seminar = await this.repository.findSeminar(seminarId);
    if (!seminar) throw new NotFoundException(`Không tìm thấy seminar ${seminarId}`);
    return this.registrations.registerIndividual(context.userId, {
      maHD: seminar.MaHD,
      hinhThuc: 'Tham gia',
    });
  }

  async createExpense(context: SessionContext, dto: CreateExpenseDto) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'GIANG_VIEN', 'GIANGVIEN']);
    if (!await this.repository.activityExists(dto.maHD)) throw new NotFoundException(`Không tìm thấy hoạt động ${dto.maHD}`);
    if (!await this.repository.canManageActivitySettlement(context.userId, dto.maHD)) throw new ForbiddenException('Chỉ người lập hoạt động hoặc người được phân công kinh phí, quyết toán trong Kế hoạch chi tiết đã duyệt mới được ghi nhận quyết toán');
    if (dto.maKPHD != null && !await this.repository.activityBudgetLineExists(dto.maKPHD, dto.maHD)) throw new NotFoundException('Không tìm thấy hạng mục dự trù của hoạt động');
    return this.repository.createExpense(context.userId, dto);
  }

  async updateExpense(context: SessionContext, id: number, dto: UpdateExpenseDto) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'GIANG_VIEN', 'GIANGVIEN']);
    if (!await this.repository.canManageActivitySettlement(context.userId, dto.maHD)) throw new ForbiddenException('Tài khoản chưa được giao phụ trách kinh phí hoặc quyết toán cho hoạt động này');
    if (dto.maKPHD != null && !await this.repository.activityBudgetLineExists(dto.maKPHD, dto.maHD)) throw new NotFoundException('Không tìm thấy hạng mục dự trù của hoạt động');
    const result = await this.repository.updateExpense(id, context.userId, dto);
    if (!result) throw new NotFoundException('Chỉ sửa được khoản chi thuộc hồ sơ quyết toán nháp do bạn lập');
    return result;
  }

  async getSettlement(context: SessionContext, activityId: number) {
    if (!await this.repository.activityExists(activityId)) throw new NotFoundException(`Không tìm thấy hoạt động ${activityId}`);
    const canViewAll = this.isAcademicCoordinator(context)
      || context.user.roles.some(role => ['ADMIN', 'CANBOKHOA', 'TRUONGKHOA'].includes(roleKey(role)));
    if (!canViewAll && !await this.repository.canManageActivitySettlement(context.userId, activityId)) {
      throw new ForbiddenException('Chỉ người lập hoạt động hoặc người được phân công kinh phí, quyết toán mới được xem hồ sơ này');
    }
    return this.repository.getSettlement(activityId);
  }

  async listSettlementActivities(context: SessionContext) {
    const canViewAll = this.isAcademicCoordinator(context)
      || context.user.roles.some(role => ['ADMIN', 'CANBOKHOA', 'TRUONGKHOA'].includes(roleKey(role)));
    if (canViewAll) return this.repository.listSettlementActivitiesForUser(context.userId, true);
    if (!context.user.roles.some(role => ['GIANGVIEN', 'CANBOKHOA'].includes(roleKey(role)))) {
      throw new ForbiddenException('Tài khoản chưa được phân công theo dõi kinh phí hoặc quyết toán');
    }
    return this.repository.listSettlementActivitiesForUser(context.userId);
  }

  async approveSettlement(context: SessionContext, id: number) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'TRUONGKHOA']);
    const settlement = await this.repository.approveSettlement(id, context.userId);
    if (!settlement) throw new NotFoundException('Không tìm thấy hồ sơ quyết toán đang chờ duyệt');
    return { message: 'Đã duyệt hồ sơ quyết toán', data: settlement };
  }

  async submitSettlement(context: SessionContext, id: number) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'GIANG_VIEN', 'GIANGVIEN']);
    if (!await this.repository.canManageSettlement(context.userId, id)) throw new ForbiddenException('Chỉ người được phân công hồ sơ thanh toán mới được gửi quyết toán');
    const settlement = await this.repository.submitSettlement(id, context.userId);
    if (!settlement) throw new NotFoundException('Không tìm thấy hồ sơ nháp do bạn lập hoặc hồ sơ chưa có chi phí');
    return { message: 'Đã gửi hồ sơ quyết toán chờ duyệt', data: settlement };
  }

  async listSettlementReports(context: SessionContext) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'TRUONGKHOA', 'GIANG_VIEN', 'GIANGVIEN', 'TRUONGBANHOCTHUAT']);
    const canViewAll = this.isAcademicCoordinator(context)
      || context.user.roles.some(role => ['ADMIN', 'CANBOKHOA', 'TRUONGKHOA'].includes(roleKey(role)));
    return this.repository.listSettlementReports(context.userId, canViewAll);
  }

  async listSettlementReportActivities(context: SessionContext) {
    return this.listSettlementActivities(context);
  }

  async createSettlementReport(context: SessionContext, dto: CreateSettlementReportDto) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'GIANG_VIEN', 'GIANGVIEN', 'TRUONGBANHOCTHUAT']);
    if (!await this.repository.canManageActivitySettlement(context.userId, dto.maHD)) {
      throw new ForbiddenException('Chỉ người lập hoạt động hoặc người được phân công kinh phí, quyết toán mới được lập báo cáo');
    }
    return this.repository.createSettlementReport(context.userId, dto);
  }

  async getActivityReport(context: SessionContext, activityId: number) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'GIANG_VIEN', 'GIANGVIEN']);
    const report = await this.repository.getActivityReport(activityId);
    if (!report) throw new NotFoundException(`Không tìm thấy hoạt động ${activityId}`);
    return report;
  }
}
