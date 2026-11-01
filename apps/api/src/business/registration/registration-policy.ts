import { BadRequestException } from '@nestjs/common';

export interface RegistrationEligibility {
  TrangThai: string;
  CoSoDuyet?: number | boolean;
  HanDangKy?: Date | string | null;
}

export function requireOpenRegistration(activity: RegistrationEligibility, now = Date.now()) {
  if (activity.TrangThai !== 'Đã công bố' || !activity.CoSoDuyet) {
    throw new BadRequestException('Chỉ đăng ký sau khi kế hoạch chi tiết được khoa, Phòng CTSV ký duyệt và ban tổ chức công bố');
  }
  if (activity.HanDangKy && new Date(activity.HanDangKy).getTime() <= now) {
    throw new BadRequestException('Đã hết hạn đăng ký cho hoạt động này');
  }
}
