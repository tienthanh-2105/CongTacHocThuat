import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FeaturesRepository } from '../../data/repositories/features/features.repository';
import { RegistrationService } from '../registration/registration.service';
import type { SessionContext } from '../auth/auth.types';
import type { CreateExpenseDto, CreateSeminarDto } from '../../presentation/features/features.dto';

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

  listSeminars() { return this.repository.listSeminars(); }

  listActivities() { return this.repository.listActivities(); }

  async getSeminar(id: number) {
    const seminar = await this.repository.findSeminar(id);
    if (!seminar) throw new NotFoundException(`Không tìm thấy seminar ${id}`);
    return seminar;
  }

  async createSeminar(context: SessionContext, dto: CreateSeminarDto) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'GIANG_VIEN', 'GIANGVIEN']);
    const startsAt = new Date(dto.tgBatDau);
    const endsAt = new Date(dto.tgKetThuc);
    if (endsAt <= startsAt) throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    if (dto.hanDangKy && new Date(dto.hanDangKy) > startsAt) {
      throw new BadRequestException('Hạn đăng ký không được sau thời gian bắt đầu seminar');
    }
    return this.repository.createSeminar(dto);
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
    return this.repository.createExpense(context.userId, dto);
  }

  async getSettlement(context: SessionContext, activityId: number) {
    if (!this.isAcademicCoordinator(context)) this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'GIANG_VIEN', 'GIANGVIEN', 'TRUONGKHOA']);
    if (!await this.repository.activityExists(activityId)) throw new NotFoundException(`Không tìm thấy hoạt động ${activityId}`);
    return this.repository.getSettlement(activityId);
  }

  async approveSettlement(context: SessionContext, id: number) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA']);
    const settlement = await this.repository.approveSettlement(id, context.userId);
    if (!settlement) throw new NotFoundException('Không tìm thấy hồ sơ quyết toán đang chờ duyệt');
    return { message: 'Đã duyệt hồ sơ quyết toán', data: settlement };
  }

  async submitSettlement(context: SessionContext, id: number) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'GIANG_VIEN', 'GIANGVIEN']);
    const settlement = await this.repository.submitSettlement(id, context.userId);
    if (!settlement) throw new NotFoundException('Không tìm thấy hồ sơ nháp do bạn lập hoặc hồ sơ chưa có chi phí');
    return { message: 'Đã gửi hồ sơ quyết toán chờ duyệt', data: settlement };
  }

  async getActivityReport(context: SessionContext, activityId: number) {
    this.requireRole(context, ['ADMIN', 'CAN_BO_KHOA', 'CANBOKHOA', 'GIANG_VIEN', 'GIANGVIEN']);
    const report = await this.repository.getActivityReport(activityId);
    if (!report) throw new NotFoundException(`Không tìm thấy hoạt động ${activityId}`);
    return report;
  }
}
