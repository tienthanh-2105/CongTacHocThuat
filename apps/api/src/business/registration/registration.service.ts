import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RegistrationRepository } from '../../data/repositories/registration/registration.repository';

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(RegistrationRepository)
    private readonly repository: RegistrationRepository,
  ) {}

  async updateRegistrationStatus(maDK: number, trangThai: string) {
    const updated = await this.repository.updateRegistrationStatus(maDK, trangThai);
    if (!updated) {
      throw new NotFoundException(`Không tìm thấy đơn đăng ký với mã: ${maDK}`);
    }
    return { message: `Cập nhật trạng thái đơn đăng ký thành "${trangThai}" thành công` };
  }
}
