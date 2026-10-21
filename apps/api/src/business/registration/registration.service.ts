import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RegistrationRepository } from '../../data/repositories/registration/registration.repository';
import type { AssignSupportDto } from '../../presentation/registration/registration.dto';

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(RegistrationRepository)
    private readonly repository: RegistrationRepository,
  ) {}

  async assignSupport(dto: AssignSupportDto) {
    const activity = await this.repository.findActivityById(dto.maHD);
    if (!activity) {
      throw new NotFoundException(`Không tìm thấy hoạt động với mã: ${dto.maHD}`);
    }

    await this.repository.assignSupport(
      dto.maHD,
      dto.maLop,
      dto.soLuong,
      dto.loaiPhanCong,
      dto.nhiemVu ?? null,
    );

    return {
      message: `Phân bổ chỉ tiêu ${dto.loaiPhanCong.toLowerCase()} cho lớp thành công`,
      data: dto,
    };
  }
}
