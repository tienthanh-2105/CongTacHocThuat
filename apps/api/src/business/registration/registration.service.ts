import { Inject, Injectable } from '@nestjs/common';
import { RegistrationRepository } from '../../data/repositories/registration/registration.repository';

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(RegistrationRepository)
    private readonly repository: RegistrationRepository,
  ) {}

  async getMyRegistrations(userId: string | number) {
    const student = await this.repository.findStudentByUserId(userId);
    if (!student) {
      return [];
    }
    return this.repository.getMyRegistrations(student.MaSV);
  }
}
