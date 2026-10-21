import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RegistrationRepository } from '../../data/repositories/registration/registration.repository';
import type { RegisterIndividualDto } from '../../presentation/registration/registration.dto';

@Injectable()
export class RegistrationService {
  constructor(@Inject(RegistrationRepository) private readonly repository: RegistrationRepository) {}

  async registerIndividual(userId: string | number, dto: RegisterIndividualDto) {
    const student = await this.repository.findStudentByUserId(userId);
    if (!student) {
      throw new BadRequestException('Tài khoản của bạn chưa được liên kết với hồ sơ sinh viên');
    }

    const activity = await this.repository.findActivityById(dto.maHD);
    if (!activity) {
      throw new NotFoundException(`Không tìm thấy hoạt động học thuật với mã: ${dto.maHD}`);
    }

    if (activity.TrangThai === 'Đã hủy' || activity.TrangThai === 'Đã kết thúc') {
      throw new BadRequestException(`Hoạt động này hiện ở trạng thái "${activity.TrangThai}", không tiếp nhận đăng ký`);
    }

    if (activity.HanDangKy && new Date(activity.HanDangKy).getTime() < Date.now()) {
      throw new BadRequestException('Đã hết hạn đăng ký cho hoạt động này');
    }

    const existing = await this.repository.findRegistration(dto.maHD, student.MaSV);
    if (existing && existing.TrangThai !== 'Đã hủy') {
      throw new ConflictException(`Bạn đã đăng ký tham gia hoạt động này rồi (Trạng thái: ${existing.TrangThai})`);
    }

    if (activity.SLToiDa && activity.SLToiDa > 0) {
      const currentCount = await this.repository.countRegistrations(dto.maHD);
      if (currentCount >= activity.SLToiDa) {
        throw new BadRequestException(`Hoạt động đã đạt số lượng đăng ký tối đa (${activity.SLToiDa} người)`);
      }
    }

    const result = await this.repository.createIndividualRegistration(
      dto.maHD,
      student.MaSV,
      dto.hinhThuc ?? 'Dự thi',
      'Sinh viên',
      'Đã đăng ký',
    );

    return {
      message: 'Đăng ký tham gia hoạt động thành công',
      data: {
        maDK: result.MaDK,
        maHD: dto.maHD,
        tenHoatDong: activity.TenHoatDong,
        ngayDK: result.NgayDK,
        sinhVien: {
          maSV: student.MaSV,
          mssv: student.MSSV,
          hoTen: student.HoTen,
          tenLop: student.TenLop,
        },
        hinhThuc: dto.hinhThuc ?? 'Dự thi',
        trangThai: 'Đã đăng ký',
      },
    };
  }
}
