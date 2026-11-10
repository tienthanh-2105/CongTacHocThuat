import { BadRequestException } from '@nestjs/common';

export interface RegistrationEligibility {
  TrangThai: string;
  CoSoDuyet?: number | boolean;
  HanDangKy?: Date | string | null;
}

export function registrationDeadlineOverrideEnabled() {
  return process.env.REGISTRATION_OPEN_OVERRIDE?.trim().toLowerCase() === 'true';
}

export function requireOpenRegistration(activity: RegistrationEligibility, now = Date.now()) {
  const allowAfterDeadline = registrationDeadlineOverrideEnabled();
  const statusAllowsRegistration = activity.TrangThai === 'Đã công bố'
    || (allowAfterDeadline && activity.TrangThai === 'Đã duyệt');
  if (!statusAllowsRegistration || !activity.CoSoDuyet) {
    throw new BadRequestException('Chỉ đăng ký sau khi kế hoạch chi tiết được khoa, Phòng CTSV ký duyệt và ban tổ chức công bố');
  }
  if (!allowAfterDeadline && activity.HanDangKy && new Date(activity.HanDangKy).getTime() <= now) {
    throw new BadRequestException('Đã hết hạn đăng ký cho hoạt động này');
  }
}
